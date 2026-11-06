import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PrismaService } from "./prisma.service";
import { AuthController, AuthService, JwtAuthGuard, SystemGuard } from "./auth";
import { HealthController } from "./health";
import { BookingController, BookingService } from "./booking";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: "../../.env" }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [HealthController, AuthController, BookingController],
  providers: [PrismaService, AuthService, JwtAuthGuard, SystemGuard, BookingService],
})
export class AppModule {}
