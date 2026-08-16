// =====================================================================
// supabase/functions/followup-pendentes/index.ts
// Supabase Edge Function (Deno runtime)
//
// COMO AGENDAR: No Supabase Dashboard, vá em:
//   Database > Extensions > habilite 'pg_cron'
//   Depois execute no SQL Editor:
//   SELECT cron.schedule(
//     'followup-pendentes-diario',
//     '0 9 * * *',  -- Roda todo dia às 09:00 UTC
//     $$SELECT net.http_post(
//         url := 'https://<seu-project-ref>.supabase.co/functions/v1/followup-pendentes',
//         headers := '{"Authorization": "Bearer <seu-service-role-key>"}'::jsonb
//     )$$
//   );
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Tipos para tipagem interna ───────────────────────────────────────────────
interface PendingInvite {
  id: string;
  email_contato: string;
  token_acesso: string;
  created_at: string;
  cotacoes: {
    id: string;
    titulo: string;
    profiles: {
      nome: string;
      empresa: string | null;
    };
  };
}

interface FollowUpLog {
  convite_id: string;
  email_contato: string;
  titulo_cotacao: string;
  horas_pendente: number;
  whatsapp_link: string | null;
  link_proposta: string;
}

// ─── Handler Principal ────────────────────────────────────────────────────────
Deno.serve(async (_req: Request): Promise<Response> => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "https://vendamais.app";

  // Cliente Admin (SERVICE_ROLE bypassa o RLS para leitura total)
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ─── 1. Calcula o limiar temporal (24 horas atrás) ───────────────────────
  const limiar24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // ─── 2. Busca convites pendentes há mais de 24h em cotações abertas ────────
  const { data: invitesPendentes, error } = await supabase
    .from("fornecedores_convidados")
    .select(`
      id,
      email_contato,
      token_acesso,
      created_at,
      cotacoes (
        id,
        titulo,
        profiles:admin_id (
          nome,
          empresa
        )
      )
    `)
    .eq("status_convite", "pendente")
    .lte("created_at", limiar24h)
    .eq("cotacoes.status", "aberta"); // Apenas cotações ainda ativas

  if (error) {
    console.error("[followup-pendentes] Erro na query:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!invitesPendentes || invitesPendentes.length === 0) {
    return new Response(
      JSON.stringify({ message: "Nenhum convite pendente encontrado.", logs: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ─── 3. Gera os logs de follow-up com o link WhatsApp pré-formatado ────────
  const logs: FollowUpLog[] = (invitesPendentes as unknown as PendingInvite[])
    .filter((invite) => !!invite.cotacoes) // Garante que a cotação veio populada
    .map((invite) => {
      const horasPendente = Math.floor(
        (Date.now() - new Date(invite.created_at).getTime()) / (1000 * 60 * 60)
      );

      // Link direto para o formulário de proposta deste fornecedor
      const linkProposta = `${appBaseUrl}/proposta/${invite.token_acesso}`;

      // Mensagem estruturada de lembrete para o WhatsApp
      const mensagem = [
        `Olá! Tudo bem? 😊`,
        ``,
        `Sou da empresa *${invite.cotacoes.profiles?.empresa || invite.cotacoes.profiles?.nome || "Venda Mais"}* e estou entrando em contato sobre a cotação:`,
        `📋 *${invite.cotacoes.titulo}*`,
        ``,
        `Ainda não recebemos sua proposta. Você ainda pode participar! Acesse pelo link abaixo e preencha em poucos minutos:`,
        `🔗 ${linkProposta}`,
        ``,
        `Qualquer dúvida, estamos à disposição!`,
      ].join("\n");

      const encodedMsg = encodeURIComponent(mensagem);
      // Nota: sem o número de telefone, o link abre o WhatsApp Web para o usuário escolher o contato
      const whatsappLink = `https://wa.me/?text=${encodedMsg}`;

      return {
        convite_id: invite.id,
        email_contato: invite.email_contato,
        titulo_cotacao: invite.cotacoes.titulo,
        horas_pendente: horasPendente,
        whatsapp_link: whatsappLink,
        link_proposta: linkProposta,
      };
    });

  // ─── 4. Salva o log na tabela de auditoria (Opcional mas recomendado) ──────
  // Assumindo uma tabela `followup_logs` já criada no banco:
  //
  //   CREATE TABLE followup_logs (
  //     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  //     convite_id UUID REFERENCES fornecedores_convidados(id),
  //     gerado_em TIMESTAMPTZ DEFAULT now(),
  //     whatsapp_link TEXT,
  //     horas_pendente INT
  //   );
  //
  await supabase.from("followup_logs").insert(
    logs.map((l) => ({
      convite_id: l.convite_id,
      whatsapp_link: l.whatsapp_link,
      horas_pendente: l.horas_pendente,
    }))
  );

  console.log(`[followup-pendentes] ${logs.length} follow-ups gerados.`);

  return new Response(JSON.stringify({ total: logs.length, logs }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
