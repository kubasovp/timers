export interface RouteRegistration {
  path: string;
  label: string;
  featureId: string;
  component: unknown;
  props?: Record<string, unknown>;
}

export class RouteRegistry {
  private readonly routes = new Map<string, RouteRegistration>();

  add(route: RouteRegistration): void {
    if (this.routes.has(route.path)) {
      throw new Error(`Route already registered: ${route.path}`);
    }

    this.routes.set(route.path, route);
  }

  get(path: string): RouteRegistration | undefined {
    return this.routes.get(path);
  }

  list(): RouteRegistration[] {
    return Array.from(this.routes.values()).sort((a, b) => a.path.localeCompare(b.path));
  }
}
