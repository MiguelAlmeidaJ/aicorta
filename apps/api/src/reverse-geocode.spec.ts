import "reflect-metadata";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validate } from "class-validator";
import { brazilianState, fromGoogle, fromOsm, locateBrazilianAddress } from "./reverse-geocode";
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

test("busca de endereço funciona sem chave Google e aceita grafia aproximada da rua", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.GOOGLE_GEOCODING_API_KEY;
  delete process.env.GOOGLE_GEOCODING_API_KEY;
  const requests: string[] = [];
  globalThis.fetch = async (input: string | URL | Request) => {
    requests.push(String(input));
    return new Response(JSON.stringify([{
      lat:"-21.876",lon:"-42.703",display_name:"Rua Capitão Godói, Além Paraíba, MG, Brasil",
      address:{ road:"Rua Capitão Godói", house_number:"250", city:"Além Paraíba",
        state:"Minas Gerais", country_code:"br" },
    }]),{status:200,headers:{"content-type":"application/json"}});
  };
  try {
    const result = await locateBrazilianAddress({
      street:"Rua Capitão Godoy",streetNumber:"250",city:"Além Paraíba",state:"MG",
      postalCode:"36660000",
    });
    assert.equal(result.latitude,-21.876);
    assert.equal(result.longitude,-42.703);
    assert.equal(result.source,"openstreetmap");
    assert.equal(result.precision,"ROOFTOP");
    assert.equal(requests.length,1);
    assert.ok(requests[0].includes("nominatim.openstreetmap.org/search"));
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_GEOCODING_API_KEY;
    else process.env.GOOGLE_GEOCODING_API_KEY = previousKey;
  }
});

test("busca rejeita resultados de outra cidade, mesmo que a rua tenha o mesmo nome", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.GOOGLE_GEOCODING_API_KEY;
  delete process.env.GOOGLE_GEOCODING_API_KEY;
  globalThis.fetch = async () => new Response(JSON.stringify([{
    lat:"-22.1",lon:"-43",display_name:"Rua Capitão Godoy, Rio de Janeiro, RJ",
    address:{road:"Rua Capitão Godoy",city:"Rio de Janeiro",state:"Rio de Janeiro",country_code:"br"},
  }]),{status:200,headers:{"content-type":"application/json"}});
  try {
    await assert.rejects(() => locateBrazilianAddress({
      street:"Rua Capitão Godoy",streetNumber:"250",city:"Além Paraíba",state:"MG",
    }), /Não encontramos essa rua e número/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_GEOCODING_API_KEY;
    else process.env.GOOGLE_GEOCODING_API_KEY = previousKey;
  }
});
