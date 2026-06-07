/** @type {import('eslint').Linter.Config} */
export default {
  root: true,
  env: {
    browser: true,
    es2024: true,
    node: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  overrides: [
    // Frontend extension files (run in browser context)
    {
      files: ['index.js', 'style.css'],
      env: {
        browser: true,
        jquery: true,
      },
      globals: {
        jQuery: 'readonly',
        $: 'readonly',
        SillyTavern: 'readonly',
        extension_settings: 'writable',
        eventSource: 'readonly',
        event_types: 'readonly',
        saveSettingsDebounced: 'readonly',
        renderExtensionTemplateAsync: 'readonly',
      },
    },
    // Plugin backend files
    {
      files: ['plugin/**/*.js'],
      env: {
        node: true,
        browser: false,
      },
      rules: {
        'no-console': 'off', // Allow console in backend for logging
      },
    },
  ],
  rules: {
    // Error prevention
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-dupe-keys': 'error',
    'no-unreachable': 'error',
    'no-throw-literal': 'error',
    'prefer-const': 'warn',
    'no-var': 'warn',

    // Style (light, Prettier handles formatting)
    'semi': ['error', 'always'],
    'quotes': ['warn', 'single', { avoidEscape: true }],
    'comma-dangle': ['warn', 'always-multiline'],
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.min.js',
    'test/data/',
  ],
};
