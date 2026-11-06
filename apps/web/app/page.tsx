import Link from "next/link";
export default function HomePage() {
  return <main className="shell">
    <header className="nav"><strong className="brand">✂ AICorta</strong><Link href="/login">Entrar</Link></header>
    <section className="hero">
      <span className="eyebrow">A agenda da sua barbearia, em um só lugar</span>
      <h1>Menos tempo organizando. <em>Mais tempo cortando.</em></h1>
      <p>Agendamentos, equipe, serviços e clientes, com cada barbearia no seu próprio espaço.</p>
      <div className="actions"><Link className="button" href="/cadastro">Cadastrar barbearia</Link><Link className="ghost" href="/login">Já tenho conta</Link></div>
    </section>
    <footer>© AICorta · Base beta</footer>
  </main>;
}
