import { Body, ConflictException, Controller, Get, Injectable, Post, Req, UnauthorizedException, UseGuards, CanActivate, ExecutionContext, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { IsEmail, IsString, MinLength, Matches } from "class-validator";
import { compare, hash } from "bcryptjs";
import { PrismaService } from "./prisma.service";

export class RegisterDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @Matches(/^[a-z0-9._-]{3,30}$/) username!: string;
  @IsEmail() email!: string;
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/) whatsapp!: string;
  @IsString() @MinLength(10) password!: string;
  @IsString() @MinLength(2) businessName!: string;
  @IsString() @Matches(/^[a-z0-9-]{3,50}$/) businessSlug!: string;
}

export class LoginDto {
  @IsString() identifier!: string;
  @IsString() password!: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly db: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET inseguro ou ausente");
    const username = dto.username.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();
    const whatsapp = dto.whatsapp.trim();
    const slug = dto.businessSlug.trim().toLowerCase();
    try {
      const account = await this.db.$transaction(async tx => {
        const user = await tx.user.create({
          data: { name: dto.name.trim(), username, email, whatsapp, passwordHash: await hash(dto.password, 12) },
        });
        const tenant = await tx.tenant.create({
          data: { name: dto.businessName.trim(), slug, ownerId: user.id },
        });
        await tx.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: "ADMIN" } });
        return { user, tenant };
      });
      return { user: this.safeUser(account.user), tenant: { id: account.tenant.id, slug: account.tenant.slug }, accessToken: await this.sign(account.user.id) };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") throw new ConflictException("Usuário, e-mail, WhatsApp ou slug já cadastrado");
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim().toLowerCase();
    const user = await this.db.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }, { whatsapp: dto.identifier.trim() }] },
    });
    if (!user || !user.isActive || !(await compare(dto.password, user.passwordHash))) throw new UnauthorizedException("Credenciais inválidas");
    return { user: this.safeUser(user), accessToken: await this.sign(user.id) };
  }

  async me(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { isActive: true }, select: { tenantId: true, role: true, tenant: { select: { name: true, slug: true, status: true } } } } },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    const { passwordHash, ...safe } = user;
    return safe;
  }

  private safeUser(user: { id: string; name: string; username: string; email: string; whatsapp: string; globalRole: string }) {
    return { id: user.id, name: user.name, username: user.username, email: user.email, whatsapp: user.whatsapp, globalRole: user.globalRole };
  }

  private sign(sub: string) { return this.jwt.signAsync({ sub }); }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: { id: string } }>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException("Token ausente");
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.db.user.findUnique({ where: { id: payload.sub }, select: { id: true, isActive: true } });
      if (!user?.isActive) throw new UnauthorizedException();
      request.user = { id: user.id };
      return true;
    } catch { throw new UnauthorizedException("Token inválido"); }
  }
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post("register") register(@Body() dto: RegisterDto) { return this.auth.register(dto); }
  @Post("login") login(@Body() dto: LoginDto) { return this.auth.login(dto); }
  @UseGuards(JwtAuthGuard) @Get("me") me(@Req() req: { user: { id: string } }) { return this.auth.me(req.user.id); }
}
