import { boolean, check, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questionsTable = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debtId: text("debt_id").notNull(),
    text: text("text").notNull(),
    weightType: text("weight_type").notNull(),
    active: boolean("active").default(true),
  },
  (table) => [
    check("questions_weight_type_check", sql`${table.weightType} IN ('I_PLUS', 'I', 'R')`),
  ],
);

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true });
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
