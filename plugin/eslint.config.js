import js from '@eslint/js';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  // 忽略文件
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.min.js',
      'test/data/**',
      'release/**',
      'scripts/**',
    ],
  },

  // 前端扩展文件（浏览器环境）
  {
    files: ['index.js', 'ui/*.js'],
    languageOptions: {
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
  },

  // 基础规则（所有文件）
  {
    files: ['**/*.js', 'server.js', 'engine/*.js', 'utils/*.js', 'storage/*.js', 'test/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
      },
    },
    plugins: {
      js,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-throw-literal': 'error',
      'prefer-const': 'warn',
      'no-var': 'warn',
      semi: ['error', 'always'],
      quotes: ['warn', 'single', { avoidEscape: true }],
      'comma-dangle': ['warn', 'always-multiline'],
    },
  },
];
