export interface FeedbackEvaluationCase {
  id: string;
  purpose: 'evaluation_case';
  origin: string;
  references: readonly {source:string;ref:string}[];
  userTurns: readonly string[];
  checks: readonly string[];
}
export function feedbackEvaluationCases(): readonly FeedbackEvaluationCase[];
