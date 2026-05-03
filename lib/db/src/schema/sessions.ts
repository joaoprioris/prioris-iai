import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  agentType: text("agent_type").notNull(),
  context: jsonb("context").default({}),
  exchangeCount: integer("exchange_count").default(0),
  status: text("status").default("active"),
  incident: boolean("incident").default(false),
  incidentReason: text("incident_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, createdAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
