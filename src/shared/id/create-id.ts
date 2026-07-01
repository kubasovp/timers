export interface IdGenerator {
  nextId(): string;
}

export class DefaultIdGenerator implements IdGenerator {
  nextId(): string {
    const cryptoApi = globalThis.crypto;

    if (cryptoApi?.randomUUID) {
      return cryptoApi.randomUUID();
    }

    return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
