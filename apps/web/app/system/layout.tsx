"use client";
import type { ReactNode } from "react";
import { DashboardShell } from "../../components/dashboard/dashboard-shell";
export default function SystemLayout({ children }: { children: ReactNode }) {
  return <DashboardShell mode="system">{children}</DashboardShell>;
}
