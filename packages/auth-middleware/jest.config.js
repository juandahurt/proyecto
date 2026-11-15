/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/index.ts',
    '!src/express-augment.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 75,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'json-summary', 'lcov'],
};
