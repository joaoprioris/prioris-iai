import { useState, useEffect, FormEvent } from "react";
import { AuthUser } from "../hooks/useAuth";
import IaiIcon from "../components/IaiIcon";

interface LoginProps {
  onLogin: (token: string, user: AuthUser) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "token" | "loading">("email");
  const [devToken, setDevToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState("");

  // Auto-verify magic link token from URL (?token=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      // Clean the token from the URL immediately so it isn't re-used on refresh
      window.history.replaceState({}, "", window.location.pathname);
      setStep("loading");
      verifyAndLogin(urlToken);
    }
  }, []);

  const handleRequestLink = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setStep("loading");

    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "E-mail não encontrado.");
        setStep("email");
        return;
      }

      if (data.token) {
        setDevToken(data.token);
        await verifyAndLogin(data.token);
      } else {
        setStep("token");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setStep("email");
    }
  };

  const verifyAndLogin = async (t: string) => {
    try {
      const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(t)}`);
      const data = await res.json();

      if (!res.ok) {
        setError("Token inválido ou expirado.");
        setStep("token");
        return;
      }

      onLogin(t, data);
    } catch {
      setError("Erro ao verificar token.");
      setStep("token");
    }
  };

  const handleVerifyToken = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setStep("loading");
    await verifyAndLogin(tokenInput.trim());
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#130D22",
    color: "#F2F2F2",
    border: "1px solid rgba(123,79,191,0.25)",
    borderRadius: "8px",
    padding: "14px 16px",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  };

  return (
    <div
      className="fade-in"
      style={{
        minHeight: "100dvh",
        background: "#0D0D0D",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 24px",
        paddingTop: "calc(24px + env(safe-area-inset-top, 0px))",
        paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div style={{ width: "100%", maxWidth: "360px" }}>
        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: "48px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <IaiIcon width={40} height={47} />
          <div style={{ color: "#F2F2F2", fontSize: "22px", fontWeight: 700, lineHeight: 1.1, marginTop: "12px" }}>
            IAí
          </div>
          <div style={{ color: "#B8953F", fontSize: "10px", letterSpacing: "0.12em", marginTop: "4px" }}>
            by PRIORIS
          </div>
        </div>

        {/* Auto-verifying state */}
        {step === "loading" && !error && (
          <p style={{ color: "rgba(242,242,242,0.4)", fontSize: "13px", textAlign: "center" }}>
            Verificando acesso...
          </p>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 14px",
              borderRadius: "8px",
              background: "rgba(139,0,0,0.12)",
              border: "1px solid rgba(139,0,0,0.4)",
              color: "#F2F2F2",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {/* Email step */}
        {(step === "email" || (step === "loading" && !error && !tokenInput)) && step !== "loading" && (
          <form onSubmit={handleRequestLink} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "rgba(242,242,242,0.5)", marginBottom: "8px" }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#7B4FBF")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(123,79,191,0.25)")}
              />
            </div>
            <button
              type="submit"
              disabled={!email}
              style={{
                height: "48px",
                background: "#7B4FBF",
                color: "#F2F2F2",
                fontWeight: 600,
                fontSize: "14px",
                borderRadius: "8px",
                border: "none",
                cursor: !email ? "not-allowed" : "pointer",
                opacity: !email ? 0.4 : 1,
                transition: "opacity 0.15s, background 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#9B6FDF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#7B4FBF"; }}
            >
              Entrar
            </button>
          </form>
        )}

        {/* Token step */}
        {step === "token" && (
          <form onSubmit={handleVerifyToken} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ color: "rgba(242,242,242,0.55)", fontSize: "13px", lineHeight: 1.5, margin: 0 }}>
              Verifique seu e-mail e cole o token de acesso abaixo.
            </p>
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Cole o token aqui"
              required
              autoFocus
              style={{ ...inputStyle, fontFamily: "'Menlo', monospace", letterSpacing: "0.05em" }}
              onFocus={(e) => (e.target.style.borderColor = "#7B4FBF")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(123,79,191,0.25)")}
            />
            <button
              type="submit"
              disabled={!tokenInput.trim()}
              style={{
                height: "48px",
                background: "#7B4FBF",
                color: "#F2F2F2",
                fontWeight: 600,
                fontSize: "14px",
                borderRadius: "8px",
                border: "none",
                cursor: !tokenInput.trim() ? "not-allowed" : "pointer",
                opacity: !tokenInput.trim() ? 0.4 : 1,
                transition: "opacity 0.15s, background 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#9B6FDF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#7B4FBF"; }}
            >
              Verificar
            </button>
            <button
              type="button"
              onClick={() => setStep("email")}
              style={{
                background: "none",
                border: "none",
                color: "rgba(242,242,242,0.35)",
                fontSize: "13px",
                cursor: "pointer",
                padding: "8px",
                fontFamily: "inherit",
              }}
            >
              Voltar
            </button>
          </form>
        )}

        {/* Dev token display */}
        {devToken && (
          <div
            style={{
              marginTop: "16px",
              padding: "10px 12px",
              borderRadius: "6px",
              background: "#130D22",
              color: "rgba(242,242,242,0.3)",
              fontSize: "11px",
              fontFamily: "'Menlo', monospace",
              wordBreak: "break-all",
              border: "1px solid rgba(123,79,191,0.15)",
            }}
          >
            dev: {devToken}
          </div>
        )}
      </div>
    </div>
  );
}
