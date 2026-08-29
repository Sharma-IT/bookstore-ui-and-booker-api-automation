/* eslint-disable */
// @ts-nocheck
//
// ─────────────────────────────────────────────────────────────────────────────
// RAW AI OUTPUT — COMMITTED UNMODIFIED. DO NOT FIX THIS FILE.
//
// This is the verbatim first-pass output described in ./README.md, kept as the
// artefact Task 2 Part B asks for. It does not compile and does not run. The
// two directives above exist only to keep it out of the project's type check
// and lint, since it is evidence rather than source.
//
// Findings and corrections: ./REVIEW.md
// The corrected tests: ../tests/updateBooking.spec.ts
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll } from 'vitest';
import axios from 'axios';

const BASE_URL = 'https://restful-booker.herokuapp.com';

let token;
let bookingId;

describe('PATCH /booking/:id', () => {
  beforeAll(async () => {
    // Get auth token
    const authResponse = await axios.post(`${BASE_URL}/auth`, {
      username: 'admin',
      password: 'password123',
    });
    token = authResponse.data.token;

    // Create a booking to update
    const createResponse = await axios.post(`${BASE_URL}/booking`, {
      firstname: 'John',
      lastname: 'Smith',
      totalprice: 100,
      depositpaid: true,
      bookingdates: {
        checkin: '2024-01-01',
        checkout: '2024-01-05',
      },
      additionalneeds: 'Breakfast',
    });
    bookingId = createResponse.data.bookingid;
  });

  it('should update the firstname', async () => {
    const response = await axios.patch(
      `${BASE_URL}/booking/${bookingId}`,
      { firstname: 'Jane' },
      { headers: { Cookie: `token=${token}` } }
    );

    expect(response.status).toBe(200);
    expect(response.data.firstname).toBe('Jane');
  });

  it('should update the lastname', async () => {
    const response = await axios.patch(
      `${BASE_URL}/booking/${bookingId}`,
      { lastname: 'Doe' },
      { headers: { Cookie: `token=${token}` } }
    );

    expect(response.status).toBe(200);
    expect(response.data.lastname).toBe('Doe');
  });

  it('should update the total price', async () => {
    const newPrice = 250;
    const response = await axios.patch(
      `${BASE_URL}/booking/${bookingId}`,
      { totalprice: newPrice },
      { headers: { Cookie: `token=${token}` } }
    );

    expect(response.status).toBe(200);
    expect(response.data.totalprice).toBe(response.data.totalprice);
  });

  it('should update multiple fields at once', async () => {
    const response = await axios.patch(
      `${BASE_URL}/booking/${bookingId}`,
      { firstname: 'Bob', lastname: 'Wilson' },
      { headers: { Cookie: `token=${token}` } }
    );

    expect(response.status).toBe(200);
    expect(response.data.firstname).toBe('Bob');
    expect(response.data.lastname).toBe('Wilson');
  });

  it('should return 403 when no token is provided', async () => {
    try {
      await axios.patch(`${BASE_URL}/booking/${bookingId}`, { firstname: 'Hacker' });
    } catch (error) {
      expect(error.response.status).toBe(403);
    }
  });

  it('should handle a non-existent booking', async () => {
    try {
      await axios.patch(
        `${BASE_URL}/booking/999999`,
        { firstname: 'Ghost' },
        { headers: { Cookie: `token=${token}` } },
      );
    } catch (error) {
      expect(error.response.status).toBe(405);
    }
  });

  it('should update the booking dates', async () => {
    const response = await axios.patch(
      `${BASE_URL}/booking/${bookingId}`,
      {
        bookingdates: {
          checkin: '2024-06-01',
          checkout: '2024-06-10',
        },
      },
      { headers: { Cookie: `token=${token}` } }
    );

    expect(response.status).toBe(200);
    expect(response.data.bookingdates.checkin).toBe('2024-06-01');
  });
});
