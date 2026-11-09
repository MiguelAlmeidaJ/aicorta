"use client";

/* eslint-disable @next/next/no-img-element -- avatar autenticado servido pela API */
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Save, Trash2, UserRound } from "lucide-react";
import { BrandLogo } from "../../components/brand/brand-provider";
import { UserMenu } from "../../components/auth/user-menu";
import { ProfileImageCrop } from "../../components/profile/profile-image-crop";
import { API_URL, apiFetch, apiJson, mutation } from "../../lib/api";

type Profile = { id: string; name: string; username: string; email: string; whatsapp: string; avatarUrl: string | null; avatarIsDefault: boolean };
const field = "mt-2 w-full rounded-xl border border-[#dfe2da] bg-white px-4 py-3 text-sm outline-none focus:border-[#171916]";

export default function MyAccountPage() {
  const router = useRouter();
  const pathname = usePathname();
  const embedded = pathname !== "/minha-conta";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const handleAvatar = useCallback((data: string | null) => setAvatar(data ?? undefined), []);
  useEffect(() => {
    let active = true;
    apiJson<Profile>("/auth/me").then(value => { if (active) setProfile(value); })
      .catch(() => router.replace(`${embedded ? "/admin/login" : "/login"}?next=${encodeURIComponent(pathname)}`));
    return () => { active = false; };
  }, [embedded, pathname, router]);
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!profile) return; setSaving(true); setError(""); setMessage("");
    try {
      let saved = await apiJson<Profile>("/auth/me", mutation("PATCH", { name: profile.name, username: profile.username, email: profile.email, whatsapp: profile.whatsapp }));
      if (avatar) saved = await apiJson<Profile>("/auth/avatar", mutation("PUT", { imageDataUrl: avatar }));
      else if (avatar === null && profile.avatarUrl) saved = await apiJson<Profile>("/auth/avatar", { method: "DELETE" });
      setProfile(saved); setAvatar(undefined);
      window.dispatchEvent(new CustomEvent("aicorta:profile-updated", { detail: saved }));
      setMessage("Seus dados foram atualizados.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const currentPassword = String(data.get("currentPassword")); const newPassword = String(data.get("newPassword")); const confirmation = String(data.get("confirmation"));
    if (newPassword !== confirmation) { setError("A confirmação da nova senha não confere."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      await apiJson("/auth/password", mutation("PATCH", { currentPassword, newPassword }));
      await apiFetch("/auth/logout", { method: "POST" }).catch(() => null); router.replace(`${embedded ? "/admin/login" : "/login"}?passwordChanged=1`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível trocar a senha."); setSaving(false); }
  }
  return <main className={embedded ? "text-[#171916]" : "min-h-screen bg-[#f5f6f2] text-[#171916]"}>
    {!embedded ? <header className="border-b border-[#e4e6df] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8"><Link href="/"><BrandLogo className="h-11 max-w-[200px]"/></Link><UserMenu profile={profile}/></div></header> : null}
    <div className={`mx-auto max-w-6xl ${embedded ? "pb-10" : "px-5 py-10 sm:px-8"}`}>{!embedded ? <Link href="/painel" className="inline-flex items-center gap-2 text-xs font-semibold text-[#6f756c]"><ArrowLeft size={15}/> Voltar</Link> : null}
      <div className={embedded ? "" : "mt-6"}><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8b9087]">Perfil</p><h1 className="mt-2 text-4xl font-bold tracking-[-.05em]">Minha conta</h1><p className="mt-3 text-sm text-[#747a70]">Atualize seus dados, foto e credenciais de acesso.</p></div>
      {error ? <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}{message ? <p role="status" className="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p> : null}
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <form onSubmit={saveProfile} className="rounded-2xl border border-[#e2e4dd] bg-white p-6 sm:p-8"><div className="flex items-center gap-3"><UserRound/><div><h2 className="font-bold">Informações pessoais</h2><p className="text-xs text-[#8a8f86]">Dados usados em reservas e no painel.</p></div></div>
          {profile ? <div className="mt-7 space-y-5"><div><p className="mb-3 text-xs font-semibold">Foto de perfil</p>{profile.avatarUrl && avatar === undefined ? <div className="flex items-center gap-4"><img src={`${API_URL}${profile.avatarUrl}`} alt="Foto de perfil" className="h-24 w-24 rounded-full object-cover"/><div>{profile.avatarIsDefault ? <p className="text-xs text-[#858a81]">Imagem padrão da plataforma</p> : <button type="button" onClick={() => setAvatar(null)} className="flex items-center gap-2 text-xs font-semibold text-red-700"><Trash2 size={14}/> Remover foto</button>}<button type="button" onClick={() => setAvatar("")} className="mt-2 text-xs font-semibold underline">Enviar outra foto</button></div></div> : avatar === null ? <button type="button" className="text-xs font-semibold underline" onClick={() => setAvatar(undefined)}>Manter foto atual</button> : <ProfileImageCrop onChange={handleAvatar} onCancel={() => setAvatar(undefined)}/>}</div>
            <label className="block text-xs font-semibold">Nome completo<input required minLength={2} className={field} value={profile.name} onChange={event => setProfile({ ...profile, name: event.target.value })}/></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Usuário<input required pattern="[a-z0-9]{3,30}" className={field} value={profile.username} onChange={event => setProfile({ ...profile, username: event.target.value.toLowerCase() })}/></label><label className="text-xs font-semibold">WhatsApp<input required className={field} value={profile.whatsapp} onChange={event => setProfile({ ...profile, whatsapp: event.target.value })}/></label></div>
            <label className="block text-xs font-semibold">E-mail<input required type="email" className={field} value={profile.email} onChange={event => setProfile({ ...profile, email: event.target.value })}/></label>
            <button disabled={saving} className="flex items-center gap-2 rounded-xl bg-[#171916] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Save size={16}/>{saving ? "Salvando..." : "Salvar informações"}</button></div> : <div className="mt-7 h-80 animate-pulse rounded-xl bg-[#f0f1ed]"/>}
        </form>
        <form id="senha" onSubmit={changePassword} className="scroll-mt-24 rounded-2xl border border-[#e2e4dd] bg-white p-6 sm:p-8"><div className="flex items-center gap-3"><KeyRound/><div><h2 className="font-bold">Trocar senha</h2><p className="text-xs text-[#8a8f86]">Você entrará novamente após a troca.</p></div></div>
          <div className="mt-7 space-y-5"><label className="block text-xs font-semibold">Senha atual<input name="currentPassword" type="password" required autoComplete="current-password" className={field}/></label><label className="block text-xs font-semibold">Nova senha<input name="newPassword" type="password" minLength={10} required autoComplete="new-password" className={field}/></label><label className="block text-xs font-semibold">Confirmar nova senha<input name="confirmation" type="password" minLength={10} required autoComplete="new-password" className={field}/></label><button disabled={saving} className="w-full rounded-xl border border-[#dfe2da] px-5 py-3 text-sm font-bold hover:bg-[#f4f5f1] disabled:opacity-50">Atualizar senha</button></div>
        </form>
      </div>
    </div>
  </main>;
}
