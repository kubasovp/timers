import type { DatabaseConnection } from "@/kernel/storage/database";
import type { Migration, MigrationRunner } from "@/kernel/storage/migrations";

interface MigrationRow extends Record<string, unknown> {
  id: string;
}

export class SqliteMigrationRunner implements MigrationRunner {
  constructor(private readonly db: DatabaseConnection) {}

  async apply(migrations: Migration[]): Promise<void> {
    await this.db.execute(
      `create table if not exists schema_migrations (
        id text primary key,
        description text not null,
        applied_at_utc text not null
      )`
    );

    const applied = new Set(
      (
        await this.db.select<MigrationRow>(
          `select id from schema_migrations order by id asc`
        )
      ).map((row) => row.id)
    );

    for (const migration of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
      if (applied.has(migration.id)) {
        continue;
      }

      await this.applyMigration(migration);
      applied.add(migration.id);
    }
  }

  private async applyMigration(migration: Migration): Promise<void> {
    await this.db.execute("begin immediate");

    try {
      for (const statement of migration.statements) {
        await this.db.execute(statement);
      }

      await this.db.execute(
        `insert into schema_migrations (id, description, applied_at_utc)
         values (?, ?, ?)`,
        [migration.id, migration.description, new Date().toISOString()]
      );
      await this.db.execute("commit");
    } catch (error) {
      await this.db.execute("rollback").catch(() => undefined);
      throw error;
    }
  }
}
