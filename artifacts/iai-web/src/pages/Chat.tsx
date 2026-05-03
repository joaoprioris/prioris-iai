import { useState, useEffect, useRef, FormEvent, KeyboardEvent, useCallback } from "react";
import { getToken, AuthUser } from "../hooks/useAuth";
import Sidebar from "../components/Sidebar";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface SessionSummary {
  id: string;
  agentType: string;
  exchangeCount: number;
  status: string;
  createdAt: string;
  firstMessage?: string;
}

interface ChatProps {
  user: AuthUser;
  onLogout: () => void;
}

const MAX_EXCHANGES = 10;

export default function Chat({ user, onLogout }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createSession = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ agentType: "MNT" }),
      });
      if (!res.ok) { setError("Não foi possível iniciar a sessão."); return; }
      const session = await res.json();
      setSessionId(session.id);
      setExchangeCount(session.exchangeCount ?? 0);
      setMessages([]);
      setSessionClosed(false);
      setError("");
      setSidebarRefresh((n) => n + 1);
    } catch {
      setError("Erro de conexão ao iniciar sessão.");
    }
  }, []);

  // Create a fresh session on first load
  useEffect(() => {
    createSession();
  }, [createSession]);

  const handleLoadSession = useCallback(async (summary: SessionSummary) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/sessions/${summary.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError("Não foi possível carregar a sessão."); return; }
      const session = await res.json();

      const ctx = session.context as { messages?: Message[] } | null;
      const restored: Message[] = (ctx?.messages ?? []).map((m: Message) => ({
        role: m.role,
        content: m.content,
      }));

      setSessionId(session.id);
      setExchangeCount(session.exchangeCount ?? 0);
      setSessionClosed(session.status === "closed");
      setMessages(restored);
      setError("");
    } catch {
      setError("Erro ao carregar sessão.");
    }
  }, []);

  const handleNewSession = useCallback(async () => {
    await createSession();
  }, [createSession]);

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !sessionId || sending || sessionClosed) return;

    const token = getToken();
    if (!token) return;

    setInput("");
    setSending(true);
    setError("");

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    const assistantMsg: Message = { role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/session/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId, content: text }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao enviar mensagem.");
        setMessages((prev) => prev.slice(0, -1));
        setSending(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);

            if (event.type === "token") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + event.content,
                    streaming: true,
                  };
                }
                return updated;
              });
            } else if (event.type === "done") {
              setExchangeCount(event.exchangeCount);
              setSessionClosed(event.status === "closed");
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, streaming: false };
                }
                return updated;
              });
              setSidebarRefresh((n) => n + 1);
            } else if (event.type === "error") {
              setError(event.error ?? "Erro no agente.");
              setMessages((prev) => prev.slice(0, -1));
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch {
      setError("Erro de conexão.");
      setMessages((prev) => prev.slice(0, -1));
    }

    setSending(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const remaining = MAX_EXCHANGES - exchangeCount;

  return (
    <div className="flex h-screen" style={{ background: "#0D0D0D", color: "#F2F2F2" }}>
      {/* Sidebar */}
      <Sidebar
        currentSessionId={sessionId}
        onSelectSession={handleLoadSession}
        onNewSession={handleNewSession}
        refreshTrigger={sidebarRefresh}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid #1a1a1a" }}
        >
          <span className="text-sm font-semibold tracking-wide" style={{ color: "#F2F2F2" }}>
            IAí
          </span>

          <div className="flex items-center gap-4">
            <span className="text-xs tabular-nums" style={{ color: "#333" }}>
              {exchangeCount}/{MAX_EXCHANGES}
            </span>
            <span className="text-xs" style={{ color: "#2a2a2a" }}>
              {user.email}
            </span>
            <button
              onClick={onLogout}
              className="text-xs transition-colors"
              style={{ color: "#444" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#888")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#444")}
            >
              sair
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {messages.length === 0 && !sending && (
              <div className="text-center pt-16">
                <p className="text-sm" style={{ color: "#2a2a2a" }}>
                  O que você precisa decidir hoje?
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={
                    msg.role === "user"
                      ? { background: "#1e1e1e", color: "#F2F2F2" }
                      : { color: "#D4D4D4" }
                  }
                >
                  {msg.content}
                  {msg.streaming && msg.content === "" && (
                    <span
                      className="inline-block w-1 h-4 ml-0.5 align-middle animate-pulse"
                      style={{ background: "#555" }}
                    />
                  )}
                </div>
              </div>
            ))}

            {sessionClosed && (
              <div className="text-center py-4">
                <p className="text-xs mb-3" style={{ color: "#444" }}>
                  Sessão encerrada — {MAX_EXCHANGES} trocas atingidas.
                </p>
                <button
                  onClick={handleNewSession}
                  className="text-xs px-4 py-2 rounded transition-colors"
                  style={{ background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#444")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
                >
                  Nova sessão
                </button>
              </div>
            )}

            {error && (
              <div className="text-center">
                <p className="text-xs" style={{ color: "#ff6b6b" }}>
                  {error}
                </p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        {!sessionClosed && (
          <div
            className="px-4 py-4 shrink-0"
            style={{ borderTop: "1px solid #1a1a1a" }}
          >
            <div className="max-w-2xl mx-auto">
              <form onSubmit={sendMessage} className="flex items-end gap-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Escreva sua mensagem..."
                  disabled={sending || !sessionId}
                  rows={1}
                  className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none transition-colors disabled:opacity-40"
                  style={{
                    background: "#1a1a1a",
                    color: "#F2F2F2",
                    border: "1px solid #2a2a2a",
                    minHeight: "48px",
                    maxHeight: "160px",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#444")}
                  onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending || !sessionId}
                  className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-opacity disabled:opacity-30"
                  style={{ background: "#F2F2F2" }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M2 8L14 8M14 8L9 3M14 8L9 13"
                      stroke="#0D0D0D"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </form>
              <p className="text-center text-xs mt-2" style={{ color: "#2a2a2a" }}>
                Enter para enviar · Shift+Enter para nova linha · {remaining} troca{remaining !== 1 ? "s" : ""} restante{remaining !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
