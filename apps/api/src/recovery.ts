import { Body, Controller, Injectable, Post, ServiceUnavailableException, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { IsEmail, IsString, MinLength } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import nodemailer from "nodemailer";
import { PrismaService } from "./prisma.service";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const generic = { message: "Se o e-mail estiver cadastrado, enviaremos instruções para redefinir a senha." };

export class ForgotPasswordDto {
  @IsEmail() email!: string;
}
export class ResetPasswordDto {
  @IsString() token!: string;
  @IsString() @MinLength(10) password!: string;
}
@Injectable()
export class RecoveryService {
  constructor(private readonly db: PrismaService) {}
  async forgot(emailInput: string) {
    const email = emailInput.trim().toLowerCase();
    const host = process.env.SMTP_HOST;
    const from = process.env.SMTP_FROM;
    // Manter resposta indistinguível quando a entrega de e-mail ainda não está configurada.
    if (!host || !from) return generic;
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
    if (!user?.isActive) return generic;
    const token = randomBytes(32).toString("base64url");
    const tokenHash = digest(token);
    const record = await this.db.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 15 * 60_000) },
    });
    const origin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    const url = new URL("/redefinir-senha", origin);
    url.searchParams.set("token", token);
    const transporter = nodemailer.createTransport({
      host, port: Number(process.env.SMTP_PORT ?? "587"),
      secure: Number(process.env.SMTP_PORT ?? "587") === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    try {
      await transporter.sendMail({
        from, to: email, subject: "AICorta — redefinição de senha",
        text: `Recebemos uma solicitação para redefinir sua senha. Este link expira em 15 minutos:\n\n${url.toString()}\n\nSe não foi você, ignore este e-mail.`,
      });
    } catch {
      await this.db.passwordReset.delete({ where: { id: record.id } });
      throw new ServiceUnavailableException("Não foi possível enviar o e-mail agora");
    }
    return generic;
  }

  async reset(token: string, password: string) {
    if (token.length < 20 || token.length > 256) throw new BadRequestException("Token inválido");
    const tokenHash = digest(token);
    const now = new Date();
    const passwordHash = await hash(password, 12);
    await this.db.$transaction(async tx => {
      const consumed = await tx.passwordReset.updateMany({
        where: { tokenHash, consumedAt: null, expiresAt: { gt: now }, user: { isActive: true } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new UnauthorizedException("Link inválido ou expirado");
      const record = await tx.passwordReset.findUniqueOrThrow({ where: { tokenHash } });
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash, passwordChangedAt: now } });
      await tx.authSession.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.passwordReset.updateMany({ where: { userId: record.userId, consumedAt: null }, data: { consumedAt: now } });
    });
    return { message: "Senha redefinida. Faça login novamente." };
  }
}
@Controller("auth")
export class RecoveryController {
  constructor(private readonly recovery: RecoveryService) {}
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post("forgot-password") forgot(@Body() dto: ForgotPasswordDto) { return this.recovery.forgot(dto.email); }
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("reset-password") reset(@Body() dto: ResetPasswordDto) { return this.recovery.reset(dto.token, dto.password); }
}
