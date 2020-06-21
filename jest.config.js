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
      statements: 58,
      branches: 57,
      functions: 53,
      lines: 59,
    },
  },
  testTimeout: 10000,
  setupFiles: ['<rootDir>/config/testSetup.js'],
};
