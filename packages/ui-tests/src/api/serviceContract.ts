import { z } from 'zod';

/**
 * What the Book Store service promises, stated exactly.
 *
 * This is deliberately a second, independent description of the same
 * responses that `schemas.ts` already validates, and the duplication is the
 * mechanism rather than an oversight. `schemas.ts` states what the suite
 * *needs*: it narrows each response to the fields the interface renders and
 * lets zod strip the rest, so it tolerates a field being added, renamed or
 * withdrawn as long as the handful it reads survives. A contract test written
 * against that schema could therefore only ever detect the drift the suite
 * already fails on, which is drift the suite does not need a contract test to
 * find.
 *
 * These schemas state what the service *sends*. Every object is strict, so an
 * added or renamed key fails, and every field the service returns is listed,
 * including the ones the application never renders. The measured gap between
 * the two is three fields: `publish_date` on every book, `books` on the
 * registration response, and `result` on the token response.
 */

/** Strict throughout: an unknown key is drift, which is the point of the file. */
const contractObject = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape);

/**
 * The book as the catalogue and the profile both return it. `publish_date` is
 * absent from the interface entirely, which is why `schemas.ts` discards it and
 * why only this file can notice it going away.
 */
export const bookContract = contractObject({
  isbn: z.string().min(1),
  title: z.string(),
  subTitle: z.string(),
  author: z.string(),
  publish_date: z.iso.datetime(),
  publisher: z.string(),
  pages: z.number().int().nonnegative(),
  description: z.string(),
  website: z.string(),
});

export const catalogueContract = contractObject({
  books: z.array(bookContract),
});

/**
 * Registration answers with an empty collection alongside the identifier.
 * The suite reads neither, so nothing else would notice it disappear.
 */
export const registrationContract = contractObject({
  userID: z.uuid(),
  username: z.string(),
  books: z.array(bookContract),
});

/**
 * Authentication reports its outcome in the body at 200, never by status code,
 * so both outcomes share one endpoint and one response code and are told apart
 * only by `status`. A consumer that branches on the HTTP status alone treats a
 * refused password as a successful sign-in. Recorded as D-6.
 */
export const successfulTokenContract = contractObject({
  token: z.string().min(1),
  expires: z.iso.datetime(),
  status: z.literal('Success'),
  result: z.literal('User authorized successfully.'),
});

export const failedTokenContract = contractObject({
  token: z.null(),
  expires: z.null(),
  status: z.literal('Failed'),
  result: z.literal('User authorization failed.'),
});

/** The read side spells the identifier `userId`; registration spells it `userID` (D-5). */
export const userDetailContract = contractObject({
  userId: z.uuid(),
  username: z.string(),
  books: z.array(bookContract),
});

/**
 * Adding to a collection echoes only the identifiers. The key is `books`, as on
 * the catalogue and the profile, but the shape behind it is a different type:
 * one name, two contracts.
 */
export const collectionAdditionContract = contractObject({
  books: z.array(contractObject({ isbn: z.string().min(1) })),
});

/** Every refusal shares one envelope, with the code carried as a string. */
export const errorContract = contractObject({
  code: z.string().regex(/^\d+$/),
  message: z.string().min(1),
});

/** `POST /Account/v1/Authorized` answers with a bare boolean, not an object. */
export const authorisationContract = z.boolean();

export type BookContract = z.infer<typeof bookContract>;
export type ErrorContract = z.infer<typeof errorContract>;
