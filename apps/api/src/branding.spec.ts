import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validate } from "class-validator";
import { BadRequestException } from "@nestjs/common";
import { BrandingService, UpdateBrandingDto } from "./branding";

test("branding DTO accepts valid official palette and rejects malformed hex", async () => {
  const dto = new UpdateBrandingDto();
  dto.name = "AICorta";
  dto.black = "#000000";
  dto.navy = "#050A30";
  dto.gold = "#F2C225";
  dto.silver = "#D9D9D9";
  assert.equal((await validate(dto)).length, 0);
  dto.gold = "javascript:alert(1)";
  assert.ok((await validate(dto)).some(issue => issue.property === "gold"));
});

test("public settings return official brand when no customization exists", async () => {
  const service = new BrandingService({ platformBrand: { findUnique: async () => null } } as never);
  const current = await service.publicSettings();
  assert.equal(current.black, "#000000");
  assert.equal(current.navy, "#050A30");
  assert.equal(current.gold, "#F2C225");
  assert.equal(current.assets.logo, null);
});

test("image validation rejects unsupported SVG and forged image bytes", async () => {
  const service = new BrandingService({} as never);
  const dataUrl = "data:image/svg+xml;base64," + Buffer.from("<svg/>").toString("base64");
  await assert.rejects(() => service.upload("logo", dataUrl), BadRequestException);
  const fake = "data:image/png;base64," + Buffer.from("not-a-real-png").toString("base64");
  await assert.rejects(() => service.upload("favicon", fake), BadRequestException);
});

test("only supported asset slots can be accessed", async () => {
  const service = new BrandingService({} as never);
  await assert.rejects(() => service.remove("script"), BadRequestException);
});

test("uploaded PNG stored in DB as bytes and can be listed", async () => {
  let saved: Record<string, unknown> = {};
  const db = { platformBrand: {
    upsert: async (input: { create: Record<string, unknown> }) => { saved = input.create; },
    findUnique: async () => null,
  } };
  const service = new BrandingService(db as never);
  // Valid signature + payload. File decoding is tested independently of the browser.
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  await service.upload("logo", "data:image/png;base64," + bytes.toString("base64"));
  assert.equal(saved.logoMime, "image/png");
  assert.deepEqual(Buffer.from(saved.logo as Uint8Array), bytes);
});
