import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactCompilerPlugin from 'eslint-plugin-react-compiler';

const reactHooksRecommendedLatestRules =
  reactHooksPlugin.configs['recommended-latest'].rules;

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-compiler': reactCompilerPlugin,
    },
    rules: {
      ...reactHooksRecommendedLatestRules,
      'react-compiler/react-compiler': 'error',
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.config.*',
      // Local agent tooling and worktrees (untracked checkouts of the repo).
      '.claude/**',
      // Generated API reference (TypeDoc output and wrapper entries).
      'apps/docs/public/reference/**',
      'apps/docs/.typedoc/**',
      // Docs build intermediates: SSR bundle for prerender, generated API data.
      'apps/docs/.ssr/**',
      'apps/docs/src/generated/**',
      'apps/docs/test-results/**',
      'apps/docs/playwright-report/**',
    ],
  },
);
