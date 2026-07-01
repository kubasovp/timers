import { appError } from "@/kernel/errors/app-error";
import type { Result } from "@/shared/result/result";
import { err } from "@/shared/result/result";

export type CommandId = string;
export type CommandHandler<TPayload = unknown, TResult = unknown> = (
  payload: TPayload
) => Promise<Result<TResult>> | Result<TResult>;

type AnyCommandHandler = (payload: unknown) => Promise<Result<unknown>> | Result<unknown>;

export class CommandRegistry {
  private readonly handlers = new Map<CommandId, AnyCommandHandler>();

  add<TPayload, TResult>(
    id: CommandId,
    handler: CommandHandler<TPayload, TResult>
  ): void {
    if (this.handlers.has(id)) {
      throw new Error(`Command already registered: ${id}`);
    }

    this.handlers.set(id, handler as AnyCommandHandler);
  }

  get(id: CommandId): AnyCommandHandler | undefined {
    return this.handlers.get(id);
  }

  list(): CommandId[] {
    return Array.from(this.handlers.keys()).sort();
  }
}

export class CommandBus {
  constructor(private readonly registry: CommandRegistry) {}

  async execute<TPayload = void, TResult = void>(
    id: CommandId,
    payload?: TPayload
  ): Promise<Result<TResult>> {
    const handler = this.registry.get(id);

    if (!handler) {
      return err(
        appError({
          code: "command.not_registered",
          message: `Command is not registered: ${id}`,
          category: "not_found"
        })
      );
    }

    return (await handler(payload as TPayload)) as Result<TResult>;
  }
}
