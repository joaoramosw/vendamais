"use client";

/**
 * Gate de acesso do link da proposta (Cenário B).
 *
 * Quem abre `/proposta/{id}` sem sessão vê esta tela antes de qualquer preço:
 * "Você não está logado. Já tem login?" — sim leva ao login por telefone, não
 * leva ao cadastro. Nos dois casos a pessoa sai **já logada** e o gate só
 * recarrega a rota atual (`router.refresh()`), que então renderiza o
 * formulário da proposta com o vínculo à cotação já criado no servidor.
 *
 * Os formulários são os mesmos de `/login` e `/cadastro` — nenhuma variação de
 * regra de auth mora aqui.
 */

import { Logo } from "@/components/brand/logo";
import { CadastroForm } from "@/components/auth/CadastroForm";
import { LoginForm } from "@/components/auth/LoginForm";
import { cn } from "@/lib/utils";
import { FileText, LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Escolha = "pergunta" | "login" | "cadastro";

interface AcessoGateProps {
  /** Rota atual — só para o `?redirect=` dos formulários abertos em página. */
  redirectTo: string;
  cotacaoTitulo: string;
  totalItens: number;
}

export function AcessoGate({ redirectTo, cotacaoTitulo, totalItens }: AcessoGateProps) {
  const router = useRouter();
  const [escolha, setEscolha] = useState<Escolha>("pergunta");

  // Sessão criada: a própria rota volta a renderizar, agora no Cenário A.
  const aoAutenticar = () => router.refresh();

  return (
    <div className="flex min-h-screen items-start justify-center bg-neutral-900 px-4 py-12">
      <div className="w-full max-w-md space-y-4">
        {/* Quem chega aqui vem de um link de WhatsApp e precisa reconhecer de
            imediato de quem é a plataforma antes de digitar telefone e senha. */}
        <div className="flex justify-center pb-2">
          <Logo variant="full" scheme="dark" size="lg" priority />
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-neutral-900 p-6 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
              <FileText className="h-5 w-5 text-primary-400" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">
                Convite para cotação
              </p>
              <h1 className="text-lg font-bold text-white leading-tight">{cotacaoTitulo}</h1>
              <p className="mt-0.5 text-xs text-neutral-500">
                {totalItens} {totalItens === 1 ? "item para cotar" : "itens para cotar"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-neutral-900 p-6 shadow-2xl">
          {escolha === "pergunta" && (
            <>
              <h2 className="text-base font-semibold text-white">Você não está logado.</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Já tem login? Entrar leva um instante — e suas propostas ficam guardadas na sua
                conta.
              </p>

              <div className="mt-5 space-y-2">
                <OpcaoBotao
                  icone={<LogIn className="h-4 w-4" />}
                  titulo="Sim, já tenho login"
                  descricao="Entrar com telefone e senha"
                  destaque
                  onClick={() => setEscolha("login")}
                />
                <OpcaoBotao
                  icone={<UserPlus className="h-4 w-4" />}
                  titulo="Não, quero me cadastrar"
                  descricao="Leva menos de um minuto"
                  onClick={() => setEscolha("cadastro")}
                />
              </div>
            </>
          )}

          {escolha === "login" && (
            <>
              <CabecalhoEtapa
                titulo="Entrar"
                descricao="Use o telefone cadastrado e sua senha."
                onVoltar={() => setEscolha("pergunta")}
              />
              <LoginForm
                redirectTo={redirectTo}
                onAuthenticated={aoAutenticar}
                submitLabel="Entrar e responder"
              />
              <p className="mt-4 text-center text-sm text-neutral-500">
                Não tem conta?{" "}
                <button
                  type="button"
                  onClick={() => setEscolha("cadastro")}
                  className="font-medium text-primary-400 hover:text-primary-300 transition-colors cursor-pointer"
                >
                  Criar agora
                </button>
              </p>
            </>
          )}

          {escolha === "cadastro" && (
            <>
              <CabecalhoEtapa
                titulo="Criar conta"
                descricao="Você entra pelo telefone — não pedimos e-mail."
                onVoltar={() => setEscolha("pergunta")}
              />
              <CadastroForm
                redirectTo={redirectTo}
                onAuthenticated={aoAutenticar}
                submitLabel="Criar conta e responder"
              />
              <p className="mt-4 text-center text-sm text-neutral-500">
                Já tem conta?{" "}
                <button
                  type="button"
                  onClick={() => setEscolha("login")}
                  className="font-medium text-primary-400 hover:text-primary-300 transition-colors cursor-pointer"
                >
                  Entrar
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CabecalhoEtapa({
  titulo,
  descricao,
  onVoltar,
}: {
  titulo: string;
  descricao: string;
  onVoltar: () => void;
}) {
  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={onVoltar}
        className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
      >
        ← Voltar
      </button>
      <h2 className="mt-2 text-base font-semibold text-white">{titulo}</h2>
      <p className="mt-0.5 text-sm text-neutral-400">{descricao}</p>
    </div>
  );
}

function OpcaoBotao({
  icone,
  titulo,
  descricao,
  destaque,
  onClick,
}: {
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  destaque?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer",
        destaque
          ? "border-primary-500/40 bg-primary-500/10 hover:bg-primary-500/15"
          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          destaque ? "bg-primary-500/20 text-primary-300" : "bg-white/[0.05] text-neutral-400",
        )}
      >
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{titulo}</span>
        <span className="block text-xs text-neutral-500">{descricao}</span>
      </span>
    </button>
  );
}
