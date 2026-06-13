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
    // NASA Power of 10 Rule #1: Simple control flow
    complexity: ['warn', { max: 15 }],
    // NASA Power of 10 Rule #4b: Limit nesting depth
    'max-depth': ['warn', { max: 4 }],
    'max-nested-callbacks': ['warn', { max: 3 }],
    'no-shadow': 'warn',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // NASA Power of 10 Rule #4: Restrict function size
    'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
    // NASA Power of 10 Rule #6: Minimize scope
    'prefer-const': 'error',
    'no-var': 'error',
    // NASA Power of 10 Rule #7: Check return values
    'no-void': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // NASA Power of 10 Rule #10: Zero warnings
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-unused-expressions': 'warn',
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  overrides: [
    // Allow larger component functions
    {
      files: ['*.tsx'],
      rules: {
        'max-lines-per-function': 'off',
      },
    },
    // Relax strict constraints on legacy electron backend services to focus NASA rules on frontend src
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
