const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function token() {
  return localStorage.getItem("crc_token");
}

export async function request<T>(path: string, method: Method = "GET", body?: unknown, isBlob = false): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const maybeJson = await res.json().catch(() => ({}));
    throw new Error(maybeJson.error ?? `Erreur HTTP ${res.status}`);
  }

  if (isBlob) return (await res.blob()) as T;
  return (await res.json()) as T;
}
