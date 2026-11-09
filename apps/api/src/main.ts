import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, ForbiddenException } from "@nestjs/common";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";

async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("Defina JWT_SECRET com 32+ caracteres");
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Imagens de marca e serviços são enviadas em base64 após compressão no navegador.
  app.use(json({ limit: "750kb" }));
  app.use(urlencoded({ extended: true, limit: "750kb" }));
  app.setGlobalPrefix("api");
  const allowedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  app.enableCors({ origin: allowedOrigin, credentials: true });
  // Proteção de origem para requisições mutáveis baseadas em cookies (inclui localhost com portas diferentes).
  app.use((req: { method: string; headers: { origin?: string } }, _res: unknown, next: (error?: Error) => void) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin && req.headers.origin !== allowedOrigin) {
      return next(new ForbiddenException("Origem não permitida"));
    }
    next();
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(Number(process.env.API_PORT ?? 3001));
}
void bootstrap();
