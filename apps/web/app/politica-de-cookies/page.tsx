import type { Metadata } from "next";
import { PublicLegalPage } from "../../components/public/public-legal-page";

export const metadata: Metadata = { title: "Política de cookies | AICorta", description: "Saiba como cookies e sessões são utilizados no AICorta." };

export default function CookiesPage() {
  return <PublicLegalPage eyebrow="Navegação e sessão" title="Política de cookies"
    intro="Os cookies ajudam a manter o acesso à conta e a continuidade da navegação. Veja como esses recursos funcionam no AICorta."
    sections={[
      { heading:"O que são cookies", body:[
        "Cookies são pequenos dados que o navegador pode armazenar para reconhecer uma sessão e manter funcionalidades disponíveis entre requisições.",
      ]},
      { heading:"Cookies de autenticação", body:[
        "O AICorta utiliza cookies de sessão e renovação de acesso para identificar usuários autenticados. Esses cookies são configurados com a propriedade HttpOnly e SameSite=Lax, e utilizam Secure quando a aplicação está em produção sob HTTPS.",
        "Esses recursos são necessários para entrar na conta e acessar áreas restritas. Sem eles, funcionalidades autenticadas podem não funcionar.",
      ]},
      { heading:"Serviços externos", body:[
        "A visualização do mapa e a consulta de endereços podem envolver serviços externos, como provedores de mapas e geocodificação. Esses fornecedores podem processar informações técnicas de conexão conforme suas próprias políticas.",
        "Fotografias públicas carregadas de serviços externos também podem gerar requisições aos respectivos fornecedores.",
      ]},
      { heading:"Como gerenciar cookies", body:[
        "Você pode consultar, bloquear ou apagar cookies nas configurações do navegador. A exclusão de cookies de autenticação pode encerrar a sessão ou exigir novo login.",
        "Caso sejam incluídas futuramente ferramentas de análise, publicidade ou outros cookies opcionais, esta política e os controles de consentimento deverão ser atualizados antes da ativação dessas ferramentas.",
      ]},
      { heading:"Alterações da política", body:[
        "As informações devem acompanhar os recursos efetivamente utilizados pela plataforma. Recomenda-se revisar periodicamente esta política e as integrações técnicas utilizadas no ambiente de produção.",
      ]},
    ]}/>;
}
