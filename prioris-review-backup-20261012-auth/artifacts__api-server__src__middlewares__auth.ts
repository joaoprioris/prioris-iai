import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, organizationsTable } from "@workspace/db";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
    organizationName: string;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de autenticação ausente." });
    return;
  }

  const token = authHeader.slice(7);

  const [row] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      role: usersTable.role,
      organizationId: usersTable.organizationId,
      organizationName: organizationsTable.name,
    })
    .from(usersTable)
    .innerJoin(organizationsTable, eq(usersTable.organizationId, organizationsTable.id))
    .where(eq(usersTable.authToken, token));

  if (!row) {
    res.status(401).json({ error: "Token inválido ou expirado." });
    return;
  }

  req.user = {
    id: row.id,
    email: row.email,
    role: row.role ?? "leader",
    organizationId: row.organizationId,
    organizationName: row.organizationName,
  };

  next();
}
