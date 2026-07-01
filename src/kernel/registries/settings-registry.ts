export interface SettingDefinition<TValue = unknown> {
  key: string;
  featureId: string;
  schemaVersion: number;
  defaultValue: TValue;
}

export class SettingsRegistry {
  private readonly settings = new Map<string, SettingDefinition>();

  add<TValue>(definition: SettingDefinition<TValue>): void {
    if (this.settings.has(definition.key)) {
      throw new Error(`Setting already registered: ${definition.key}`);
    }

    this.settings.set(definition.key, definition as SettingDefinition);
  }

  list(): SettingDefinition[] {
    return Array.from(this.settings.values()).sort((a, b) => a.key.localeCompare(b.key));
  }
}
