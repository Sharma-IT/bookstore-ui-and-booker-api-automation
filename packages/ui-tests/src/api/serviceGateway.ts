import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { z } from 'zod';

/**
 * A gateway, in Fowler's sense: it encapsulates access to the Book Store
 * service behind an interface shaped for this suite.
 *
 * It implements no transport of its own. Playwright's `APIRequestContext`
 * performs every request, which keeps the suite on a single networking stack
 * and means a failed call is rendered into the trace and the test report with
 * its method, URL and headers intact. What this type adds is the three
 * policies the suite wants on every call, and nothing else: a timeout sized
 * for the service, an expected-status check, and schema validation.
 *
 * Test state is seeded and torn down through the service rather than the user
 * interface. That keeps each scenario focused on the behaviour it is actually
 * asserting, keeps setup fast enough to run on every commit, and means user
 * registration can stay out of the automated scope without leaving the suite
 * dependent on a shared, pre-existing account.
 */

export class ApiError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(`${method} ${path} responded ${status}: ${body}`);
    this.name = 'ApiError';
  }
}

export type RequestOptions = {
  readonly token?: string;
  readonly payload?: unknown;
  readonly expectedStatus?: readonly number[];
};

const authorisationHeaders = (token: string | undefined): Record<string, string> =>
  token === undefined ? {} : { Authorization: `Bearer ${token}` };

export class ServiceGateway {
  /**
   * `timeoutMs` is passed on every call because a request context created
   * inside a test otherwise inherits the interface action timeout, which is a
   * budget for a click rather than for a round trip to the service.
   */
  constructor(
    private readonly request: APIRequestContext,
    private readonly timeoutMs: number,
  ) {}

  async send(
    method: 'get' | 'post' | 'delete',
    path: string,
    { token, payload, expectedStatus }: RequestOptions = {},
  ): Promise<APIResponse> {
    const response = await this.request[method](path, {
      headers: { 'Content-Type': 'application/json', ...authorisationHeaders(token) },
      timeout: this.timeoutMs,
      ...(payload === undefined ? {} : { data: payload }),
    });

    const acceptable = expectedStatus ?? [200, 201, 204];

    if (!acceptable.includes(response.status())) {
      throw new ApiError(method.toUpperCase(), path, response.status(), await response.text());
    }

    return response;
  }

  /**
   * Parses a response against a schema. A shape change in the service surfaces
   * here, named, rather than as an undefined value in an unrelated assertion.
   */
  async sendAndParse<T>(
    schema: z.ZodType<T>,
    method: 'get' | 'post' | 'delete',
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await this.send(method, path, options);
    const result = schema.safeParse(await response.json());

    if (!result.success) {
      throw new ApiError(
        method.toUpperCase(),
        path,
        response.status(),
        `unexpected response shape: ${result.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      );
    }

    return result.data;
  }
}
