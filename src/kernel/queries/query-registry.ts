import { appError } from "@/kernel/errors/app-error";
import type { Result } from "@/shared/result/result";
import { err } from "@/shared/result/result";

export type QueryId = string;
export type QueryHandler<TPayload = unknown, TResult = unknown> = (
  payload: TPayload
) => Promise<Result<TResult>> | Result<TResult>;

type AnyQueryHandler = (payload: unknown) => Promise<Result<unknown>> | Result<unknown>;

export class QueryRegistry {
  private readonly handlers = new Map<QueryId, AnyQueryHandler>();

  add<TPayload, TResult>(id: QueryId, handler: QueryHandler<TPayload, TResult>): void {
    if (this.handlers.has(id)) {
      throw new Error(`Query already registered: ${id}`);
    }

    this.handlers.set(id, handler as AnyQueryHandler);
  }

  get(id: QueryId): AnyQueryHandler | undefined {
    return this.handlers.get(id);
  }

  list(): QueryId[] {
    return Array.from(this.handlers.keys()).sort();
  }
}

export class QueryBus {
  constructor(private readonly registry: QueryRegistry) {}

  async execute<TPayload = void, TResult = void>(
    id: QueryId,
    payload?: TPayload
  ): Promise<Result<TResult>> {
    const handler = this.registry.get(id);

    if (!handler) {
      return err(
        appError({
          code: "query.not_registered",
          message: `Query is not registered: ${id}`,
          category: "not_found"
        })
      );
    }

    return (await handler(payload as TPayload)) as Result<TResult>;
  }
}
