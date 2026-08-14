// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
      'artifacts/**',
      'playwright/.auth/**',
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // This flat config file is not part of tsconfig's project, so type-aware
  // rules cannot resolve it. Lint it with the syntax-only rules instead.
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },

  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ---------------------------------------------------------------
      // Spec §13: no page.waitForTimeout(). Hard ban — a fixed sleep hides
      // a real synchronisation bug and is the single biggest source of
      // flake in a suite this size. Use web-first assertions instead.
      // For the ERP project use waitForRoundTrip() (src/utils/waits.ts).
      // ---------------------------------------------------------------
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message:
            'page.waitForTimeout() is banned (spec §13). Use a web-first assertion (expect(locator).toBeVisible()) or, for SAP Webgui, waitForRoundTrip() from @utils/waits.',
        },
        {
          selector: "CallExpression[callee.object.name='page'][callee.property.name='pause']",
          message: 'page.pause() is a debugging aid — remove it before committing.',
        },
      ],

      // Spec §6: assertions must never live in page objects. Enforced by
      // review plus the tests/**-only expect rule below.
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'explicit', overrides: { constructors: 'no-public' } },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },

  // ---------------------------------------------------------------------
  // Spec files: Playwright plugin rules, and the only place expect() is allowed.
  // ---------------------------------------------------------------------
  {
    files: ['tests/**/*.spec.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-conditional-in-test': 'error',
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
      'playwright/expect-expect': 'error',
      'playwright/no-wait-for-timeout': 'error',
      'playwright/valid-title': 'error',
      // Spec §13: no try/catch wrapped around assertions to force a pass.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TryStatement TryStatement',
          message: 'Nested try/catch in a spec almost always hides a failing assertion (spec §13).',
        },
      ],
    },
  },

  // ---------------------------------------------------------------------
  // Page objects and components contain NO assertions (spec §6).
  // ---------------------------------------------------------------------
  {
    files: ['src/pages/**/*.ts', 'src/components/**/*.ts', 'src/flows/**/*.ts'],
    rules: {
      // Page-object methods keep an async signature for API consistency even
      // when the body is currently a synchronous throw — the unimplemented
      // stubs (spec §14: scaffold rather than guess) would otherwise have to
      // change signature when they are implemented, breaking every caller.
      '@typescript-eslint/require-await': 'off',

      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              importNames: ['expect'],
              message:
                'Page objects, components and flows must not assert (spec §6/§7). Assertions belong in specs. Import only types and Locator/Page here.',
            },
          ],
        },
      ],
    },
  },

  // Config, scripts and setup files legitimately log and read process.env.
  {
    files: ['config/**/*.ts', 'scripts/**/*.ts', 'src/utils/logger.ts', '*.ts', '*.js'],
    rules: {
      'no-console': 'off',
    },
  },

  prettier
);
