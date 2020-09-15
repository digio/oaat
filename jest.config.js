module.exports = {
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.js'],
  testEnvironment: 'node',
  automock: false,
  modulePathIgnorePatterns: ['fixtures'],

  reporters: ['default'],

  collectCoverageFrom: ['src/**/*.js', '!src/cli.js'],
  coverageReporters: ['lcov', 'json-summary', 'html', 'text', 'text-summary'],
  coverageDirectory: '<rootDir>/test-reports/coverage',
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 50,
      functions: 50,
      lines: 50,
    },
  },
  testTimeout: 20000,
  setupFiles: ['<rootDir>/config/testSetup.js'],
};
