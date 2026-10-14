import { useCallback, useEffect, useState } from "react";
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
  }, [refresh]);
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
          {status?.round ?? 5}
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
        <div>
          Teto acumulado de todas as rodadas: US${status?.budget?.capUSD ?? 2} ·
          contabilizado: US${(status?.budget?.estimatedUSD ?? 0).toFixed(6)} ·
          chamadas acumuladas: {status?.budget?.calls ?? 0}. Não é saldo nem
          fatura exata.
        </div>
        {(error || status?.error || status?.budget?.reason) && (
          <p role="alert" style={{ color: "#FFC38A" }}>
            {error || status?.error || status?.budget?.reason}
          </p>
        )}
      {status?.authenticated && status.round === 10 && <form method="POST" action={BASE + "/sessions"} target="_blank"><button type="submit">Conferir sessão do teste encerrado</button></form>}</section>
      {status?.authenticated && status.identity ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <Chat
            user={status.identity}
            onLogout={() => void logout()}
            pilot
            onPilotTurn={() => void refresh()}
            pilotBlocked={!status.available}
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
