// Tests only. Never opens a socket or reads a database connection string.
export const pool = {
  query() { throw new Error('DATABASE_FORBIDDEN'); },
  connect() { throw new Error('DATABASE_FORBIDDEN'); },
};
export const db = {};
export const usersTable = {};
export const organizationsTable = {};
