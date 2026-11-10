import type { Metadata } from "next";
import { PublicLegalPage } from "../../components/public/public-legal-page";

export const metadata: Metadata = { title: "Privacidade e LGPD | AICorta", description: "Informações sobre dados pessoais utilizados no AICorta." };

export default function PrivacyPage() {
  return <PublicLegalPage eyebrow="Transparência e proteção de dados" title="Privacidade e LGPD"
    intro="Entenda quais informações podem ser utilizadas para operar a plataforma de agendamentos e como solicitar informações ou exercer seus direitos sobre dados pessoais."
    sections={[
      { heading:"Dados utilizados na plataforma", body:[
        "O AICorta utiliza informações fornecidas no cadastro, como nome, nome de usuário, e-mail e telefone, além de dados necessários para identificar a barbearia, o profissional e o serviço escolhido.",
        "Para realizar e acompanhar agendamentos, são tratados registros de reservas, horários, serviços e histórico de atendimento. Estabelecimentos podem cadastrar imagens, endereços e informações de equipe.",
      ]},
      { heading:"Para que os dados são utilizados", body:[
        "As informações são utilizadas para autenticar contas, manter a agenda, permitir reservas, administrar estabelecimentos e prestar suporte. As operações de tratamento devem observar as bases legais aplicáveis da Lei Geral de Proteção de Dados (LGPD).",
        "A localização de um estabelecimento é cadastrada pelo responsável. A geolocalização do dispositivo só é solicitada após uma ação explícita de quem utiliza o recurso.",
      ]},
      { heading:"Estabelecimentos e prestadores técnicos", body:[
        "A barbearia acessa os dados necessários para atender os agendamentos realizados em seu estabelecimento. Serviços técnicos de infraestrutura, mapas ou consulta de endereços podem tratar informações indispensáveis à execução da funcionalidade solicitada.",
        "Cada estabelecimento deve adotar cuidados adequados ao uso dos dados de clientes e colaboradores em sua operação.",
      ]},
      { heading:"Segurança, acesso e conservação", body:[
        "A plataforma utiliza controles de autenticação, sessões e autorização de acesso. Nenhum sistema conectado à internet oferece garantia absoluta de segurança.",
        "Os períodos efetivos de conservação e a política de exclusão precisam ser observados conforme as necessidades operacionais e obrigações legais aplicáveis. Solicitações específicas devem ser encaminhadas aos canais oficiais de suporte.",
      ]},
      { heading:"Seus direitos", body:[
        "Nos termos da LGPD, conforme o caso, você pode solicitar confirmação de tratamento, acesso, correção, informações sobre compartilhamento, portabilidade, anonimização, bloqueio ou eliminação de dados e outras providências previstas em lei.",
        "Se a solicitação envolver dados de uma reserva ou atendimento, pode ser necessário o contato com a barbearia responsável. Para assuntos relacionados à plataforma, utilize a página de Contato.",
      ]},
      { heading:"Atualizações desta política", body:[
        "Este texto apresenta as práticas e funcionalidades gerais da plataforma. Alterações nos serviços, integrações e procedimentos podem exigir a revisão do documento. Recomenda-se uma validação jurídica antes de seu uso como política definitiva em produção.",
      ]},
    ]}/>;
}
