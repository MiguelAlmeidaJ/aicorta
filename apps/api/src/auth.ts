import {
  Body, CanActivate, ConflictException, Controller, ExecutionContext, ForbiddenException,
  BadRequestException, Delete, Get, Injectable, NotFoundException, Patch, Post, Put, Req, Res, UnauthorizedException, UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IsEmail, IsOptional, IsString, Matches, MinLength, MaxLength } from "class-validator";
import { normalizeBrazilianWhatsapp, whatsappVariants } from "./phone";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response, CookieOptions } from "express";
import { PrismaService } from "./prisma.service";
import { Throttle } from "@nestjs/throttler";

function parseAvatar(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new BadRequestException("A foto deve estar em PNG ou JPG");
  const decoded = Buffer.from(match[2], "base64");
  const png = decoded.length > 8 && decoded.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = decoded.length > 3 && decoded[0] === 0xff && decoded[1] === 0xd8;
  if (decoded.length > 500 * 1024 || (match[1] === "image/png" ? !png : !jpeg)) throw new BadRequestException("Foto inválida ou maior que 500 KB");
  const bytes = new Uint8Array(decoded.length); bytes.set(decoded);
  return { mime: match[1], bytes };
}

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

export class RegisterClientDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsString() @Matches(/^[a-z0-9]{3,30}$/) username!: string;
  @IsEmail() email!: string;
  @IsString() whatsapp!: string;
  @IsString() @MinLength(10) password!: string;
}

export class LoginDto {
  @IsString() identifier!: string;
  @IsString() password!: string;
}
export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9]{3,30}$/) username?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() whatsapp?: string;
}
export class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(10) newPassword!: string;
}
export class UpdateAvatarDto { @IsString() imageDataUrl!: string; }

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

  async registerClient(dto: RegisterClientDto, res: Response) {
    const username = dto.username.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();
    const whatsapp = normalizeBrazilianWhatsapp(dto.whatsapp);
    if (!whatsapp) throw new BadRequestException("WhatsApp inválido: informe DDD + celular (11 dígitos).");
    const passwordHash = await hash(dto.password, 12);
    try {
      if (await this.db.user.findFirst({
        where: { whatsapp: { in: whatsappVariants(whatsapp) } }, select: { id: true },
      })) throw new ConflictException("WhatsApp já cadastrado");
      const user = await this.db.user.create({
        data: { name: dto.name.trim(), username, email, whatsapp, passwordHash },
      });
      await this.startSession(user.id, res);
      return { user: this.safeUser(user) };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
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
    const [user, branding] = await Promise.all([this.db.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { isActive: true }, select: { tenantId: true, role: true, tenant: { select: { name: true, slug: true, status: true } } } } },
    }), this.db.platformBrand.findUnique({ where: { id: "platform" }, select: { defaultProfileImageMime: true, updatedAt: true } })]);
    if (!user || !user.isActive) throw new UnauthorizedException();
    return { id: user.id, name: user.name, username: user.username, email: user.email, whatsapp: user.whatsapp,
      avatarUrl: user.avatarMime ? `/auth/avatar?v=${user.updatedAt.getTime()}` : branding?.defaultProfileImageMime ?
        `/branding/assets/avatar?v=${branding.updatedAt.getTime()}` : null,
      avatarIsDefault: !user.avatarMime && !!branding?.defaultProfileImageMime,
      globalRole: user.globalRole, isActive: user.isActive, memberships: user.memberships };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const parsedWhatsapp = dto.whatsapp === undefined ? undefined : normalizeBrazilianWhatsapp(dto.whatsapp);
    if (dto.whatsapp !== undefined && !parsedWhatsapp) throw new BadRequestException("WhatsApp inválido");
    const whatsapp = parsedWhatsapp ?? undefined;
    try {
      await this.db.user.update({ where: { id: userId }, data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.username !== undefined && { username: dto.username.trim().toLowerCase() }),
        ...(dto.email !== undefined && { email: dto.email.trim().toLowerCase() }),
        ...(whatsapp !== undefined && { whatsapp }),
      } });
      return this.me(userId);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ConflictException("Usuário, e-mail ou WhatsApp já cadastrado");
      }
      throw error;
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !(await compare(dto.currentPassword, user.passwordHash))) throw new UnauthorizedException("Senha atual incorreta");
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { passwordHash: await hash(dto.newPassword, 12), passwordChangedAt: new Date() } }),
      this.db.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { ok: true };
  }

  async updateAvatar(userId: string, dataUrl: string) {
    const image = parseAvatar(dataUrl);
    await this.db.user.update({ where: { id: userId }, data: { avatar: image.bytes, avatarMime: image.mime } });
    return this.me(userId);
  }
  async removeAvatar(userId: string) {
    await this.db.user.update({ where: { id: userId }, data: { avatar: null, avatarMime: null } });
    return this.me(userId);
  }
  async avatar(userId: string, res: Response) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { avatar: true, avatarMime: true } });
    if (!user?.avatar || !user.avatarMime) throw new NotFoundException("Foto de perfil não encontrada");
    res.setHeader("Content-Type", user.avatarMime); res.setHeader("Cache-Control", "private, max-age=3600");
    return res.send(Buffer.from(user.avatar));
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
  @Throttle({ default: { limit: 3, ttl: 60_000 } }) @Post("register-client") registerClient(@Body() dto: RegisterClientDto, @Res({ passthrough: true }) res: Response) { return this.auth.registerClient(dto, res); }
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) @Post("login") login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) { return this.auth.login(dto, res); }
  @Throttle({ default: { limit: 15, ttl: 60_000 } }) @Post("refresh") refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.refresh(req, res); }
  @Post("logout") logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.logout(req, res); }
  @UseGuards(JwtAuthGuard) @Get("me") me(@Req() req: AuthRequest) { return this.auth.me(req.user.id); }
  @UseGuards(JwtAuthGuard) @Patch("me") updateProfile(@Req() req: AuthRequest, @Body() dto: UpdateProfileDto) { return this.auth.updateProfile(req.user.id, dto); }
  @UseGuards(JwtAuthGuard) @Patch("password") changePassword(@Req() req: AuthRequest, @Body() dto: ChangePasswordDto) { return this.auth.changePassword(req.user.id, dto); }
  @UseGuards(JwtAuthGuard) @Put("avatar") updateAvatar(@Req() req: AuthRequest, @Body() dto: UpdateAvatarDto) { return this.auth.updateAvatar(req.user.id, dto.imageDataUrl); }
  @UseGuards(JwtAuthGuard) @Delete("avatar") removeAvatar(@Req() req: AuthRequest) { return this.auth.removeAvatar(req.user.id); }
  @UseGuards(JwtAuthGuard) @Get("avatar") avatar(@Req() req: AuthRequest, @Res() res: Response) { return this.auth.avatar(req.user.id, res); }
  @UseGuards(JwtAuthGuard, SystemGuard) @Get("system") system() { return { role: "SYSTEM", authorized: true }; }
}
