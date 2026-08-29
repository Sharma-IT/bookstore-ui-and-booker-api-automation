import { anAccount } from '../../src/data/testAccount.js';
import { expect, test } from '../../src/fixtures/test.js';

test.describe('Signing in', () => {
  // Requirement: a registered user signs in and lands on their profile.
  // Case: happy-path
  // Invariant: the profile identifies the signed-in user by name.
  test('admits a registered user @smoke', async ({ loginPage, profilePage, credentials, page }) => {
    await loginPage.goto();
    await loginPage.signIn(credentials);

    await expect(page).toHaveURL(/\/profile$/);
    await expect(profilePage.userName).toHaveText(credentials.userName);
  });

  // Requirement: a wrong password is refused with a message and no session.
  // Case: error
  // Invariant: refusal never leaks whether the account exists.
  test('refuses a registered user with the wrong password', async ({
    loginPage,
    credentials,
    page,
  }) => {
    await loginPage.goto();
    await loginPage.signIn({ userName: credentials.userName, password: 'Wrong0ne!' });

    await expect(loginPage.errorMessage).toHaveText('Invalid username or password!');
    await expect(page).toHaveURL(/\/login$/);
  });

  // Requirement: an unknown account is refused with the same message as a
  // wrong password, so the form does not disclose which accounts exist.
  // Case: error
  // Invariant: the two refusals are indistinguishable to the user.
  test('refuses an unknown account with the same message', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.signIn(anAccount().withPrefix('unknown').build());

    await expect(loginPage.errorMessage).toHaveText('Invalid username or password!');
  });

  // Requirement: submitting without a user name is rejected client side.
  // Case: boundary
  // Invariant: the offending field is marked and no request is made.
  test('marks a missing user name as invalid', async ({ loginPage, credentials, page }) => {
    await loginPage.goto();
    await loginPage.passwordField.fill(credentials.password);
    await loginPage.loginButton.click();

    await expect(loginPage.invalidField('userName')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  // Requirement: submitting without a password is rejected client side.
  // Case: boundary
  // Invariant: the offending field is marked and no request is made.
  test('marks a missing password as invalid', async ({ loginPage, credentials, page }) => {
    await loginPage.goto();
    await loginPage.userNameField.fill(credentials.userName);
    await loginPage.loginButton.click();

    await expect(loginPage.invalidField('password')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  // Requirement: registration is reachable from the sign-in form. Completing
  // it is out of the automated scope, so only the route is asserted.
  // Case: happy-path
  // Invariant: an unregistered visitor is not stranded on the sign-in form.
  test('offers registration to a visitor without an account', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.newUserButton.click();

    await expect(page).toHaveURL(/\/register$/);
  });
});

test.describe('Session', () => {
  // Requirement: the profile holds personal data and is closed to visitors.
  // Case: error
  // Invariant: no collection is rendered to a visitor without a session.
  test('withholds the profile from a visitor without a session', async ({ profilePage }) => {
    await profilePage.goto();

    await expect(profilePage.signedOutNotice).toBeVisible();
    await expect(profilePage.userName).toHaveCount(0);
  });

  // Requirement: signing out ends the session and returns to the sign-in form.
  // Case: happy-path
  // Invariant: the profile is closed again afterwards.
  test('ends the session on sign out @smoke', async ({ profilePage, page, signedIn }) => {
    await profilePage.goto();
    await expect(profilePage.userName).toHaveText(signedIn.userName);

    await profilePage.logOutButton.click();

    await expect(page).toHaveURL(/\/login$/);

    await profilePage.goto();
    await expect(profilePage.signedOutNotice).toBeVisible();
  });

  // Requirement: an expired session is not honoured.
  // Case: boundary
  // Invariant: the application checks the expiry, not merely the presence of
  // a token.
  test('rejects a session whose expiry has passed', async ({
    context,
    environment,
    profilePage,
    seededUser,
  }) => {
    await context.addCookies(
      [
        { name: 'token', value: seededUser.token },
        { name: 'expires', value: new Date(Date.now() - 60_000).toISOString() },
        { name: 'userID', value: seededUser.userId },
        { name: 'userName', value: seededUser.userName },
      ].map((cookie) => ({
        ...cookie,
        domain: new URL(environment.baseUrl).hostname,
        path: '/',
      })),
    );

    await profilePage.goto();

    await expect(profilePage.signedOutNotice).toBeVisible();
  });
});
