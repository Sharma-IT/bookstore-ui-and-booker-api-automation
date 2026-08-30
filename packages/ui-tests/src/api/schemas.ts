import { z } from 'zod';
import type { Book } from '../data/catalogue.js';

/**
 * Responses from the Book Store service are a trust boundary for the suite:
 * they are the oracle the UI assertions are measured against, so a silent
 * change of shape must fail the run rather than produce undefined comparisons.
 *
 * Unknown keys are dropped by zod, which deliberately narrows each response to
 * the fields the tests rely on. `publish_date` is discarded because the
 * application never renders it.
 */

export const bookSchema: z.ZodType<Book> = z.object({
  isbn: z.string().min(1),
  title: z.string(),
  subTitle: z.string(),
  author: z.string(),
  publisher: z.string(),
  pages: z.number().int().nonnegative(),
  description: z.string(),
  website: z.string(),
});

export const bookListSchema = z.object({
  books: z.array(bookSchema),
});

/** The service spells the identifier `userID` on create and `userId` on read. */
export const createdUserSchema = z.object({
  userID: z.uuid(),
  username: z.string(),
});

export const tokenSchema = z.object({
  token: z.string().min(1),
  expires: z.iso.datetime(),
  status: z.literal('Success'),
});

export const userDetailSchema = z.object({
  userId: z.uuid(),
  username: z.string(),
  books: z.array(bookSchema),
});

export type CreatedUser = z.infer<typeof createdUserSchema>;
export type AuthToken = z.infer<typeof tokenSchema>;
export type UserDetail = z.infer<typeof userDetailSchema>;
