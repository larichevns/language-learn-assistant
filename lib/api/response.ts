/**
 * HTTP response envelope `{ code, message, data }`. Error/Result types live in
 * ./errors (framework-free); re-exported here for convenience.
 */
import { NextResponse } from 'next/server';
import { ApiError } from './errors';

export { ApiError, ok, fail } from './errors';
export type { Result, ApiErrorBody } from './errors';

export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ code: 'ok', message: 'ok', data }, { status });
}

export function errorResponse(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ code, message, data: null }, { status });
}

/** Convert a thrown ApiError / unknown into a response (with any custom headers). */
export function handleApiError(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    const res = errorResponse(e.code, e.message, e.status);
    for (const [k, v] of Object.entries(e.headers ?? {})) res.headers.set(k, v);
    return res;
  }
  console.error('Unhandled API error:', e);
  return errorResponse('internal_error', 'Internal server error', 500);
}
