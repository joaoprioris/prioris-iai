import { and, eq, isNull, like, sql } from "drizzle-orm";
import { db, usersTable, organizationsTable } from "@workspace/db";
import { serializeAuthState, type AuthState } from "./auth-state";
const columns = { id: usersTable.id, email: usersTable.email, role: usersTable.role, organizationId: usersTable.organizationId, organizationName: organizationsTable.name, authToken: usersTable.authToken };
const base = () => db.select(columns).from(usersTable).innerJoin(organizationsTable, eq(usersTable.organizationId, organizationsTable.id));
export const authRepository = {
  async byEmail(email: string) { const [row] = await base().where(sql`lower(${usersTable.email}) = ${email}`).limit(1); return row ?? null; },
  async byCredential(kind: "pending" | "session", hash: string) {
    if (!/^[a-f0-9]{64}$/.test(hash)) return null;
    const pattern = '%"' + kind + '":{"hash":"' + hash + '"%';
    const [row] = await base().where(like(usersTable.authToken, pattern)).limit(1); return row ?? null;
  },
  async swap(id: string, before: string | null, after: AuthState | null) {
    const [row] = await db.update(usersTable).set({ authToken: after ? serializeAuthState(after) : null }).where(and(eq(usersTable.id, id), before === null ? isNull(usersTable.authToken) : eq(usersTable.authToken, before))).returning({ id: usersTable.id });
    return Boolean(row);
  },
};
export type AuthRow = NonNullable<Awaited<ReturnType<typeof authRepository.byEmail>>>;
export function publicUser(row: AuthRow) { return { id: row.id, email: row.email, role: row.role ?? "leader", organizationId: row.organizationId, organizationName: row.organizationName }; }
