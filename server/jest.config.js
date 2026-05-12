module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/', '/src/__tests__/setup\\.js$'],
  projects: [
    {
      displayName: 'rate-limit',
      testEnvironment: 'node',
      testTimeout: 30000,
      testMatch: ['<rootDir>/src/__tests__/ratelimit.test.js'],
      setupFiles: ['<rootDir>/src/__tests__/setup/rateLimitEnabled.js'],
    },
    {
      displayName: 'standard',
      testEnvironment: 'node',
      testTimeout: 30000,
      testMatch: ['<rootDir>/src/__tests__/**/*.test.js'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/src/__tests__/setup\\.js$',
        '/src/__tests__/ratelimit\\.test\\.js$',
      ],
      setupFiles: ['<rootDir>/src/__tests__/setup/rateLimitDisabled.js'],
    },
  ],
};
