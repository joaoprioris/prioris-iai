import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { questionsTable } from "./questions";

export const surveyTrackingTable = pgTable("survey_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  questionId: uuid("question_id").notNull().references(() => questionsTable.id),
  shownAt: timestamp("shown_at", { withTimezone: true }).defaultNow(),
});

export const insertSurveyTrackingSchema = createInsertSchema(surveyTrackingTable).omit({ id: true, shownAt: true });
export type InsertSurveyTracking = z.infer<typeof insertSurveyTrackingSchema>;
export type SurveyTracking = typeof surveyTrackingTable.$inferSelect;
