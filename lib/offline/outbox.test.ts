import { describe, expect, it } from 'vitest';
import { ApiClientError } from '../api/client';
import { isNetworkError } from './outbox';

describe('isNetworkError', () => {
  it('treats a server answer (ApiClientError) as NOT a connectivity problem', () => {
    expect(isNetworkError(new ApiClientError('invalid', 'Bad request', 400))).toBe(false);
    expect(isNetworkError(new ApiClientError('server', 'Boom', 500))).toBe(false);
  });

  it('treats a fetch TypeError as a network error (queue it)', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('treats a generic error as not a network error', () => {
    expect(isNetworkError(new Error('boom'))).toBe(false);
  });
});
