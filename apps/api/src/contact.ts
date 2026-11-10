import { Body, Controller, HttpCode, Injectable, Post, ServiceUnavailableException } from "@nestjs/common";
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import nodemailer from "nodemailer";
import { PrismaService } from "./prisma.service";

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

type MailBrand = { name?: string | null; gold?: string | null;
  logo?: Uint8Array | null; logoMime?: string | null };

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function mailColor(value?: string | null) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#E5BF4B";
}
function whatsappDisplay(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return digits;
}
function whatsappLink(digits: string) {
  return `https://wa.me/${digits.startsWith("55") && digits.length > 11 ? digits : "55" + digits}`;
}
function contactHtml(data: { name: string; email: string; whatsapp: string; subject: string; description: string },
    brand: MailBrand = {}) {
  const gold = mailColor(brand.gold);
  const brandName = escapeHtml(brand.name?.trim() || "AICorta");
  const logoReady = !!brand.logo?.length && ["image/png", "image/jpeg"].includes(brand.logoMime ?? "");
  const logo = logoReady
    ? '<img src="cid:aicorta-contact-logo" alt="' + brandName + '" width="166" style="display:block;max-width:166px;max-height:64px;width:auto;height:auto;border:0" />'
    : '<span style="font-size:24px;font-weight:800;letter-spacing:-1px;color:#ffffff;">' + brandName + '</span>';
  const e = escapeHtml(data.email);
  const name = escapeHtml(data.name);
  const subject = escapeHtml(data.subject);
  const description = escapeHtml(data.description).replace(/\r\n|\r|\n/g, "<br />");
  const phone = escapeHtml(whatsappDisplay(data.whatsapp));
  const mailto = "mailto:" + encodeURIComponent(data.email);
  const wa = whatsappLink(data.whatsapp);
  // Layout de tabelas e CSS inline: mantém legibilidade em Gmail, Outlook e aplicativos móveis.
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Contato AICorta</title></head>
<body style="margin:0;padding:0;background:#F3F4F0;font-family:Arial,Helvetica,sans-serif;color:#20241F">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F3F4F0">
<tr><td align="center" style="padding:32px 14px 40px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px">
<tr><td style="background:#1A1D19;border-radius:16px 16px 0 0;padding:24px 32px;border-bottom:3px solid ${gold}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td valign="middle">${logo}</td>
<td align="right" valign="middle" style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#C5CBBF">NOVO CONTATO</td>
</tr></table></td></tr>
<tr><td style="background:#FFFFFF;padding:32px 32px 10px">
<div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#97752F;text-transform:uppercase;margin-bottom:12px">FORMULÁRIO DO SITE</div>
<h1 style="font-family:Arial,Helvetica,sans-serif;font-size:25px;line-height:1.25;letter-spacing:-.6px;margin:0 0 12px;color:#1F251F">Você recebeu uma mensagem.</h1>
<p style="font-size:14px;line-height:1.65;margin:0 0 24px;color:#798176">Um visitante entrou em contato pelo site público do AICorta. Confira os dados abaixo.</p>
<div style="border:1px solid #E7E9E3;border-radius:10px;overflow:hidden;margin:0 0 24px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td colspan="2" style="padding:13px 17px;background:#F5F6F2;font-size:10px;font-weight:700;letter-spacing:1px;color:#798275;text-transform:uppercase">INFORMAÇÕES DO CONTATO</td></tr>
<tr><td style="padding:12px 17px 5px;font-size:12px;color:#848C81;width:100px">Nome</td><td style="padding:12px 17px 5px;font-size:14px;font-weight:700;color:#252C24;word-break:break-word">${name}</td></tr>
<tr><td style="padding:8px 17px 5px;font-size:12px;color:#848C81">E-mail</td><td style="padding:8px 17px 5px;font-size:13px;word-break:break-all"><a href="${mailto}" style="color:#2D5731;text-decoration:none">${e}</a></td></tr>
<tr><td style="padding:8px 17px 5px;font-size:12px;color:#848C81">WhatsApp</td><td style="padding:8px 17px 5px;font-size:13px"><a href="${wa}" style="color:#2D5731;text-decoration:none">${phone}</a></td></tr>
<tr><td style="padding:8px 17px 15px;font-size:12px;color:#848C81">Assunto</td><td style="padding:8px 17px 15px;font-size:13px;font-weight:700;color:#252C24">${subject}</td></tr>
</table></div>
<div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:#997A40;text-transform:uppercase;margin-bottom:10px">MENSAGEM RECEBIDA</div>
<div style="background:#F8F9F6;border-left:3px solid ${gold};padding:18px 20px;border-radius:0 9px 9px 0;font-size:14px;line-height:1.8;color:#394438;overflow-wrap:anywhere;word-break:break-word">${description}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:27px;margin-bottom:28px"><tr>
<td style="padding-right:7px"><a href="${mailto}" style="display:block;background:#1D221C;border-radius:9px;padding:14px 8px;text-align:center;color:#FFFFFF;font-size:12px;font-weight:700;text-decoration:none">Responder por e-mail</a></td>
<td style="padding-left:7px"><a href="${wa}" style="display:block;background:#F0F2EB;border:1px solid #DDE3D9;border-radius:9px;padding:13px 8px;text-align:center;color:#334632;font-size:12px;font-weight:700;text-decoration:none">Abrir WhatsApp</a></td>
</tr></table>
</td></tr>
<tr><td style="background:#F8F9F6;border-top:1px solid #E9EDE6;border-radius:0 0 16px 16px;padding:19px 32px">
<p style="margin:0;color:#8A9386;font-size:11px;line-height:1.7">Esta mensagem foi enviada pelo formulário público do AICorta. Responda diretamente ao visitante; não é necessário responder a este aviso automático.</p>
</td></tr>
<tr><td align="center" style="padding:22px 10px;color:#9AA397;font-size:11px">AICorta · Gestão inteligente para barbearias</td></tr>
</table></td></tr></table></body></html>`;
}

export function composeContactMessage(dto: PublicContactDto, brand: MailBrand = {}) {
  const name = dto.name.trim();
  const email = dto.email.trim().toLowerCase();
  const whatsapp = dto.whatsapp.replace(/\D/g, "");
  const description = dto.description.trim();
  const subject = dto.subject;
  if (name.length < 2 || description.length < 10 || whatsapp.length < 10 || whatsapp.length > 13) {
    throw new Error("Dados de contato inválidos");
  }
  return {
    ...((brand.logo?.length && ["image/png", "image/jpeg"].includes(brand.logoMime ?? "")) ? {
      attachments: [{ filename: brand.logoMime === "image/png" ? "aicorta.png" : "aicorta.jpg",
        content: Buffer.from(brand.logo), contentType: brand.logoMime ?? "image/png", cid: "aicorta-contact-logo" }],
    } : {}),
    html: contactHtml({name,email,whatsapp,subject,description},brand),
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
  constructor(private readonly db: PrismaService) {}

  async send(dto: PublicContactDto) {
    if (dto.website?.trim()) return { message: "Mensagem recebida." };
    const host = process.env.SMTP_HOST?.trim();
    const from = process.env.SMTP_FROM?.trim();
    const to = process.env.CONTACT_TO_EMAIL?.trim();
    if (!host || !from || !to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new ServiceUnavailableException("O contato por formulário está indisponível no momento. Tente novamente mais tarde.");
    }
    let mail: ReturnType<typeof composeContactMessage>;
    try {
      // A logo publicada no SYSTEM é anexada inline (CID): não depende de carregamento externo.
      const brand = await this.db.platformBrand.findUnique({
        where: { id: "platform" }, select: { name: true, gold: true, logo: true, logoMime: true },
      });
      mail = composeContactMessage(dto, brand ?? {});
    }
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
