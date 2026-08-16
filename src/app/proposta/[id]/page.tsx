import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrNull } from "@/lib/auth/current-user";
import { AcessoGate } from "@/components/proposta/AcessoGate";
import { Logo } from "@/components/brand/logo";
import { propostaPath } from "@/lib/routes";
import { PropostaForm } from "./PropostaForm";

/**
 * Rota canônica do link da proposta: **`/proposta/{id}`** (slug singular).
 *
 * `{id}` é o identificador de acesso — o token do convite (o que os links de
 * WhatsApp carregam) **ou** o id de uma proposta já enviada. Quem resolve os
 * dois é o backend (`FornecedorTokenService#resolveConvite`), então um link
 * antigo continua abrindo a tela certa.
 *
 * Dois cenários, decididos aqui no servidor:
 *
 * - **A — logado e participante:** renderiza a listagem de produtos com os
 *   campos de prazo e observações gerais logo abaixo. Sem etapa de login.
 * - **B — não logado:** mostra o gate ("Você não está logado. Já tem login?").
 *   Depois de entrar/cadastrar, a conta é vinculada à cotação (endpoint
 *   `POST /convite/:id/acesso`) e a visita seguinte já cai no cenário A.
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ConviteData {
  cotacao: {
    id: string;
    titulo: string;
    status: "rascunho" | "aberta" | "fechada" | "cancelada";
    data_limite: string | null;
    created_at: string;
  };
  itens: Array<{
    id: string;
    nome_produto: string;
    unidade: string;
    observacao: string | null;
    imagem_url: string | null;
  }>;
  convite: {
    token_acesso: string;
    status_convite: "pendente" | "visualizado" | "respondido";
    email_contato: string | null;
    whatsapp: string | null;
    nome_empresa: string | null;
  };
  proposta_id: string | null;
  observacao_geral_suportada: boolean;
}

/**
 * Base da API para fetch **do servidor**. Com `NEXT_PUBLIC_API_URL` relativo
 * (ex.: "/api"), resolve contra o host da requisição para passar pelo rewrite
 * do next.config — funciona em localhost e via ngrok.
 */
async function apiBaseUrl(): Promise<string> {
  const apiPath = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  if (!apiPath.startsWith("/")) return apiPath;

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${apiPath}`;
}

async function getConvitePublico(
  identificador: string,
): Promise<{ data?: ConviteData; error?: string }> {
  try {
    const res = await fetch(`${await apiBaseUrl()}/convite/${identificador}`, {
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return { error: body?.message ?? "Convite não encontrado." };
    }

    return { data: body as ConviteData };
  } catch {
    return { error: "Não foi possível carregar o convite. Tente novamente." };
  }
}

/** Cenário A: resolve o convite **da conta logada**, criando o vínculo com a
 * cotação se ela ainda não fizer parte. */
async function getConviteComoUsuario(
  identificador: string,
  accessToken: string,
): Promise<{ data?: ConviteData; error?: string }> {
  try {
    const res = await fetch(`${await apiBaseUrl()}/convite/${identificador}/acesso`, {
      method: "POST",
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return { error: body?.message ?? "Não foi possível abrir esta cotação." };
    }

    return { data: body as ConviteData };
  } catch {
    return { error: "Não foi possível carregar o convite. Tente novamente." };
  }
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-900 px-4 py-12">
      <Logo variant="full" scheme="dark" size="md" className="mb-6" priority />
      <div className="w-full max-w-md bg-neutral-900 border border-white/[0.08] rounded-2xl p-8 text-center shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Moldura>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger-500/10 mb-6">
        <AlertCircle className="h-8 w-8 text-danger-500" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Não foi possível abrir o convite</h2>
      <p className="text-sm text-neutral-400 mb-8">{message}</p>
      <Link
        href="/"
        className="inline-flex justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
      >
        Voltar para o início
      </Link>
    </Moldura>
  );
}

/** Convite já respondido por esta conta — em vez de um erro seco, o caminho
 * para a proposta enviada. */
function PropostaJaEnviadaCard({ propostaId }: { propostaId: string | null }) {
  return (
    <Moldura>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-500/10 mb-6">
        <CheckCircle2 className="h-8 w-8 text-success-500" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Você já respondeu esta cotação</h2>
      <p className="text-sm text-neutral-400 mb-8">
        Sua proposta foi enviada e está com o comprador.
      </p>
      <Link
        href={propostaId ? `/fornecedor/propostas?aberta=${propostaId}` : "/fornecedor/propostas"}
        className="inline-flex justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
      >
        Ver minha proposta
      </Link>
    </Moldura>
  );
}

/** Empresário abrindo o link do próprio convite: não vira participante da
 * cotação por acidente. */
function ContaEmpresarioCard({ cotacaoId }: { cotacaoId: string | null }) {
  return (
    <Moldura>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning-500/10 mb-6">
        <ShieldAlert className="h-8 w-8 text-warning-500" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Este link é para fornecedores</h2>
      <p className="text-sm text-neutral-400 mb-8">
        Você está logado como empresário. Para responder, entre com uma conta de fornecedor.
      </p>
      <Link
        href={cotacaoId ? `/empresario/cotacoes/${cotacaoId}` : "/empresario/cotacoes"}
        className="inline-flex justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
      >
        Abrir a cotação no painel
      </Link>
    </Moldura>
  );
}

export default async function PropostaPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Cenário B — sem sessão: gate de acesso (entrar ou criar conta) ──
  if (!user) {
    const { data, error } = await getConvitePublico(id);
    if (error || !data) {
      return <ErrorCard message={error ?? "Convite não encontrado."} />;
    }

    return (
      <AcessoGate
        redirectTo={propostaPath(id)}
        cotacaoTitulo={data.cotacao.titulo}
        totalItens={data.itens.length}
      />
    );
  }

  const currentUser = await getCurrentUserOrNull();
  if (currentUser?.role === "admin") {
    const { data } = await getConvitePublico(id);
    return <ContaEmpresarioCard cotacaoId={data?.cotacao.id ?? null} />;
  }

  // ── Cenário A — com sessão: vincula (se preciso) e abre o formulário ──
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return <ErrorCard message="Sua sessão expirou. Entre novamente para responder." />;
  }

  const { data, error } = await getConviteComoUsuario(id, session.access_token);

  if (error || !data) {
    return <ErrorCard message={error ?? "Convite não encontrado."} />;
  }

  if (data.convite.status_convite === "respondido") {
    return <PropostaJaEnviadaCard propostaId={data.proposta_id} />;
  }

  if (data.cotacao.status !== "aberta") {
    return (
      <ErrorCard
        message={`Esta cotação está com status "${data.cotacao.status}" e não aceita mais propostas.`}
      />
    );
  }

  return (
    <PropostaForm
      token={data.convite.token_acesso}
      cotacao={data.cotacao}
      itens={data.itens}
      nomeEmpresa={data.convite.nome_empresa ?? currentUser?.organizationName ?? null}
      telefone={currentUser?.telefone ?? data.convite.whatsapp ?? null}
      observacaoGeralSuportada={data.observacao_geral_suportada}
    />
  );
}
