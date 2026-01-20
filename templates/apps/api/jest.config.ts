export default {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  // Workaround for Node.js 25+ localStorage security error
  workerIdleMemoryLimit: '512MB',
  maxWorkers: 1,
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../coverage/apps/api',
  // Exclude infrastructure code from coverage - tested via integration tests
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/data/DynamoModel.ts',
    '/models/UserModel.ts',
  ],
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Setup files
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};
