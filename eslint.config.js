import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: [
      'node_modules/**',
      'playwright-report/**',
      'blob-report/**',
      'reports/**',
      'test-results/**',
      '.stryker-tmp/**',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // This project prefers `type` for data shapes and reserves `interface`
      // for behaviour contracts, which is the opposite of what the stylistic
      // preset assumes. The convention is deliberate, so the rule is off
      // rather than worked around file by file.
      '@typescript-eslint/consistent-type-definitions': 'off',
      // Interpolating a number is intentional throughout: element indexes,
      // timeouts and page counts all read better inline than wrapped.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // The suite is the last line of defence, so it may not opt out of the
      // type system it relies on to catch a stale locator or payload.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: false, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    files: ['tests/**/*.spec.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // A fixed wait is a defect in the making: every wait must be tied to an
      // observable condition.
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-networkidle': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': ['warn', { allowConditional: true }],
      'playwright/expect-expect': 'error',
      'playwright/no-conditional-in-test': 'error',
      'playwright/require-top-level-describe': 'off',
    },
  },
  prettier,
]);
