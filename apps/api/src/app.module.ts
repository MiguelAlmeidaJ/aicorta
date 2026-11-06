import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { RecoveryController, RecoveryService } from "./recovery";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PrismaService } from "./prisma.service";
import { AuthController, AuthService, JwtAuthGuard, SystemGuard } from "./auth";
import { HealthController } from "./health";
import { BookingController, BookingService } from "./booking";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: "../../.env" }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [HealthController, AuthController, RecoveryController, BookingController],
  providers: [PrismaService, AuthService, RecoveryService, JwtAuthGuard, SystemGuard, BookingService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
