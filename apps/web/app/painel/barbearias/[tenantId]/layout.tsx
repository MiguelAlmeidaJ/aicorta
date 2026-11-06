"use client";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
export default function TenantLayout({ children }: { children: ReactNode }) {
  const { tenantId } = useParams<{ tenantId: string }>();
  return <DashboardShell mode="tenant" tenantId={tenantId}>{children}</DashboardShell>;
}
