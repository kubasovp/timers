import Database from "@tauri-apps/plugin-sql";
import type { DatabaseConnection, SqlValue } from "@/kernel/storage/database";

export const APP_DATABASE_URL = "sqlite:timers.db";

export class TauriSqliteDatabaseConnection implements DatabaseConnection {
  constructor(private readonly database: Database) {}

  async execute(sql: string, params: SqlValue[] = []): Promise<void> {
    await this.database.execute(sql, params);
  }

  async select<TRow extends Record<string, unknown>>(
    sql: string,
    params: SqlValue[] = []
  ): Promise<TRow[]> {
    return this.database.select<TRow[]>(sql, params);
  }

  async close(): Promise<void> {
    await this.database.close(this.database.path);
  }
}

export async function openTauriSqliteDatabase(
  databaseUrl = APP_DATABASE_URL
): Promise<TauriSqliteDatabaseConnection> {
  return new TauriSqliteDatabaseConnection(await Database.load(databaseUrl));
}
