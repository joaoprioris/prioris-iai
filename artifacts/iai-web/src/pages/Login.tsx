import { useState, FormEvent } from "react";
import { AuthUser } from "../hooks/useAuth";

interface LoginProps {
  onLogin: (token: string, user: AuthUser) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "token" | "loading">("email");
  const [devToken, setDevToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState("");

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

      // Dev mode: token returned directly
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

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#0D0D0D" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#F2F2F2" }}>
            IAí
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#666" }}>
            Suporte à decisão executiva
          </p>
        </div>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded text-sm"
            style={{ background: "#1a0a0a", color: "#ff6b6b", border: "1px solid #3a1a1a" }}
          >
            {error}
          </div>
        )}

        {(step === "email" || step === "loading") && (
          <form onSubmit={handleRequestLink} className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "#999" }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={step === "loading"}
                className="w-full px-4 py-3 rounded outline-none transition-colors text-sm"
                style={{
                  background: "#1a1a1a",
                  color: "#F2F2F2",
                  border: "1px solid #2a2a2a",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#444")}
                onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
              />
            </div>
            <button
              type="submit"
              disabled={step === "loading" || !email}
              className="w-full py-3 rounded text-sm font-medium transition-opacity disabled:opacity-40"
              style={{ background: "#F2F2F2", color: "#0D0D0D" }}
            >
              {step === "loading" ? "Aguarde..." : "Entrar"}
            </button>
          </form>
        )}

        {step === "token" && (
          <form onSubmit={handleVerifyToken} className="space-y-4">
            <p className="text-sm" style={{ color: "#888" }}>
              Verifique seu e-mail e cole o token de acesso abaixo.
            </p>
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Cole o token aqui"
              required
              autoFocus
              className="w-full px-4 py-3 rounded outline-none text-sm font-mono"
              style={{
                background: "#1a1a1a",
                color: "#F2F2F2",
                border: "1px solid #2a2a2a",
              }}
            />
            <button
              type="submit"
              disabled={!tokenInput.trim()}
              className="w-full py-3 rounded text-sm font-medium disabled:opacity-40"
              style={{ background: "#F2F2F2", color: "#0D0D0D" }}
            >
              Verificar
            </button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full py-2 text-sm"
              style={{ color: "#666" }}
            >
              Voltar
            </button>
          </form>
        )}

        {devToken && (
          <div
            className="mt-4 px-3 py-2 rounded text-xs font-mono break-all"
            style={{ background: "#111", color: "#555", border: "1px solid #1e1e1e" }}
          >
            dev: {devToken}
          </div>
        )}
      </div>
    </div>
  );
}
