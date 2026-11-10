import { Body, Controller, HttpCode, Injectable, Post, ServiceUnavailableException } from "@nestjs/common";
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import nodemailer from "nodemailer";

export const CONTACT_SUBJECTS = [
  "Quero usar o AICorta",
  "Dúvida sobre agendamento",
  "Suporte à plataforma",
  "Parceria ou comercial",
  "Outro assunto",
] as const;

export class PublicContactDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Matches(/^\+?[0-9()\s-]{10,22}$/, { message: "Informe um WhatsApp válido com DDD." })
  whatsapp!: string;
  @IsIn(CONTACT_SUBJECTS) subject!: (typeof CONTACT_SUBJECTS)[number];
  @IsString() @MinLength(10) @MaxLength(3000) description!: string;
  // Campo invisível: robôs que o preenchem não devem gerar e-mail.
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

export function composeContactMessage(dto: PublicContactDto) {
  const name = dto.name.trim();
  const email = dto.email.trim().toLowerCase();
  const whatsapp = dto.whatsapp.replace(/\D/g, "");
  const description = dto.description.trim();
  const subject = dto.subject;
  if (name.length < 2 || description.length < 10 || whatsapp.length < 10 || whatsapp.length > 13) {
    throw new Error("Dados de contato inválidos");
  }
  return {
    replyTo: { name, address: email },
    subject: `[AICorta - Contato] ${subject}`,
    text: [
      "Nova mensagem recebida pelo formulário público do AICorta.",
      "",
      `Nome: ${name}`,
      `E-mail: ${email}`,
      `WhatsApp: ${whatsapp}`,
      `Assunto: ${subject}`,
      "",
      "Descrição:",
      description,
      "",
      "Enviado pelo site público do AICorta.",
    ].join("\n"),
  };
}

@Injectable()
export class ContactService {
  async send(dto: PublicContactDto) {
    if (dto.website?.trim()) return { message: "Mensagem recebida." };
    const host = process.env.SMTP_HOST?.trim();
    const from = process.env.SMTP_FROM?.trim();
    const to = process.env.CONTACT_TO_EMAIL?.trim();
    if (!host || !from || !to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new ServiceUnavailableException("O contato por formulário está indisponível no momento. Tente novamente mais tarde.");
    }
    let mail: ReturnType<typeof composeContactMessage>;
    try { mail = composeContactMessage(dto); }
    catch { throw new ServiceUnavailableException("Não foi possível processar o contato."); }
    const port = Number(process.env.SMTP_PORT ?? "587");
    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465,
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      } : undefined,
    });
    try {
      await transporter.sendMail({ ...mail, from, to });
    } catch {
      throw new ServiceUnavailableException("Não foi possível enviar sua mensagem agora. Tente novamente mais tarde.");
    } finally {
      transporter.close();
    }
    return { message: "Mensagem enviada com sucesso. Nossa equipe poderá entrar em contato pelo e-mail ou WhatsApp informado." };
  }
}

@Controller("public/contact")
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  send(@Body() dto: PublicContactDto) { return this.contact.send(dto); }
}
