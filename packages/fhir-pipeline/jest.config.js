/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: {
    '^@pe/fhir-utils$': '<rootDir>/../../packages/fhir-utils/src/index.ts',
    '^@pe/types$': '<rootDir>/../../packages/types/src/index.ts',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts'],
  forceExit: true,
};
