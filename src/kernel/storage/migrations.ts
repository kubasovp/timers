export interface Migration {
  id: string;
  description: string;
  statements: string[];
}

export interface MigrationRunner {
  apply(migrations: Migration[]): Promise<void>;
}

export class MigrationRegistry {
  private readonly migrations = new Map<string, Migration>();

  add(migrations: Migration | Migration[]): void {
    const entries = Array.isArray(migrations) ? migrations : [migrations];

    for (const migration of entries) {
      if (this.migrations.has(migration.id)) {
        throw new Error(`Migration already registered: ${migration.id}`);
      }

      this.migrations.set(migration.id, migration);
    }
  }

  list(): Migration[] {
    return Array.from(this.migrations.values()).sort((a, b) => a.id.localeCompare(b.id));
  }
}
