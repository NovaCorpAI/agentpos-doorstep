/**
 * Typed errors. Every failure that crosses a module boundary carries a machine-readable
 * code, a human message and a hint on how to fix it.
 */
export interface TypedError {
  code: string;
  message: string;
  hint: string;
}

export class DoorstepError extends Error implements TypedError {
  readonly code: string;
  readonly hint: string;
  constructor(code: string, message: string, hint: string) {
    super(message);
    this.name = "DoorstepError";
    this.code = code;
    this.hint = hint;
  }
  toJSON(): TypedError {
    return { code: this.code, message: this.message, hint: this.hint };
  }
}

export type Result<T, E extends TypedError = TypedError> = { ok: true; value: T } | { ok: false; error: E };
