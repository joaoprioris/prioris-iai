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
      // silent — survey failure should never block the user
    }
    setAnswered(true);
    setSubmitting(false);
    setTimeout(onDismiss, 1200);
  };

  return (
    <div
      className="max-w-2xl mx-auto mt-4"
    >
      <div
        className="rounded-2xl px-5 py-4"
        style={{ background: "#141414", border: "1px solid #242424" }}
      >
        {answered ? (
          <p className="text-sm text-center py-1" style={{ color: "#555" }}>
            Obrigado pelo seu feedback.
          </p>
        ) : (
          <>
            <p className="text-sm mb-4" style={{ color: "#999" }}>
              {question.text}
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => submit(opt.value)}
                  disabled={submitting}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
                  style={{
                    background: selected === opt.value ? "#2a2a2a" : "#1a1a1a",
                    color: selected === opt.value ? "#F2F2F2" : "#888",
                    border: `1px solid ${selected === opt.value ? "#444" : "#242424"}`,
                  }}
                  onMouseEnter={(e) => {
                    if (!submitting) {
                      e.currentTarget.style.borderColor = "#444";
                      e.currentTarget.style.color = "#D4D4D4";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selected !== opt.value) {
                      e.currentTarget.style.borderColor = "#242424";
                      e.currentTarget.style.color = "#888";
                    }
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={onDismiss}
              className="text-xs transition-colors"
              style={{ color: "#333" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#555")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#333")}
            >
              pular
            </button>
          </>
        )}
      </div>
    </div>
  );
}
