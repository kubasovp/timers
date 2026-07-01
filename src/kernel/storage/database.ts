export type SqlValue = string | number | boolean | null;

export interface DatabaseConnection {
  execute(sql: string, params?: SqlValue[]): Promise<void>;
  select<TRow extends Record<string, unknown>>(
    sql: string,
    params?: SqlValue[]
  ): Promise<TRow[]>;
}
