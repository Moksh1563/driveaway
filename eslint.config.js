import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Unused function arguments are fine (Express handlers, callbacks); unused variables are not.
// `rounded` in Button.jsx style destructuring (pulled out so it is not passed on to the DOM) is allowed.
const unusedVars = ['error', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }]

// node:test functions, for test files that use them without importing
const nodeTestGlobals = {
  describe: 'readonly', it: 'readonly', test: 'readonly',
  before: 'readonly', after: 'readonly', beforeEach: 'readonly', afterEach: 'readonly',
}

export default [
  { ignores: ['dist', 'node_modules', 'server/node_modules', 'server/uploads', '.claude', '.claude-flow', '.swarm'] },

  // Website (React in the browser)
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': unusedVars,
      // The JSX transform is automatic and there are no PropTypes in this project
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Apostrophes and quotes in JSX text render fine
      'react/no-unescaped-entities': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // API (Node, CommonJS)
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': unusedVars,
    },
  },
  {
    files: ['server/tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...nodeTestGlobals },
    },
  },

  // Build tool config files at the repo root (ES modules run by Node)
  {
    files: ['*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': unusedVars,
    },
  },
]
