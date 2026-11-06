import { BrandLogo } from "../components/brand/brand-provider";
import Link from "next/link";
export default function HomePage() {
  return <main className="shell">
    <header className="nav"><BrandLogo className="h-12 max-w-[230px]"/><Link href="/login">Entrar</Link></header>
    <section className="hero">
      <span className="eyebrow">A agenda da sua barbearia, em um só lugar</span>
      <h1>Menos tempo organizando. <em>Mais tempo cortando.</em></h1>
      <p>Agendamentos, equipe, serviços e clientes, com cada barbearia no seu próprio espaço.</p>
      <div className="actions"><Link className="button" href="/cadastro-cliente">Criar conta de cliente</Link><Link href="/login">Acessar minha conta</Link><span className="ghost">Cadastro de barbearias somente por convite.</span></div>
    </section>
    <footer>© AICorta · Base beta</footer>
  </main>;
}
