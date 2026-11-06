import {
  Body, CanActivate, ConflictException, Controller, ExecutionContext, ForbiddenException,
  BadRequestException, Get, Injectable, Post, Req, Res, UnauthorizedException, UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IsEmail, IsString, Matches, MinLength, MaxLength } from "class-validator";
import { normalizeBrazilianWhatsapp, whatsappVariants } from "./phone";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response, CookieOptions } from "express";
import { PrismaService } from "./prisma.service";
import { Throttle } from "@nestjs/throttler";

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const secure = process.env.NODE_ENV === "production";
const accessCookie = "aicorta_access";
const refreshCookie = "aicorta_refresh";

type AuthRequest = Request & { user: { id: string } };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function cookie(req: Request, name: string): string | undefined {
  const pair = req.headers.cookie?.split(";").map(value => value.trim()).find(value => value.startsWith(name + "="));
  return pair?.slice(name.length + 1);
}
function cookies(res: Response, access: string, refresh: string) {
  const options: CookieOptions = { httpOnly: true, secure, sameSite: "lax", path: "/" };
  res.cookie(accessCookie, access, { ...options, maxAge: ACCESS_TTL_SECONDS * 1000 });
  res.cookie(refreshCookie, refresh, { ...options, path: "/api/auth", maxAge: REFRESH_TTL_MS });
}
function clearCookies(res: Response) {
  const options: CookieOptions = { httpOnly: true, secure, sameSite: "lax" };
  res.clearCookie(accessCookie, { ...options, path: "/" });
  res.clearCookie(refreshCookie, { ...options, path: "/api/auth" });
}

export class RegisterDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @Matches(/^[a-z0-9]{3,30}$/) username!: string;
  @IsEmail() email!: string;
  @IsString() whatsapp!: string;
  @IsString() @MinLength(10) password!: string;
  @IsString() @MinLength(2) businessName!: string;
  @IsString() @MinLength(32) @MaxLength(256) inviteToken!: string;
}

