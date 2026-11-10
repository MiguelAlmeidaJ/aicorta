import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";

export type ReverseAddress = {
  street: string; streetNumber: string; neighborhood: string;
  city: string; state: string; postalCode: string;
  formattedAddress: string; source: "google" | "openstreetmap";
};

const STATE_CODES: Record<string, string> = {
  Acre: "AC", Alagoas: "AL", Amapá: "AP", Amazonas: "AM", Bahia: "BA",
  Ceará: "CE", "Distrito Federal": "DF", "Espírito Santo": "ES",
  Goiás: "GO", Maranhão: "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG", Pará: "PA", Paraíba: "PB", Paraná: "PR",
  Pernambuco: "PE", Piauí: "PI", "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", Rondônia: "RO",
  Roraima: "RR", "Santa Catarina": "SC", "São Paulo": "SP",
  Sergipe: "SE", Tocantins: "TO",
};
export function brazilianState(value: string | undefined) {
  if (!value) return "";
  const matched = Object.keys(STATE_CODES).find(name =>
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() ===
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  return matched ? STATE_CODES[matched] : /^[A-Z]{2}$/.test(value) ? value : "";
}

export function fromOsm(data: {
  display_name?: string;
  address?: Record<string, string | undefined>;
}): ReverseAddress {
  const address = data.address ?? {};
  if (address.country_code?.toLowerCase() !== "br") {
    throw new BadRequestException("A localização selecionada precisa estar no Brasil.");
  }
  return {
    street: address.road ?? address.pedestrian ?? address.residential ?? address.footway ?? "",
    streetNumber: address.house_number ?? "",
    neighborhood: address.suburb ?? address.neighbourhood ?? address.quarter ?? "",
    city: address.city ?? address.town ?? address.municipality ?? address.village ?? address.county ?? "",
    state: brazilianState(address.state ?? address.region),
    postalCode: (address.postcode ?? "").replace(/\D/g, "").slice(0,8),
    formattedAddress: data.display_name ?? "",
    source: "openstreetmap",
  };
}
type GoogleComponent = { long_name: string; short_name: string; types: string[] };
export function fromGoogle(result: { formatted_address?: string; address_components: GoogleComponent[] }): ReverseAddress {
  const get = (...types: string[]) =>
    result.address_components.find(item => types.some(type => item.types.includes(type)));
  if (get("country")?.short_name !== "BR")
    throw new BadRequestException("A localização selecionada precisa estar no Brasil.");
  const state = get("administrative_area_level_1");
  return {
    street: get("route")?.long_name ?? "",
    streetNumber: get("street_number")?.long_name ?? "",
    neighborhood: get("sublocality_level_1","sublocality","neighborhood")?.long_name ?? "",
    city: get("locality","administrative_area_level_2")?.long_name ?? "",
    state: brazilianState(state?.short_name ?? state?.long_name),
    postalCode: (get("postal_code")?.long_name ?? "").replace(/\D/g,"").slice(0,8),
    formattedAddress: result.formatted_address ?? "",
    source: "google",
  };
}

// Consultas individuais de configuração, nunca chamadas em massa. Cache por posição arredondada.
const cache = new Map<string, { expiry: number; value: ReverseAddress }>();
let nextOsmRequestAt = 0;
let osmQueue: Promise<void> = Promise.resolve();
export function reserveOsmSlot() {
  const current = osmQueue;
  let release!: () => void;
  osmQueue = new Promise<void>(resolve => { release = resolve; });
  return current.then(async () => {
    const wait = Math.max(0,nextOsmRequestAt - Date.now());
    if (wait) await new Promise(resolve => setTimeout(resolve,wait));
    nextOsmRequestAt = Date.now() + 1100;
    release();
  });
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseAddress> {
  const cacheKey = latitude.toFixed(5) + "," + longitude.toFixed(5);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return cached.value;
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  let value: ReverseAddress;
  if (key) {
    const params = new URLSearchParams({
      latlng: latitude + "," + longitude, key, language: "pt-BR", region: "br",
    });
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) throw new Error("geocoding HTTP error");
      const payload = await response.json() as { results?: Array<{ formatted_address?:string; address_components:GoogleComponent[] }> };
      const first = payload.results?.find(entry => entry.address_components.some(c =>
        c.types.includes("country") && c.short_name === "BR"));
      if (!first) throw new BadRequestException("Endereço não identificado no Brasil.");
      value = fromGoogle(first);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException("Não foi possível identificar o endereço. Preencha os campos manualmente.");
    }
  } else {
    // Uso leve do Nominatim público conforme a política OSMF:
    // https://operations.osmfoundation.org/policies/nominatim/
    // Uma consulta por vez, intervalo >1s, identificação explícita e cache.
    await reserveOsmSlot();
    const params = new URLSearchParams({
      lat: String(latitude), lon: String(longitude), format: "jsonv2",
      addressdetails: "1", zoom: "18", "accept-language": "pt-BR",
    });
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
        headers: { "User-Agent": "AICorta/1.0 (barbershop schedule administration; https://github.com/MiguelAlmeidaJ/aicorta)",
          "Accept-Language": "pt-BR" },
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) throw new Error("OSM response error");
      value = fromOsm(await response.json() as {display_name?:string;address?:Record<string,string>});
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException("Não foi possível identificar o endereço automaticamente. Preencha manualmente.");
    }
  }
  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey,{expiry:Date.now()+24*60*60*1000,value});
  return value;
}

