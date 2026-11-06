import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "AICorta | Agendamento para barbearias", description: "A agenda inteligente da sua barbearia." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
