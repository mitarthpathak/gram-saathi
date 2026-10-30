import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist/', '**/node_modules/', '**/coverage/']),

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

  // Root-level config files run in Node.
  {
    files: ['*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },

  // Must stay last: turns off stylistic rules that would fight Prettier.
  prettier,
]);
