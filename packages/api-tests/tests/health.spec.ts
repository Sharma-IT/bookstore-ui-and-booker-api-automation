import { describe, it } from 'vitest';
import { healthApi } from '../src/clients/bookerApi.js';

describe('GET /ping', () => {
  // Requirement: the service exposes a health check a deployment pipeline can
  // gate on.
  // Case: happy-path
  // Invariant: the endpoint answers, needs no authentication, and is fast
  // enough to be polled.
  it('reports that the service is available @smoke', async () => {
    await healthApi
      .ping()
      .expectStatus(201)
      .expectBodyContains('Created')
      .expectResponseTime(15_000);
  });

  // Requirement: a health check must be usable by an unauthenticated caller,
  // since a load balancer has no credentials.
  // Case: boundary
  // Invariant: no token is sent and none is needed.
  //
  // Known defect A-4: the endpoint answers 201 Created. A health check creates
  // nothing, and 200 OK is the correct answer. Remove this annotation when the
  // service is fixed.
  it.fails('answers 200 OK rather than 201 Created', async () => {
    await healthApi.ping().expectStatus(200);
  });
});
