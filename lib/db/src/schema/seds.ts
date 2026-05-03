import { boolean, check, doublePrecision, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { sessionsTable } from "./sessions";

export const sedsTable = pgTable(
  "seds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => sessionsTable.id),
    organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
    debtPrimary: text("debt_primary").notNull(),
    debtAdjacent: text("debt_adjacent"),
    contextType: text("context_type").notNull(),
    actor: text("actor"),
    momentCode: text("moment_code"),
    momentPhase: text("moment_phase"),
    intensity: integer("intensity"),
    confidence: doublePrecision("confidence"),
    lowConfidence: boolean("low_confidence").default(false),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    check("seds_intensity_check", sql`${table.intensity} BETWEEN 1 AND 5`),
  ],
);

export const insertSedSchema = createInsertSchema(sedsTable).omit({ id: true, createdAt: true });
export type InsertSed = z.infer<typeof insertSedSchema>;
export type Sed = typeof sedsTable.$inferSelect;
