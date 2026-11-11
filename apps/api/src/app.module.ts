import { Module } from "@nestjs/common";
import { BrandingController, BrandingService } from "./branding";
import { DashboardController, DashboardService } from "./dashboard";
import { OwnerInviteController, OwnerInviteService } from "./owner-invite";
import { TenantCoverController, TenantSettingsController, TenantSettingsService } from "./tenant-settings";
import { PublicBookingController, PublicBookingService } from "./public-booking";
import { PublicDirectoryController, PublicDirectoryService } from "./public-directory";
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
import { AuthController, AuthService, JwtAuthGuard, PlatformStaffGuard, SystemGuard } from "./auth";
import { HealthController } from "./health";
import { BookingController, BookingService } from "./booking";
import { ServiceOrderController, ServiceOrderService } from "./service-orders";
import { CashController, CashService } from "./cash";
import { BillingController, BillingSchedulerService, BillingService } from "./billing";
import { PlatformFaqController, PlatformFaqService } from "./platform-faq";
import { ContactController, ContactService } from "./contact";
import { PlatformStaffController, PlatformStaffService, PlatformAuditService } from "./platform-staff";

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
  controllers: [PublicDirectoryController, PlatformStaffController, ContactController, HealthController, AuthController, RecoveryController, BookingController, ServiceOrderController, CashController, BillingController, PlatformFaqController, ServiceCatalogController, PeopleController, AgendaController, PublicBookingController, TenantSettingsController, TenantCoverController, OwnerInviteController, DashboardController, BrandingController],
  providers: [PublicDirectoryService, PlatformStaffGuard, PlatformStaffService, PlatformAuditService, ContactService, PrismaService, AuthService, RecoveryService, JwtAuthGuard, SystemGuard, BillingService, BillingSchedulerService, BookingService, ServiceOrderService, CashService, TenantRoleGuard, ServiceCatalogService, PeopleService, AgendaService, PublicBookingService, TenantSettingsService, OwnerInviteService, DashboardService, BrandingService, PlatformFaqService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
