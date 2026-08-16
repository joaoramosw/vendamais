import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

/**
 * Contrato de erro da API — o mesmo do backend NestJS que este módulo
 * substitui: `{ statusCode, message, error }`, onde `message` é string (erro
 * de domínio) ou array de strings (erro de validação). O frontend
 * (`backend-client.ts#extractMessage`) lê **exatamente** o campo `message`;
 * mudar o formato silenciosamente transformaria toda mensagem de erro da UI
 * em "Erro ao comunicar com o servidor.".
 */

const STATUS_LABEL: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  500: "Internal Server Error",
};

/** Espelho das exceptions do Nest — mantém os services quase verbatim. */
export class HttpException extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "HttpException";
  }
}

export class BadRequestException extends HttpException {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message: string) {
    super(message, 401);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string) {
    super(message, 403);
  }
}

export class NotFoundException extends HttpException {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictException extends HttpException {
  constructor(message: string) {
    super(message, 409);
  }
}

export function jsonError(status: number, message: string | string[]): NextResponse {
  return NextResponse.json(
    { statusCode: status, message, error: STATUS_LABEL[status] ?? "Error" },
    { status },
  );
}

/** ZodError → lista de mensagens no formato do ValidationPipe do Nest. */
function mensagensDeValidacao(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpException) {
    return jsonError(error.status, error.message);
  }

  if (error instanceof ZodError) {
    return jsonError(400, mensagensDeValidacao(error));
  }

  // Erro não previsto: loga o real no servidor (sem headers, sem token, sem
  // env) e devolve uma mensagem genérica — nunca stack trace pro cliente.
  console.error("[api] erro não tratado:", error instanceof Error ? error.message : error);
  return jsonError(500, "Erro interno do servidor.");
}

type RouteContext<P> = { params: Promise<P> };

/**
 * Envolve um route handler com o tratamento de erro padrão da API. Todos os
 * handlers de `/api/**` (exceto os que devolvem binário e tratam o próprio
 * sucesso) passam por aqui — é o equivalente do exception filter global do
 * Nest.
 */
export function apiRoute<P = Record<string, never>>(
  handler: (request: NextRequest, ctx: RouteContext<P>) => Promise<Response>,
): (request: NextRequest, ctx: RouteContext<P>) => Promise<Response> {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/**
 * Lê e valida o body JSON. Body ausente/malformado e payload que não passa no
 * schema viram 400 com o contrato de mensagem do Nest (os schemas são
 * `.strict()`, espelhando o `forbidNonWhitelisted: true` do ValidationPipe).
 */
export async function parseBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new BadRequestException("Corpo da requisição inválido — envie um JSON.");
  }
  return schema.parse(raw);
}
