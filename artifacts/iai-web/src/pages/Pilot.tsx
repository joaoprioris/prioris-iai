import { useCallback, useEffect, useRef, useState } from "react";
import Chat from "./Chat";
import type { AuthUser } from "../hooks/useAuth";
const BASE = "/api/pilot-0.3.0";
type Status = {
  version: string;
  round?: number;
  authenticated: boolean;
  available: boolean;
  error?: string;
  identity?: AuthUser;
  provider?: string;
  nextConversation?: { allowed: boolean; reason: string | null; sessionId: string | null };
  abandonConversation?: { allowed: boolean; reason: string | null; sessionId: string | null };
  abandonment?: { kind: string; approval: boolean; at: number };
  budget?: {
    capUSD: number;
    estimatedUSD: number;
    remainingUSD: number;
    calls: number;
    blocked: boolean;
    reason?: string;
  };
};
export default function Pilot() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const advanceLock = useRef(false);
  const [abandoning, setAbandoning] = useState(false);
  const [abandonReason, setAbandonReason] = useState("");
  const abandonLock = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch(BASE + "/status", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await r.json();
      setStatus(data);
      setError(r.ok ? "" : (data.error ?? "Piloto indisponível."));
    } catch {
      setError(
        "Não foi possível acessar o servidor do piloto. Nenhuma mensagem foi enviada.",
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  async function nextConversation() {
    if (advanceLock.current || abandonLock.current || !status?.nextConversation?.allowed) return;
    advanceLock.current = true;
    setAdvancing(true);
    try {
      const r = await fetch(BASE + "/next-conversation", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round: status.round, sessionId: status.nextConversation.sessionId }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error ?? "Não foi possível abrir a próxima conversa.");
      setAbandonReason("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir a próxima conversa.");
    } finally {
      advanceLock.current = false;
      setAdvancing(false);
    }
  }
  async function abandonConversation() {
    if (abandonLock.current || advanceLock.current || !status?.abandonConversation?.allowed) return;
    if (!window.confirm("Encerrar esta conversa como abandono, não aprovação? Falas, auditoria e custos serão preservados.")) return;
    abandonLock.current = true;
    setAbandoning(true);
    try {
      const r = await fetch(BASE + "/abandon-conversation", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round: status.round, sessionId: status.abandonConversation.sessionId, reason: abandonReason }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error ?? "Não foi possível registrar a desistência.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a desistência.");
    } finally {
      abandonLock.current = false;
      setAbandoning(false);
    }
  }
  async function logout() {
    try {
      const r = await fetch(BASE + "/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!r.ok) throw Error();
      await refresh();
    } catch {
      setError("Não foi possível sair. Tente novamente.");
    }
  }
  return (
    <main
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#0D0D0D",
        color: "#F2F2F2",
        fontFamily: "inherit",
      }}
    >
      <section
        aria-label="Identificação do piloto"
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #B8953F",
          flexShrink: 0,
          fontSize: 13,
        }}
      >
        <strong style={{ color: "#B8953F" }}>
          IAí by PRIORIS — piloto fictício {status?.version ?? "0.3.4"} · rodada{" "}
          {status?.round ?? '…'}
        </strong>
        <div>
          Uma conversa limpa nesta rodada · até dez trocas · histórico pessoal
          desligado · sem camada organizacional
        </div>
        <div>
          IA real:{" "}
          {status?.provider === "anthropic"
            ? "Anthropic direto"
            : "Anthropic via Replit"}{" "}
          · Haiku 4.5 / Sonnet 4.5 · somente ao enviar sua fala
        </div>
        {status?.budget ? <div>Teto acumulado de todas as rodadas: US{'$'}{status.budget.capUSD} · contabilizado: US{'$'}{status.budget.estimatedUSD.toFixed(6)} · chamadas acumuladas: {status.budget.calls}. Não é saldo nem fatura exata.</div> : <div>Conferindo a rodada e o orçamento acumulado…</div>}
        {(error || status?.error || status?.budget?.reason) && (
          <p role="alert" style={{ color: "#FFC38A" }}>
            {error || status?.error || status?.budget?.reason}
          </p>
        )}
        {status?.authenticated && <button
          onClick={() => void nextConversation()}
          disabled={advancing || abandoning || !status.nextConversation?.allowed}
          style={{ padding: "8px 12px", marginTop: 8 }}
        >{advancing ? "Arquivando conversa…" : "Abrir próxima conversa limpa"}</button>}
        {status?.authenticated && !status.abandonment && <>
          <label style={{ display: "block", marginTop: 8 }}>
            Motivo da desistência (opcional; não será enviado à IA)
            <input value={abandonReason} onChange={e => setAbandonReason(e.target.value)}
              maxLength={2000} disabled={abandoning}
              style={{ display: "block", width: "100%", maxWidth: 600, padding: 6 }} />
          </label>
          <button onClick={() => void abandonConversation()}
            disabled={abandoning || advancing || !status.abandonConversation?.allowed}
            style={{ padding: "8px 12px", marginTop: 8 }}
          >{abandoning ? "Registrando desistência…" : "Encerrar por desistência — não é aprovação"}</button>
        </>}
        {status?.authenticated && status.abandonment && <p role="status">
          Conversa encerrada por desistência. Não representa aprovação.
        </p>}
        {status?.authenticated && status.nextConversation?.reason === "BUDGET_PENDING" &&
          <p role="status">Próxima conversa bloqueada: há bloqueio ou contabilização pendente no orçamento. Custos não foram liberados.</p>}
      </section>
      {status?.authenticated && status.identity ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <Chat
            key={`${status.round}:${status.abandonment?.at ?? ""}`}
            user={status.identity}
            onLogout={() => void logout()}
            pilot
            onPilotTurn={() => void refresh()}
            pilotBlocked={!status.available || abandoning || advancing || Boolean(status.abandonment)}
          />
        </div>
      ) : (
        <section style={{ padding: 32, maxWidth: 560, margin: "auto" }}>
          <h1 style={{ fontSize: 24 }}>Entrar no piloto fictício</h1>
          <p>
            Somente a conta Replit do proprietário pode abrir esta rodada. Após
            a autorização, você assume a identidade fictícia; nenhum cadastro ou
            e-mail do app normal será usado.
          </p>
          <form method="POST" action={BASE + "/login"} target="_blank">
            <button
              disabled={!status?.available}
              style={{
                padding: "12px 20px",
                background: "#7B4FBF",
                color: "white",
                border: 0,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Entrar com Replit — abrir em nova aba
            </button>
          </form>
<form method="POST" action={BASE + "/login"} target="_self">
            <button
              disabled={!status?.available}
              style={{
                padding: "12px 20px",
                background: "#7B4FBF",
                color: "white",
                border: 0,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Entrar com Replit — nesta aba
            </button>
          </form>
          <p style={{ fontSize: 13 }}>
            Não copie códigos ou links de acesso. A autorização acontece no
            navegador. A nova aba também evita bloqueios de cookies na prévia
            incorporada.
          </p>
          <button
            onClick={() => void refresh()}
            style={{ padding: 8, marginTop: 10 }}
          >
            Atualizar estado de acesso
          </button>
        </section>
      )}
    </main>
  );
}
