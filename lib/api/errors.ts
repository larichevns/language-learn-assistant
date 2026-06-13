/** Framework-free error + Result types (safe to import outside the Next runtime). */
export interface ApiErrorBody {
  code: string;
  message: string;
  status: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiErrorBody };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}
export function fail(code: string, message: string, status = 400): Result<never> {
  return { ok: false, error: { code, message, status } };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
