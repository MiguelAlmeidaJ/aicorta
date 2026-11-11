/** Dados mínimos para publicar a localização de uma barbearia com segurança. */
export type TenantAddressFields = {
  postalCode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function missingTenantAddressFields(address: TenantAddressFields): string[] {
  const missing: string[] = [];
  if (!/^[0-9]{8}$/.test(address.postalCode?.replace(/\D/g, "") ?? "")) missing.push("CEP");
  if (!address.street?.trim()) missing.push("rua");
  if (!address.streetNumber?.trim()) missing.push("número");
  if (!address.neighborhood?.trim()) missing.push("bairro");
  if (!address.city?.trim()) missing.push("cidade");
  if (!/^[A-Z]{2}$/.test(address.state?.trim().toUpperCase() ?? "")) missing.push("UF");
  if (typeof address.latitude !== "number" || !Number.isFinite(address.latitude) ||
      address.latitude < -90 || address.latitude > 90 ||
      typeof address.longitude !== "number" || !Number.isFinite(address.longitude) ||
      address.longitude < -180 || address.longitude > 180) missing.push("localização no mapa");
  return missing;
}

export function tenantAddressComplete(address: TenantAddressFields): boolean {
  return missingTenantAddressFields(address).length === 0;
}
