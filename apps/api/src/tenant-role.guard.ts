import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "./prisma.service";

export type TenantPermission = "ADMIN" | "EMPLOYEE" | "CLIENT";
export const TENANT_ROLES = "aicorta:tenant-roles";
export const TenantRoles = (...roles: TenantPermission[]) => SetMetadata(TENANT_ROLES, roles);

/**
 * Requer JwtAuthGuard antes deste guard.
 * O tenant é obtido somente do parâmetro da rota e conferido no banco.
 */
@Injectable()
export class TenantRoleGuard implements CanActivate {
  constructor(private readonly db: PrismaService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<TenantPermission[]>(TENANT_ROLES, [
      context.getHandler(), context.getClass(),
    ]);
    if (!roles?.length) throw new ForbiddenException("Permissão não configurada");
    const request = context.switchToHttp().getRequest<{
      user?: { id: string };
      params: { tenantId?: string };
    }>();
    const userId = request.user?.id;
    const tenantId = request.params.tenantId;
    if (!userId || !tenantId) throw new ForbiddenException("Estabelecimento inválido");
    const membership = await this.db.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { role: true, isActive: true, tenant: { select: { status: true } } },
    });
    if (!membership?.isActive || membership.tenant.status !== "ACTIVE" || !roles.includes(membership.role)) {
      throw new ForbiddenException("Sem permissão neste estabelecimento");
    }
    return true;
  }
}
