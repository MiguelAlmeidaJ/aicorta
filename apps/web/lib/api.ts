export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

let refreshing: Promise<boolean> | null = null;
async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/auth/refresh`, {
      method: "POST", credentials: "include",
    }).then(result => result.ok).catch(() => false).finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const options: RequestInit = { ...init, credentials: "include", cache: "no-store" };
  let response = await fetch(`${API_URL}${path}`, options);
  if (response.status === 401 && path !== "/auth/refresh" && path !== "/auth/login") {
    if (await refreshSession()) response = await fetch(`${API_URL}${path}`, options);
  }
  return response;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    let detail = "Não foi possível concluir a solicitação.";
    try {
      const body: { message?: string | string[] } = await response.json();
      if (body.message) detail = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch { /* HTTP response without JSON */ }
    throw new Error(response.status === 403 ? "Você não tem permissão para essa ação." : detail);
  }
  return response.json() as Promise<T>;
}

export function mutation(method: "POST" | "PATCH" | "PUT", value: object): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) };
}
