export interface FeedbackOperationalScope {
  revision: string;
  canonical: Record<string, unknown>;
  role: string;
  inputs: readonly string[];
  help: readonly string[];
  limits: readonly string[];
  conclusion: readonly string[];
}
export function feedbackOperationalScope(contract?: unknown): FeedbackOperationalScope;
export function feedbackOperationalInstructions(contract?: unknown): string;