export class LoginDto {
  @IsString() identifier!: string;
  @IsString() password!: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly db: PrismaService, private readonly jwt: JwtService) {}

  private safeUser(user: { id: string; name: string; username: string; email: string; whatsapp: string; globalRole: string }) {
    return { id: user.id, name: user.name, username: user.username, email: user.email, whatsapp: user.whatsapp, globalRole: user.globalRole };
  }

  private async startSession(userId: string, res: Response) {
    const refresh = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await this.db.authSession.create({ data: { userId, tokenHash: digest(refresh), expiresAt } });
    const access = await this.jwt.signAsync({ sub: userId, type: "access" }, { expiresIn: ACCESS_TTL_SECONDS });
    cookies(res, access, refresh);
  }

  async register(dto: RegisterDto, res: Response) {
    const username = dto.username.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();
    const whatsapp = normalizeBrazilianWhatsapp(dto.whatsapp);
    if (!whatsapp) throw new BadRequestException("WhatsApp inválido: informe DDD + celular (11 dígitos).");
    const tokenHash = digest(dto.inviteToken);
    const passwordHash = await hash(dto.password, 12);
    try {
      const account = await this.db.$transaction(async tx => {
        const invitation = await tx.ownerInvite.findUnique({ where: { tokenHash } });
        if (!invitation || invitation.consumedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) {
          throw new BadRequestException("Convite inválido, expirado ou já utilizado");
        }
        if (await tx.user.findFirst({ where: { whatsapp: { in: whatsappVariants(whatsapp) } }, select: { id: true } })) {
          throw new ConflictException("WhatsApp já cadastrado");
        }
        // Consumo atômico do token: rollback automático se houver falha no cadastro.
        const consumed = await tx.ownerInvite.updateMany({
          where: { id: invitation.id, consumedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          data: { consumedAt: new Date() },
        });
        if (consumed.count !== 1) throw new BadRequestException("Convite já utilizado");
        const user = await tx.user.create({
          data: { name: dto.name.trim(), username, email, whatsapp, passwordHash },
        });
        const tenant = await tx.tenant.create({
          data: {
            name: dto.businessName.trim(),
            slug: "barbearia-" + randomBytes(8).toString("hex"),
            ownerId: user.id,
            billingDueDay: invitation.billingDueDay,
          },
        });
        await tx.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: "ADMIN" } });
        return { user, tenant };
      });
      await this.startSession(account.user.id, res);
      return { user: this.safeUser(account.user), tenant: { id: account.tenant.id, slug: account.tenant.slug } };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ConflictException("Usuário, e-mail ou WhatsApp já cadastrado");
      }
      throw error;
    }
  }

  async login(dto: LoginDto, res: Response) {
    const identifier = dto.identifier.trim().toLowerCase();
    const phone = normalizeBrazilianWhatsapp(dto.identifier);
    const user = await this.db.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }, ...(phone ? [{ whatsapp: { in: whatsappVariants(phone) } }] : [])] },
    });
    if (!user || !user.isActive || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Credenciais inválidas");
    }
    await this.startSession(user.id, res);
    return { user: this.safeUser(user) };
  }

  async refresh(req: Request, res: Response) {
    const token = cookie(req, refreshCookie);
    if (!token) throw new UnauthorizedException("Sessão expirada");
    const tokenHash = digest(token);
    // Token consumido atomicamente: duas requisições concorrentes não reutilizam o mesmo refresh.
    const consumed = await this.db.authSession.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() }, user: { isActive: true } },
      data: { revokedAt: new Date() },
    });
    if (consumed.count !== 1) { clearCookies(res); throw new UnauthorizedException("Sessão expirada"); }
    const previous = await this.db.authSession.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!previous?.user.isActive) { clearCookies(res); throw new UnauthorizedException("Sessão expirada"); }
    await this.startSession(previous.userId, res);
    return { user: this.safeUser(previous.user) };
  }

  async logout(req: Request, res: Response) {
    const token = cookie(req, refreshCookie);
    if (token) await this.db.authSession.updateMany({ where: { tokenHash: digest(token), revokedAt: null }, data: { revokedAt: new Date() } });
    clearCookies(res);
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { isActive: true }, select: { tenantId: true, role: true, tenant: { select: { name: true, slug: true, status: true } } } } },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    return { id: user.id, name: user.name, username: user.username, email: user.email, whatsapp: user.whatsapp, globalRole: user.globalRole, isActive: user.isActive, memberships: user.memberships };
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = cookie(request, accessCookie);
    if (!token) throw new UnauthorizedException("Sessão ausente");
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type: string; iat?: number }>(token);
      if (payload.type !== "access" || !payload.sub) throw new UnauthorizedException();
      const user = await this.db.user.findUnique({ where: { id: payload.sub }, select: { id: true, isActive: true, passwordChangedAt: true } });
      if (!user?.isActive || (user.passwordChangedAt && (!payload.iat || (payload.iat + 1) * 1000 <= user.passwordChangedAt.getTime()))) throw new UnauthorizedException();
      request.user = { id: user.id };
      return true;
    } catch { throw new UnauthorizedException("Sessão inválida ou expirada"); }
  }
}

@Injectable()
export class SystemGuard implements CanActivate {
  constructor(private readonly db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const user = await this.db.user.findUnique({ where: { id: req.user.id }, select: { globalRole: true, isActive: true } });
    if (!user?.isActive || user.globalRole !== "SYSTEM") throw new ForbiddenException("Acesso exclusivo do sistema");
    return true;
  }
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Throttle({ default: { limit: 3, ttl: 60_000 } }) @Post("register") register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) { return this.auth.register(dto, res); }
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) @Post("login") login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) { return this.auth.login(dto, res); }
  @Throttle({ default: { limit: 15, ttl: 60_000 } }) @Post("refresh") refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.refresh(req, res); }
  @Post("logout") logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.logout(req, res); }
  @UseGuards(JwtAuthGuard) @Get("me") me(@Req() req: AuthRequest) { return this.auth.me(req.user.id); }
  @UseGuards(JwtAuthGuard, SystemGuard) @Get("system") system() { return { role: "SYSTEM", authorized: true }; }
}
