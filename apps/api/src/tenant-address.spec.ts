import { strict as assert } from "node:assert";
import { test } from "node:test";
import { missingTenantAddressFields, tenantAddressComplete } from "./tenant-address";

const complete = {
  postalCode: "36660000",
  street: "Rua Central",
  streetNumber: "250",
  neighborhood: "Centro",
  city: "Além Paraíba",
  state: "MG",
  latitude: -21.883,
  longitude: -42.699,
};

test("cadastro inicial não fica concluído sem endereço", () => {
  assert.equal(tenantAddressComplete({}), false);
  assert.deepEqual(missingTenantAddressFields({}), [
    "CEP", "rua", "número", "bairro", "cidade", "UF", "localização no mapa",
  ]);
});

test("endereço completo e ponto confirmado liberam o primeiro acesso", () => {
  assert.equal(tenantAddressComplete(complete), true);
  assert.deepEqual(missingTenantAddressFields(complete), []);
});

test("endereço exige CEP, número e bairro além de cidade e UF", () => {
  assert.ok(missingTenantAddressFields({ ...complete, postalCode: "36660" }).includes("CEP"));
  assert.ok(missingTenantAddressFields({ ...complete, streetNumber: "" }).includes("número"));
  assert.ok(missingTenantAddressFields({ ...complete, neighborhood: null }).includes("bairro"));
  assert.ok(missingTenantAddressFields({ ...complete, state: "M" }).includes("UF"));
});

test("localização precisa das duas coordenadas válidas", () => {
  assert.ok(missingTenantAddressFields({ ...complete, latitude: null }).includes("localização no mapa"));
  assert.ok(missingTenantAddressFields({ ...complete, longitude: 190 }).includes("localização no mapa"));
  assert.equal(tenantAddressComplete({ ...complete, postalCode: "36660-000" }), true);
});
