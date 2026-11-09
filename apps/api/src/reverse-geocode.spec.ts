import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validate } from "class-validator";
import { brazilianState, fromGoogle, fromOsm } from "./reverse-geocode";
import { ReverseGeocodeDto } from "./tenant-settings";

test("geocodificação reversa transforma endereço do OpenStreetMap em campos brasileiros", () => {
  const result = fromOsm({
    display_name: "Rua da Bahia, Centro, Belo Horizonte, Minas Gerais, Brasil",
    address: {
      road: "Rua da Bahia",
      house_number: "1200",
      suburb: "Centro",
      city: "Belo Horizonte",
      state: "Minas Gerais",
      postcode: "30160-011",
      country_code: "br",
    },
  });
  assert.equal(result.street, "Rua da Bahia");
  assert.equal(result.streetNumber, "1200");
  assert.equal(result.neighborhood, "Centro");
  assert.equal(result.city, "Belo Horizonte");
  assert.equal(result.state, "MG");
  assert.equal(result.postalCode, "30160011");
});

test("resultado sem número não inventa dados do estabelecimento", () => {
  const result = fromOsm({ address: {
    road: "Rua do Comércio", city: "Além Paraíba", state: "Minas Gerais", country_code: "br",
  } });
  assert.equal(result.streetNumber, "");
  assert.equal(result.city, "Além Paraíba");
  assert.equal(result.state, "MG");
});

test("API Google normaliza endereço, código postal e UF", () => {
  const result = fromGoogle({
    formatted_address: "Rua A, 15, São Paulo - SP",
    address_components: [
      { long_name:"Rua A",short_name:"Rua A",types:["route"] },
      { long_name:"15",short_name:"15",types:["street_number"] },
      { long_name:"Vila Mariana",short_name:"Vila Mariana",types:["sublocality_level_1"] },
      { long_name:"São Paulo",short_name:"São Paulo",types:["locality"] },
      { long_name:"São Paulo",short_name:"SP",types:["administrative_area_level_1"] },
      { long_name:"04001-000",short_name:"04001-000",types:["postal_code"] },
      { long_name:"Brasil",short_name:"BR",types:["country"] },
    ],
  });
  assert.equal(result.state, "SP");
  assert.equal(result.postalCode, "04001000");
  assert.equal(result.streetNumber, "15");
});

test("UF normaliza acentos e rejeita nomes desconhecidos", () => {
  assert.equal(brazilianState("ESPIRITO SANTO"), "ES");
  assert.equal(brazilianState("Minas Gerais"), "MG");
  assert.equal(brazilianState("XX"), "XX");
  assert.equal(brazilianState("Unknown Place"), "");
});

test("reverse geocode rejeita localizações fora do Brasil", () => {
  assert.throws(() => fromOsm({ address: { country_code:"ar", city:"Buenos Aires" } }), /Brasil/);
});

test("coordenadas recebidas do navegador são validadas antes da consulta", async () => {
  const dto = Object.assign(new ReverseGeocodeDto(), { latitude: -21.88, longitude: -42.69 });
  assert.deepEqual(await validate(dto), []);
  assert.ok((await validate(Object.assign(new ReverseGeocodeDto(), {
    latitude: 110, longitude: -185,
  }))).length === 2);
});
