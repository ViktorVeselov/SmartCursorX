module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'native/index.d.ts'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    complexity: ['warn', { max: 15 }],
    'max-depth': ['warn', { max: 4 }],
    'max-nested-callbacks': ['warn', { max: 3 }],
    'no-shadow': 'warn',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
    'prefer-const': 'error',
    'no-var': 'error',
    'no-void': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-unused-expressions': 'warn',
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  overrides: [
    {
      files: ['*.tsx'],
      rules: {
        'max-lines-per-function': 'off',
      },
    },
    {
      files: ['electron/**/*.ts'],
      rules: {
        'max-lines-per-function': 'off',
        'complexity': 'off',
        'max-depth': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        'no-shadow': 'off',
      },
    },
  ],
}