export type LocatedAddress = {
  latitude: number; longitude: number; formattedAddress: string;
  precision: string; source: "google" | "openstreetmap";
};
type ForwardAddress = {
  street: string; streetNumber: string; city: string; state: string;
  neighborhood?: string; postalCode?: string;
};
function simplified(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(rua|avenida|av|travessa|r)\b/g, "").replace(/[^a-z0-9]+/g," ").trim();
}
function hasMatchingCityAndStreet(address: {
  road?: string; pedestrian?: string; city?: string; town?: string;
  municipality?: string; village?: string; state?: string; state_code?: string;
}, requested: ForwardAddress) {
  const road = simplified(address.road ?? address.pedestrian ?? "");
  const expectedStreet = simplified(requested.street);
  const city = simplified(address.city ?? address.town ?? address.municipality ?? address.village ?? "");
  const state = brazilianState(address.state_code ?? address.state);
  return !!road && !!expectedStreet && !!city &&
    (road.includes(expectedStreet) || expectedStreet.includes(road) ||
      (road.length > 6 && road.slice(0,road.length-1) === expectedStreet.slice(0,road.length-1))) &&
    city === simplified(requested.city) && state === requested.state;
}

/** Retorna apenas resultados localizados na rua e cidade solicitadas; nunca o centro da cidade. */
export async function locateBrazilianAddress(dto: ForwardAddress): Promise<LocatedAddress> {
  const key = process.env.GOOGLE_GEOCODING_API_KEY;
  if (key) {
    const parts = [dto.street + ", " + dto.streetNumber, dto.neighborhood, dto.city,
      dto.state, "Brasil"].filter(Boolean).join(", ");
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${new URLSearchParams({
        address:parts,key,language:"pt-BR",region:"br",
      })}`,{signal:AbortSignal.timeout(7000)});
      if (!response.ok) throw new Error("Google Geocoding indisponível");
      const payload = await response.json() as {results?:Array<{
        formatted_address:string; geometry:{location:{lat:number;lng:number};location_type:string};
        address_components:GoogleComponent[];
      }>};
      const matches = (payload.results ?? []).filter(item => {
        const get = (type:string) => item.address_components.find(c=>c.types.includes(type));
        return get("country")?.short_name === "BR" &&
          brazilianState(get("administrative_area_level_1")?.short_name) === dto.state &&
          simplified(get("locality")?.long_name ?? get("administrative_area_level_2")?.long_name ?? "") === simplified(dto.city) &&
          simplified(get("route")?.long_name ?? "") === simplified(dto.street) &&
          Number.isFinite(item.geometry.location.lat) && Number.isFinite(item.geometry.location.lng);
      });
      const point = matches.find(item => item.geometry.location_type === "ROOFTOP") ?? matches[0];
      if (point) return {
        latitude:point.geometry.location.lat,longitude:point.geometry.location.lng,
        formattedAddress:point.formatted_address,precision:point.geometry.location_type,
        source:"google",
      };
    } catch { /* Fallback para a base cartográfica pública com rate limit. */ }
  }
  const requests = [
    [dto.street + " " + dto.streetNumber, dto.city, dto.state, "Brasil"].join(", "),
    [dto.street, dto.city, dto.state, "Brasil"].join(", "),
  ];
  for (const query of requests) {
    await reserveOsmSlot();
    const params = new URLSearchParams({q:query,format:"jsonv2",addressdetails:"1",
      countrycodes:"br",limit:"5","accept-language":"pt-BR"});
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`,{
        headers:{"User-Agent":"AICorta/1.0 (barbershop administration; https://github.com/MiguelAlmeidaJ/aicorta)",
          "Accept-Language":"pt-BR"},
        signal:AbortSignal.timeout(7000),
      });
      if (!response.ok) throw new Error("Pesquisa indisponível");
      const items = await response.json() as Array<{
        lat:string;lon:string;display_name:string;address:Record<string,string>;
      }>;
      const matched = items.find(item => item.address && hasMatchingCityAndStreet(item.address,dto));
      if (matched) return {
        latitude:Number(matched.lat),longitude:Number(matched.lon),
        formattedAddress:matched.display_name,
        precision:matched.address.house_number === dto.streetNumber ? "ROOFTOP" : "APPROXIMATE",
        source:"openstreetmap",
      };
    } catch { /* Uma tentativa adicional sem o número pode localizar a rua. */ }
  }
  throw new BadRequestException(
    "Não encontramos essa rua e número com segurança. Confira a cidade/UF ou clique no ponto exato do mapa.");
}
