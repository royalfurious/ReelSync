import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const typescriptFiles = ['**/*.ts', '**/*.tsx'];
const repoRoot = dirname(fileURLToPath(import.meta.url));
const typescriptProjects = [
  './tsconfig.base.json',
  './apps/backend/tsconfig.json',
  './apps/frontend/tsconfig.json',
  './packages/shared/tsconfig.json',
  './packages/db/tsconfig.json'
].map((projectPath) => resolve(repoRoot, projectPath));

export default [
  {
    ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**', '**/drizzle/**']
  },
  js.configs.recommended,
  prettier,
  {
    files: typescriptFiles,
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        project: typescriptProjects,
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
];