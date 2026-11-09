import { Module } from "@nestjs/common";
import { BrandingController, BrandingService } from "./branding";
import { DashboardController, DashboardService } from "./dashboard";
import { OwnerInviteController, OwnerInviteService } from "./owner-invite";
import { TenantCoverController, TenantSettingsController, TenantSettingsService } from "./tenant-settings";
import { PublicBookingController, PublicBookingService } from "./public-booking";
import { AgendaController, AgendaService } from "./agenda";
import { PeopleController, PeopleService } from "./people";
import { TenantRoleGuard } from "./tenant-role.guard";
import { ServiceCatalogController, ServiceCatalogService } from "./services";
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
  controllers: [HealthController, AuthController, RecoveryController, BookingController, ServiceCatalogController, PeopleController, AgendaController, PublicBookingController, TenantSettingsController, TenantCoverController, OwnerInviteController, DashboardController, BrandingController],
  providers: [PrismaService, AuthService, RecoveryService, JwtAuthGuard, SystemGuard, BookingService, TenantRoleGuard, ServiceCatalogService, PeopleService, AgendaService, PublicBookingService, TenantSettingsService, OwnerInviteService, DashboardService, BrandingService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
