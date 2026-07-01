import { describe, expect, it } from "vitest";
import type { DatabaseConnection, SqlValue } from "@/kernel/storage/database";
import { SqliteMigrationRunner } from "./migration-runner";

describe("SqliteMigrationRunner", () => {
  it("applies only pending migrations and records metadata", async () => {
    const db = new FakeMigrationDatabase(["system.v1"]);
    const runner = new SqliteMigrationRunner(db);

    await runner.apply([
      {
        id: "system.v1",
        description: "Already applied",
        statements: ["create table ignored (id text)"]
      },
      {
        id: "custom-timer.v1",
        description: "Timer tables",
        statements: ["create table active_timer_sessions (id text primary key)"]
      }
    ]);

    expect(db.executedSql).toContain("begin immediate");
    expect(db.executedSql).toContain("create table active_timer_sessions (id text primary key)");
    expect(db.executedSql).not.toContain("create table ignored (id text)");
    expect(db.executedSql).toContain("commit");
    expect(db.appliedIds()).toEqual(["custom-timer.v1", "system.v1"]);
  });
});

class FakeMigrationDatabase implements DatabaseConnection {
  readonly executedSql: string[] = [];
  private readonly applied = new Set<string>();

  constructor(appliedIds: string[] = []) {
    for (const id of appliedIds) {
      this.applied.add(id);
    }
  }

  async execute(sql: string, params: SqlValue[] = []): Promise<void> {
    this.executedSql.push(normalizeSql(sql));

    if (normalizeSql(sql).startsWith("insert into schema_migrations")) {
      this.applied.add(String(params[0]));
    }
  }

  async select<TRow extends Record<string, unknown>>(): Promise<TRow[]> {
    return Array.from(this.applied)
      .sort()
      .map((id) => ({ id }) as unknown as TRow);
  }

  appliedIds(): string[] {
    return Array.from(this.applied).sort();
  }
}

function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, " ");
}
