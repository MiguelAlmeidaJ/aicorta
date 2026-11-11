"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiJson } from "../../lib/api";

type Session = { globalRole: string; memberships: {
  tenantId: string; role: string; tenant: { status: string } }[] };

export default function PanelEntry() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiJson<Session>("/auth/me").then(profile => {
      if (!active) return;
      if (["SYSTEM", "MANAGER"].includes(profile.globalRole)) { router.replace("/system"); return; }
      const member = profile.memberships.find(m =>
        ["ADMIN", "EMPLOYEE"].includes(m.role) && m.tenant.status === "ACTIVE");
      router.replace(member ? `/painel/barbearias/${member.tenantId}` : "/meus-agendamentos");
    }).catch(() => { if (active) setError("Não foi possível carregar seu perfil."); });
    return () => { active = false; };
  }, [router]);
  return <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#f6f7f4]">
    <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#e1e3dd] border-t-[#111]"/>
    <p className="text-sm text-[#858980]">{error || "Entrando no seu painel..."}</p>
    {error && <Link className="text-sm font-semibold underline" href="/admin/login">Voltar ao login</Link>}
  </main>;
}
