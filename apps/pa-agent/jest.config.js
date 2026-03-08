/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@pe/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@pe/da-vinci$': '<rootDir>/../../packages/da-vinci/src/index.ts',
    '^@pe/db$': '<rootDir>/../../packages/db/src/index.ts',
  },
  forceExit: true,
};
