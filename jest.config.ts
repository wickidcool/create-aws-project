export default {
  displayName: 'create-aws-starter-kit',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        useESM: true,
        diagnostics: {
          ignoreCodes: [151002], // Suppress hybrid module kind warning
        },
      },
    ],
  },
  moduleNameMapper: {
    // Handle ESM imports with .js extension
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: './coverage',
  // Exclude template files from tests - they contain unprocessed tokens
  // Exclude dist - compiled output should not be tested directly
  testPathIgnorePatterns: [
    '/node_modules/',
    '/templates/',
    '/dist/',
  ],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
