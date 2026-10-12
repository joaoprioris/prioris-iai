import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from "react";
import { getToken, AuthUser } from "../hooks/useAuth";
import SurveyCard from "../components/SurveyCard";
import HistorySettings from '../components/HistorySettings';
import IaiIcon from "../components/IaiIcon";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface SurveyQuestion {
  id: string;
  text: string;
  debtId: string;
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
  const [surveyQuestion, setSurveyQuestion] = useState<SurveyQuestion | null>(null);
  const [surveyDismissed, setSurveyDismissed] = useState(false);
  const pendingRequestRef = useRef<{id:string;sessionId:string;content:string}|null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, surveyQuestion, sessionClosed]);

  useEffect(() => {
    createSession();
  }, []);

  const createSession = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ agentType: "MNT" }),
      });
      if (!res.ok) { setError("Não foi possível iniciar a sessão."); return; }
      const session = await res.json();
      setSessionId(session.id);
      setExchangeCount(session.exchangeCount ?? 0);
    } catch {
      setError("Erro de conexão ao iniciar sessão.");
    }
  };

  const handleNewSession = async () => {
    pendingRequestRef.current = null;
    setSessionId(null);
    setMessages([]);
    setExchangeCount(0);
    setSessionClosed(false);
    setSurveyQuestion(null);
    setSurveyDismissed(false);
    setError("");
    await createSession();
  };

  const sendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !sessionId || sending || sessionClosed) return;

    const token = getToken();
    if (!token) return;

    const previousRequest = pendingRequestRef.current;
    const requestId = previousRequest?.sessionId === sessionId && previousRequest.content === text ? previousRequest.id : crypto.randomUUID();
    pendingRequestRef.current = {id:requestId,sessionId,content:text};
    setInput("");
    setSending(true);
    setError("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "", streaming: true },
    ]);

    try {
      const res = await fetch("/api/session/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, content: text, requestId }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao enviar mensagem.");
        if (data.code === "REQUEST_ALREADY_COMPLETED" || data.code === "SESSION_CLOSED") setSessionClosed(true);
        setMessages((prev) => prev.slice(0, -2));
        setInput(text);
        setSending(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

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
                  updated[updated.length - 1] = { ...last, content: last.content + event.content, streaming: true };
                }
                return updated;
              });
            } else if (event.type === "replace_last") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: event.content, streaming: true };
                }
                return updated;
              });
            } else if (event.type === "done") {
              completed = true;
              pendingRequestRef.current = null;
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
              if (event.surveyQuestion) setSurveyQuestion(event.surveyQuestion);
            } else if (event.type === "error") {
              setError(event.error ?? "Erro no agente.");
              setMessages((prev) => prev.slice(0, -2));
        setInput(text);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
      if (!completed) throw new Error("INCOMPLETE_STREAM");
    } catch {
      setError("A resposta não chegou por completo. Tente enviar a mesma mensagem novamente.");
      setMessages((prev) => prev.slice(0, -2));
        setInput(text);
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

  // Index of the last assistant message — gets closing card style when session is closed
  const closingMessageIndex = sessionClosed
    ? messages.reduce((acc, msg, i) => (msg.role === "assistant" ? i : acc), -1)
    : -1;

  return (
    // Full-screen centered container — 420px max on desktop
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        maxWidth: "420px",
        margin: "0 auto",
        background: "#0D0D0D",
        overflow: "hidden",
      }}
    >
      {/* Radial ambient glow at bottom */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          top: "auto",
          bottom: 0,
          left: 0,
          right: 0,
          height: "380px",
          background: "radial-gradient(ellipse at bottom center, rgba(123,79,191,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          flexShrink: 0,
          height: "56px",
          paddingTop: "env(safe-area-inset-top, 0px)",
          background: "#0D0D0D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IaiIcon width={28} height={33} />
            <span style={{ color: "#F2F2F2", fontSize: "18px", fontWeight: 700, lineHeight: 1 }}>IAí</span>
          </div>
          <div style={{ color: "#B8953F", fontSize: "10px", letterSpacing: "0.12em", fontWeight: 400 }}>
            by PRIORIS
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            position: "absolute",
            right: "16px",
            background: "none",
            border: "none",
            color: "rgba(242,242,242,0.22)",
            fontSize: "11px",
            cursor: "pointer",
            padding: "8px",
            fontFamily: "inherit",
            minHeight: "44px",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(242,242,242,0.5)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,242,0.22)")}
        >
          sair
        </button>
      </header>
      <HistorySettings busy={sending} onErased={() => { void handleNewSession(); }} />

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Exchange counter — sticky top-right */}
        <div
          style={{
            position: "sticky",
            top: 0,
            display: "flex",
            justifyContent: "flex-end",
            padding: "8px 16px 4px",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: remaining <= 2 ? "#8B0000" : "rgba(242,242,242,0.45)",
              transition: "color 0.3s",
            }}
          >
            {remaining} restante{remaining !== 1 ? "s" : ""}
          </span>
        </div>

        <div
          style={{
            padding: "4px 16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {/* Empty state */}
          {messages.length === 0 && !sending && (
            <div style={{ textAlign: "center", paddingTop: "80px" }}>
              <p style={{ color: "rgba(242,242,242,0.28)", fontSize: "14px", margin: 0 }}>
                O que você precisa decidir hoje?
              </p>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => {
            const isClosingCard = i === closingMessageIndex && !msg.streaming;

            if (msg.role === "user") {
              return (
                <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div
                    style={{
                      maxWidth: "82%",
                      background: "#1E1A2E",
                      borderRadius: "12px 12px 2px 12px",
                      padding: "12px 16px",
                      color: "#F2F2F2",
                      fontSize: "14px",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            }

            // Assistant message
            return (
              <div key={i} style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    maxWidth: isClosingCard ? "100%" : "82%",
                    width: isClosingCard ? "100%" : undefined,
                    background: "#130D22",
                    border: isClosingCard
                      ? "1px solid rgba(123,79,191,0.4)"
                      : "1px solid rgba(123,79,191,0.3)",
                    borderRadius: isClosingCard ? "12px" : "12px 12px 12px 2px",
                    padding: "12px 16px",
                    color: "#F2F2F2",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.streaming && msg.content === "" ? (
                    <div style={{ display: "flex", gap: "5px", padding: "4px 0" }}>
                      <span className="typing-dot" />
                      <span className="typing-dot typing-dot-2" />
                      <span className="typing-dot typing-dot-3" />
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            );
          })}

          {/* Survey card — shown after closing when eligible */}
          {sessionClosed && surveyQuestion && !surveyDismissed && (
            <SurveyCard
              question={surveyQuestion}
              sessionId={sessionId}
              onDismiss={() => setSurveyDismissed(true)}
            />
          )}

          {/* Nova Conversa — shown when session is closed */}
          {sessionClosed && (
            <button
              onClick={handleNewSession}
              style={{
                width: "100%",
                height: "48px",
                background: "#7B4FBF",
                color: "#F2F2F2",
                fontWeight: 600,
                fontSize: "14px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                marginTop: "4px",
                fontFamily: "inherit",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#9B6FDF")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#7B4FBF")}
            >
              Nova Conversa
            </button>
          )}

          {/* Error */}
          {error && (
            <p style={{ color: "#8B0000", fontSize: "12px", textAlign: "center", margin: 0 }}>
              {error}
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      {!sessionClosed && (
        <div
          style={{
            flexShrink: 0,
            position: "relative",
            zIndex: 10,
            background: "#130D22",
            borderTop: "1px solid rgba(123,79,191,0.2)",
            padding: "12px 16px",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Escreva sua mensagem..."
              disabled={sending || !sessionId}
              rows={1}
              className="chat-textarea flex-1"
              style={{ opacity: sending || !sessionId ? 0.4 : 1 }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending || !sessionId}
              style={{
                flexShrink: 0,
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "#7B4FBF",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: !input.trim() || sending || !sessionId ? "not-allowed" : "pointer",
                opacity: !input.trim() || sending || !sessionId ? 0.3 : 1,
                transition: "background 0.15s, opacity 0.15s",
                minWidth: "36px",
                minHeight: "36px",
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#9B6FDF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#7B4FBF"; }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 8L14 8M14 8L9 3M14 8L9 13"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
