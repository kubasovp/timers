export interface ErrorLike {
  message: string;
  code?: string;
}

export type Result<T, E = ErrorLike> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<T = never, E = ErrorLike>(error: E): Result<T, E> {
  return { ok: false, error };
}
