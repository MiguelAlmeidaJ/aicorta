import type { Metadata } from "next";
import "./globals.css";
import { BrandProvider } from "../components/brand/brand-provider";

export const metadata: Metadata = { title: "AICorta | Agendamento para barbearias", description: "A agenda inteligente da sua barbearia." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><BrandProvider>{children}</BrandProvider></body></html>;
}
