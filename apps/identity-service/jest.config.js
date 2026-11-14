/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/service/**/*.ts', 'src/handlers/**/*.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'json-summary', 'lcov'],
};
