module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
    maxWorkers: 1, 
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/database/migrations/**',
  ],
  coverageDirectory: 'coverage',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
  forceExit: true,
  detectOpenHandles: true,
};
