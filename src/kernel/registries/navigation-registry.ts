export interface NavigationItem {
  label: string;
  path: string;
  featureId: string;
  order: number;
}

export class NavigationRegistry {
  private readonly items = new Map<string, NavigationItem>();

  add(item: NavigationItem): void {
    if (this.items.has(item.path)) {
      throw new Error(`Navigation item already registered: ${item.path}`);
    }

    this.items.set(item.path, item);
  }

  list(): NavigationItem[] {
    return Array.from(this.items.values()).sort((a, b) => a.order - b.order);
  }
}
