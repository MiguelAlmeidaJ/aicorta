-- Perguntas iniciais editáveis pelo SYSTEM. Não altera o conteúdo se já houver FAQ.
INSERT INTO "PlatformFaq" ("id", "question", "answer", "position", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), initial.question, initial.answer, initial.position, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  (0, 'Como faço um agendamento?',
    'Escolha uma barbearia, selecione os serviços, o profissional e um horário disponível. Entre na sua conta para confirmar a reserva.'),
  (1, 'Posso reagendar ou cancelar uma reserva?',
    'Acesse Meus agendamentos para consultar sua reserva. Se estiver dentro das regras de antecedência, você poderá reagendar ou cancelar.'),
  (2, 'Como encontro o endereço da barbearia?',
    'Consulte as informações do estabelecimento ou a opção Mapa. As localizações exibidas são cadastradas pelos próprios estabelecimentos.'),
  (3, 'Como funciona o pagamento?',
    'O pagamento é realizado diretamente no estabelecimento, nas formas aceitas pela barbearia. O AICorta não processa pagamentos de atendimentos.'),
  (4, 'Preciso criar uma conta de cliente?',
    'Sim. Sua conta permite confirmar e acompanhar seus agendamentos em um único lugar.')
) AS initial(position, question, answer)
WHERE NOT EXISTS (SELECT 1 FROM "PlatformFaq");
