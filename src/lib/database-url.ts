/** Default local Postgres URL. Docker Compose uses the same credentials and may set DATABASE_URL. */
export const DEFAULT_DATABASE_URL =
  "postgresql://cove:cove@127.0.0.1:5432/cove?connect_timeout=3";

export const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
