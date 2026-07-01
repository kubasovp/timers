export type AppErrorCategory =
  | "validation"
  | "domain"
  | "not_found"
  | "conflict"
  | "platform"
  | "unknown";

export interface AppError {
  code: string;
  message: string;
  category: AppErrorCategory;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export function appError(input: {
  code: string;
  message: string;
  category?: AppErrorCategory;
  details?: Record<string, unknown>;
  cause?: unknown;
}): AppError {
  return {
    code: input.code,
    message: input.message,
    category: input.category ?? "unknown",
    details: input.details,
    cause: input.cause
  };
}
