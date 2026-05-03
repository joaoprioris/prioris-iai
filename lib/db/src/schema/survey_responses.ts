import { check, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const surveyResponsesTable = pgTable(
  "survey_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
    questionId: uuid("question_id").notNull(),
    answerValue: integer("answer_value").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    check("survey_responses_answer_value_check", sql`${table.answerValue} BETWEEN 0 AND 4`),
  ],
);

export const insertSurveyResponseSchema = createInsertSchema(surveyResponsesTable).omit({ id: true, createdAt: true });
export type InsertSurveyResponse = z.infer<typeof insertSurveyResponseSchema>;
export type SurveyResponse = typeof surveyResponsesTable.$inferSelect;
