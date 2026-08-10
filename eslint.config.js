import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'build/**',
      'release/**',
      'coverage/**',
      'node_modules/**',
      '.corepack/**',
      '**/*.min.js',
      // mobile/ is an intentionally separate npm project (excluded from the
      // pnpm workspace) with its own eslint.config.js and dependencies —
      // without this, ESLint's nested-config discovery picks up
      // mobile/eslint.config.js while running the root's `eslint .`, which
      // fails because mobile's deps (eslint-config-expo) live only in
      // mobile/node_modules, not the root's.
      'mobile/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  {
    files: ['electron/**/*.ts', 'scripts/**/*.js', '*.cjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 }
    }
  },
  prettier
)
