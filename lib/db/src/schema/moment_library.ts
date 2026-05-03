import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const momentLibraryTable = pgTable("moment_library", {
  id: uuid("id").primaryKey().defaultRandom(),
  momentCode: text("moment_code").unique().notNull(),
  agent: text("agent").notNull(),
  momentName: text("moment_name").notNull(),
  description: text("description"),
  debtPrimary: text("debt_primary").notNull(),
  debtAdjacent: text("debt_adjacent"),
  contextType: text("context_type").notNull(),
  triggerPhase: text("trigger_phase"),
  exampleInput: text("example_input"),
  responseNotes: text("response_notes"),
  status: text("status").default("draft"),
});

export const insertMomentLibrarySchema = createInsertSchema(momentLibraryTable).omit({ id: true });
export type InsertMomentLibrary = z.infer<typeof insertMomentLibrarySchema>;
export type MomentLibrary = typeof momentLibraryTable.$inferSelect;
