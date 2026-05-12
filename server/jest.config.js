module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/', '/src/__tests__/setup\\.ts$'],
  projects: [
    {
      displayName: 'rate-limit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testTimeout: 30000,
      testMatch: ['<rootDir>/src/__tests__/ratelimit.test.ts'],
      setupFiles: ['<rootDir>/src/__tests__/setup/rateLimitEnabled.ts'],
    },
    {
      displayName: 'standard',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testTimeout: 30000,
      testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/src/__tests__/setup\\.ts$',
        '/src/__tests__/ratelimit\\.test\\.ts$',
      ],
      setupFiles: ['<rootDir>/src/__tests__/setup/rateLimitDisabled.ts'],
    },
  ],
};
