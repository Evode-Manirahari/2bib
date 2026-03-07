/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@pe/db$': '<rootDir>/../../packages/db/src/index.ts',
    '^@pe/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@pe/fhir-utils$': '<rootDir>/../../packages/fhir-utils/src/index.ts',
    '^@pe/payer-profiles$': '<rootDir>/../../packages/payer-profiles/src/index.ts',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts'],
  forceExit: true,
};
