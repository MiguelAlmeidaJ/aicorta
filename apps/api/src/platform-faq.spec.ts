import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PlatformFaqService, SaveFaqDto } from "./platform-faq";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

test("FAQ público exibe somente perguntas ativas e ordenadas", async () => {
  let where: unknown; let orderBy: unknown;
  const db = { platformFaq: { findMany: async (options: { where: unknown; orderBy: unknown }) => {
    where = options.where; orderBy = options.orderBy;
    return [{ id: "faq-a", question: "Como reservar?", answer: "Escolha o horário." }];
  } } };
  const faq = new PlatformFaqService(db as never);
  const result = await faq.publicList();
  assert.equal(result.length, 1);
  assert.deepEqual(where, { isActive: true });
  assert.deepEqual(orderBy, [{ position: "asc" }, { createdAt: "asc" }]);
});

test("FAQ publicado é atualizado em transação única", async () => {
  const operations: string[] = [];
  const db = {
    platformFaq: {
      deleteMany: async () => { operations.push("delete"); },
      createMany: async ({ data }: { data: Array<{ question: string; position: number }> }) => {
        operations.push("insert");
        assert.equal(data[0].question, "Como fazer uma reserva?");
        assert.equal(data[0].position, 0);
      },
      findMany: async () => [],
    },
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(db),
  };
  const faq = new PlatformFaqService(db as never);
  await faq.replace([{ question: "  Como fazer uma reserva?  ", answer: " Escolha uma barbearia e confirme. ", isActive: true }]);
  assert.deepEqual(operations,["delete","insert"]);
});

test("FAQ rejeita itens inválidos e mais de 20 perguntas", async () => {
  const invalid = plainToInstance(SaveFaqDto, {
    items: [{ question:"Curta", answer:"Não", isActive:"sim" }],
  });
  assert.ok((await validate(invalid)).length > 0);
  const tooMany = plainToInstance(SaveFaqDto, {
    items: Array.from({length:21},()=>({question:"Como funciona a reserva?",answer:"Escolha um horário disponível.",isActive:true})),
  });
  assert.ok((await validate(tooMany)).length > 0);
});
