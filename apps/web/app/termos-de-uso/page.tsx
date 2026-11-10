import type { Metadata } from "next";
import { PublicLegalPage } from "../../components/public/public-legal-page";

export const metadata: Metadata = { title: "Termos de uso | AICorta", description: "Condições gerais de utilização da plataforma AICorta." };

export default function TermsPage() {
  return <PublicLegalPage eyebrow="Utilização da plataforma" title="Termos de uso"
    intro="Estas condições apresentam orientações gerais para utilizar os recursos de agendamento e gestão de barbearias do AICorta."
    sections={[
      { heading:"Finalidade do serviço", body:[
        "O AICorta disponibiliza ferramentas digitais para encontrar estabelecimentos, consultar serviços e horários, realizar agendamentos e administrar a operação de barbearias cadastradas.",
        "Informações sobre profissionais, serviços, valores, horários, localização e disponibilidade são mantidas pelos responsáveis pelos estabelecimentos.",
      ]},
      { heading:"Cadastro e acesso", body:[
        "Quem utiliza uma conta deve fornecer informações adequadas, proteger suas credenciais e evitar compartilhar o acesso com terceiros. O estabelecimento é responsável pelo gerenciamento de sua equipe e pelas permissões concedidas.",
        "O acesso ao painel de gestão é disponibilizado conforme a vinculação do usuário ao estabelecimento e a situação de sua conta.",
      ]},
      { heading:"Reservas, atendimentos e pagamentos", body:[
        "Agendamentos estão sujeitos à disponibilidade, às regras de antecedência e aos critérios de cancelamento ou reagendamento apresentados pelo sistema.",
        "Os pagamentos pelos serviços são realizados diretamente no estabelecimento, pelos meios aceitos pela barbearia. O AICorta não processa o pagamento do corte ou de outros atendimentos.",
      ]},
      { heading:"Responsabilidade dos estabelecimentos", body:[
        "O estabelecimento é responsável pela prestação do serviço, pela precisão das informações publicadas, pelo atendimento ao cliente e pelas obrigações legais aplicáveis à sua atividade.",
        "A plataforma oferece os recursos tecnológicos de gestão e reservas, mas não executa os atendimentos presenciais.",
      ]},
      { heading:"Licenciamento de uso da plataforma", body:[
        "O acesso administrativo das barbearias depende de cadastro autorizado e das condições comerciais estabelecidas com o operador do AICorta. A mensalidade de utilização da plataforma, quando aplicável, é tratada fora do sistema.",
        "O acesso pode estar sujeito à suspensão em situações previstas nas condições comerciais, respeitados os direitos aplicáveis.",
      ]},
      { heading:"Uso adequado, suporte e atualizações", body:[
        "Não é permitido utilizar a plataforma de forma fraudulenta, tentar acessar dados de terceiros sem autorização ou interferir na segurança e disponibilidade do serviço.",
        "Dúvidas podem ser encaminhadas pela página de Contato. Estas condições deverão ser revisadas conforme as regras comerciais e jurídicas definitivas da operação antes da publicação em produção.",
      ]},
    ]}/>;
}
