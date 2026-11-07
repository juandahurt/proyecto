/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
    './src/handlers/': {
      branches: 75,
    },
    './src/service/': {
      lines: 80,
      branches: 75,
    },
  },
};
