import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

config({ path: resolve(process.cwd(), "../../.env") });

async function main() {
  const name = (process.env.SYSTEM_NAME ?? "").trim();
  const username = (process.env.SYSTEM_USERNAME ?? "").trim().toLowerCase();
  const email = (process.env.SYSTEM_EMAIL ?? "").trim().toLowerCase();
  const whatsapp = (process.env.SYSTEM_WHATSAPP ?? "").trim();
  const password = process.env.SYSTEM_PASSWORD ?? "";
  if (!name || !/^[a-z0-9._-]{3,30}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !/^\+[1-9]\d{7,14}$/.test(whatsapp) || password.length < 16) {
    throw new Error("Configure SYSTEM_NAME, SYSTEM_USERNAME, SYSTEM_EMAIL, SYSTEM_WHATSAPP (E.164) e SYSTEM_PASSWORD (16+ caracteres).");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const found = await db.user.findFirst({ where: { OR: [{ username }, { email }, { whatsapp }] } });
    if (found) {
      if (found.globalRole === "SYSTEM" && found.username === username && found.email === email && found.whatsapp === whatsapp) {
        console.log("Usuário SYSTEM já existe; nenhuma alteração realizada.");
        return;
      }
      throw new Error("Identificador já utilizado. O script nunca promove contas existentes a SYSTEM.");
    }
    await db.user.create({
      data: { name, username, email, whatsapp, passwordHash: await hash(password, 12), globalRole: "SYSTEM" },
    });
    console.log("Usuário SYSTEM criado com sucesso.");
  } finally {
    await db.$disconnect();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
