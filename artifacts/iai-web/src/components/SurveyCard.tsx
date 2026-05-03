import { useState } from "react";
import { getToken } from "../hooks/useAuth";

interface SurveyQuestion {
  id: string;
  text: string;
  debtId: string;
}

interface SurveyCardProps {
  question: SurveyQuestion;
  sessionId: string | null;
  onDismiss: () => void;
}

const OPTIONS = [
  { label: "Nunca", value: 0 },
  { label: "Raramente", value: 1 },
  { label: "Às vezes", value: 2 },
  { label: "Frequentemente", value: 3 },
  { label: "Quase sempre", value: 4 },
];

export default function SurveyCard({ question, sessionId, onDismiss }: SurveyCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const submit = async (value: number) => {
    if (submitting || answered) return;
    setSubmitting(true);
    setSelected(value);
    const token = getToken();
    try {
      await fetch("/api/survey/response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ questionId: question.id, answerValue: value, sessionId }),
      });
    } catch {
      // silent — survey failure must never block the user
    }
    setAnswered(true);
    setSubmitting(false);
    setTimeout(onDismiss, 1200);
  };

  return (
    <div
      style={{
        background: "#1A1030",
        border: "1px solid rgba(123,79,191,0.5)",
        borderRadius: "12px",
        padding: "16px",
        marginTop: "4px",
      }}
    >
      {answered ? (
        <p
          style={{
            color: "rgba(242,242,242,0.4)",
            fontSize: "13px",
            textAlign: "center",
            margin: 0,
            padding: "4px 0",
          }}
        >
          Obrigado pelo seu feedback.
        </p>
      ) : (
        <>
          <p
            style={{
              color: "#F2F2F2",
              fontSize: "14px",
              lineHeight: 1.55,
              margin: "0 0 14px 0",
            }}
          >
            {question.text}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => submit(opt.value)}
                disabled={submitting}
                style={{
                  padding: "6px 12px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  border: "1px solid rgba(123,79,191,0.4)",
                  background: selected === opt.value ? "#7B4FBF" : "transparent",
                  color: selected === opt.value ? "#F2F2F2" : "rgba(242,242,242,0.8)",
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting && selected !== opt.value ? 0.4 : 1,
                  transition: "background 0.15s, color 0.15s, border-color 0.15s",
                  fontFamily: "inherit",
                  minHeight: "32px",
                }}
                onMouseEnter={(e) => {
                  if (!submitting && selected !== opt.value) {
                    e.currentTarget.style.borderColor = "rgba(123,79,191,0.8)";
                    e.currentTarget.style.color = "#F2F2F2";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selected !== opt.value) {
                    e.currentTarget.style.borderColor = "rgba(123,79,191,0.4)";
                    e.currentTarget.style.color = "rgba(242,242,242,0.8)";
                  }
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={onDismiss}
            style={{
              background: "none",
              border: "none",
              color: "rgba(242,242,242,0.4)",
              fontSize: "12px",
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(242,242,242,0.65)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(242,242,242,0.4)")}
          >
            pular
          </button>
        </>
      )}
    </div>
  );
}
