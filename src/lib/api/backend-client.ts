"use client";

import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const REQUEST_TIMEOUT_MS = 15_000;

function extractMessage(body: unknown): string {
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string") return message;
  return "Erro ao comunicar com o servidor.";
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        // Só manda Content-Type quando há body — Fastify rejeita
        // "Content-Type: application/json" com corpo vazio (ex.: DELETE sem
        // payload), então o header não pode ser incondicional aqui.
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      // Conexão mobile instável costuma travar em vez de retornar erro —
      // sem timeout, a tela de cotação ficava carregando indefinidamente.
      throw new Error("Tempo de conexão esgotado. Verifique sua internet e tente novamente.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(extractMessage(body));
  }

  return body as T;
}

/**
 * Calls the new NestJS/Fastify backend (cotacoes/propostas domain only —
 * see CLAUDE.md/plan for why this domain moved off Server Actions) as the
 * empresario, attaching the current Supabase session's access token.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  return request<T>(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...init.headers,
    },
  });
}

/** For fornecedor-side routes — no Supabase session, identified by token_acesso instead. */
export async function apiFetchPublic<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init);
}

function filenameFromContentDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

/** Like apiFetch, but for binary responses (file downloads) — reads a Blob
 * instead of JSON, and pulls the filename off Content-Disposition. */
export async function apiFetchBlob(
  path: string,
  init: RequestInit = {},
): Promise<{ blob: Blob; filename: string }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Tempo de conexão esgotado. Verifique sua internet e tente novamente.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(extractMessage(body));
  }

  const blob = await res.blob();
  const filename = filenameFromContentDisposition(res.headers.get("Content-Disposition"), "download");

  return { blob, filename };
}
