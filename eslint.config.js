import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist/', '**/dev-dist/', '**/node_modules/', '**/coverage/']),

  // Base rules for every JS/TS file in the repo.
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      // Unused code is a warning, not an error, so work-in-progress still lints.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `import type` is erased at build time, which keeps @gram-saathi/shared out of runtime code.
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // shared/ is never built or bundled, so it may only contain types. Runtime code there would
  // compile fine and then crash the server build at startup.
  {
    files: ['shared/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ':matches(VariableDeclaration, FunctionDeclaration, ClassDeclaration, TSEnumDeclaration, TSModuleDeclaration, ExpressionStatement)',
          message: 'shared/ is types-only. Put runtime code in client/ or server/.',
        },
        {
          selector:
            ':matches(ExportAllDeclaration, ExportNamedDeclaration)[exportKind="value"][source]',
          message: 'Re-export with `export type` in shared/.',
        },
        {
          selector: 'ImportDeclaration[importKind="value"]',
          message: 'Use `import type` in shared/.',
        },
      ],
    },
  },

  // The server and config files run in Node.
  {
    files: ['server/**/*.ts', '*.{js,mjs,cjs}', 'client/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },

  // React client: rules of hooks (incl. React Compiler checks), fast-refresh-safe exports.
  {
    files: ['client/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },

  // Must stay last: turns off stylistic rules that would fight Prettier.
  prettier,
]);
