export default {
  displayName: 'web',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/web',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    '^\\.\\./config/api$': '<rootDir>/src/__mocks__/config/api.ts',
    '^\\.\\./\\.\\./config/api$': '<rootDir>/src/__mocks__/config/api.ts',
    '^\\.\\./src/config/api$': '<rootDir>/src/__mocks__/config/api.ts',
    '^./config/api$': '<rootDir>/src/__mocks__/config/api.ts',
    '^\\.\\./config/auth0-config$': '<rootDir>/src/__mocks__/config/auth0-config.ts',
    '^{{PACKAGE_SCOPE}}/common-types$': '<rootDir>/../../packages/common-types/src/index.ts',
    '^{{PACKAGE_SCOPE}}/api-client$': '<rootDir>/../../packages/api-client/src/index.ts',
  },
};
