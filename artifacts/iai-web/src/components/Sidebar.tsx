import { useState, useEffect, useCallback } from "react";
import { getToken } from "../hooks/useAuth";

interface SessionSummary {
  id: string;
  agentType: string;
  exchangeCount: number;
  status: string;
  createdAt: string;
  firstMessage?: string;
}

interface SidebarProps {
  currentSessionId: string | null;
  onSelectSession: (session: SessionSummary) => void;
  onNewSession: () => void;
  refreshTrigger: number;
}

const AGENT_LABELS: Record<string, string> = {
  MNT: "Decisão",
  IMP: "Impacto",
  FBK: "Feedback",
  OTO: "Conversa",
  CTN: "Contenção",
  CRS: "Crise",
  PRF: "Padrões",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return `${days} dias atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function Sidebar({ currentSessionId, onSelectSession, onNewSession, refreshTrigger }: SidebarProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const mapped: SessionSummary[] = data.map((s: Record<string, unknown>) => {
        const ctx = s.context as { messages?: { role: string; content: string }[] } | null;
        const firstMsg = ctx?.messages?.find((m) => m.role === "user")?.content;
        return {
          id: s.id as string,
          agentType: (s.agentType as string) ?? "MNT",
          exchangeCount: (s.exchangeCount as number) ?? 0,
          status: (s.status as string) ?? "active",
          createdAt: s.createdAt as string,
          firstMessage: firstMsg,
        };
      });
      setSessions(mapped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, refreshTrigger]);

  return (
    <div
      className="flex flex-col shrink-0 transition-all duration-200"
      style={{
        width: open ? "220px" : "48px",
        borderRight: "1px solid #1a1a1a",
        background: "#080808",
        overflow: "hidden",
      }}
    >
      {/* Toggle + header */}
      <div
        className="flex items-center shrink-0 px-3 py-3"
        style={{ borderBottom: "1px solid #111" }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          title={open ? "Fechar histórico" : "Ver histórico"}
          className="flex items-center justify-center rounded transition-colors"
          style={{ color: "#444", width: 24, height: 24 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="4" width="12" height="1.2" rx="0.6" fill="currentColor" />
            <rect x="2" y="7.4" width="12" height="1.2" rx="0.6" fill="currentColor" />
            <rect x="2" y="10.8" width="12" height="1.2" rx="0.6" fill="currentColor" />
          </svg>
        </button>

        {open && (
          <span className="ml-2 text-xs font-medium tracking-wide truncate" style={{ color: "#444" }}>
            Sessões
          </span>
        )}
      </div>

      {open && (
        <>
          {/* New session button */}
          <div className="px-2 pt-3 pb-2 shrink-0">
            <button
              onClick={onNewSession}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors"
              style={{ color: "#888", border: "1px dashed #222" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#333";
                e.currentTarget.style.color = "#aaa";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#222";
                e.currentTarget.style.color = "#888";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Nova sessão
            </button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {loading && sessions.length === 0 && (
              <p className="text-xs px-2 py-3" style={{ color: "#333" }}>
                Carregando...
              </p>
            )}

            {!loading && sessions.length === 0 && (
              <p className="text-xs px-2 py-3" style={{ color: "#2a2a2a" }}>
                Nenhuma sessão ainda.
              </p>
            )}

            {sessions.map((s) => {
              const isActive = s.id === currentSessionId;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectSession(s)}
                  className="w-full text-left rounded-lg px-2 py-2 mb-1 transition-colors"
                  style={{
                    background: isActive ? "#151515" : "transparent",
                    border: isActive ? "1px solid #222" : "1px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "#111";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className="text-xs font-medium truncate"
                      style={{ color: isActive ? "#D4D4D4" : "#555" }}
                    >
                      {AGENT_LABELS[s.agentType] ?? s.agentType}
                    </span>
                    <span className="text-xs shrink-0 ml-1 tabular-nums" style={{ color: "#333" }}>
                      {s.exchangeCount}/{10}
                    </span>
                  </div>
                  {s.firstMessage ? (
                    <p className="text-xs truncate" style={{ color: "#333" }}>
                      {s.firstMessage}
                    </p>
                  ) : (
                    <p className="text-xs italic" style={{ color: "#252525" }}>
                      Sessão vazia
                    </p>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: "#2a2a2a" }}>
                    {formatDate(s.createdAt)}
                    {s.status === "closed" && (
                      <span className="ml-1" style={{ color: "#2a2a2a" }}>· encerrada</span>
                    )}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
