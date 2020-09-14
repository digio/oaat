module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2019,
  },

  env: {
    es6: true,
    'jest/globals': true,
  },

  extends: [
    'plugin:prettier/recommended',
    'plugin:unicorn/recommended',
    'plugin:node/recommended-script',
    'plugin:jest/recommended',
  ],
  plugins: ['jest', '@getify/proper-arrows'],
  rules: {
    // Allow some flexibility here
    'unicorn/prevent-abbreviations': 'off',

    // Use camelCase for files (and directories - not enforced)
    'unicorn/filename-case': ['error', { case: 'camelCase' }],

    // Turn off explicit length checks
    'unicorn/explicit-length-check': 'off',

    // Turning off because it leads to many uses of the word 'error' in the same block, which is confusing
    // E.g.
    // } catch(error) {
    //   logger.error(error);
    //   return error(error);
    // }
    'unicorn/catch-error-name': 'off',

    // This rule is no good for test specs. Need to find a way to disable this for test specs
    'unicorn/consistent-function-scoping': 'off',

    // Use function declarations instead of function expressions. See https://www.freecodecamp.org/news/constant-confusion-why-i-still-use-javascript-function-statements-984ece0b72fd/
    // Don't use arrow functions for top-level functions or as exports, as it makes the code harder to read.
    '@getify/proper-arrows/where': ['error', { global: true, export: true, property: false }],
  },
};
