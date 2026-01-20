export default {
  displayName: 'api-client',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/api-client',
  moduleNameMapper: {
    '^{{PACKAGE_SCOPE}}/common-types$': '<rootDir>/../../packages/common-types/src/index.ts',
  },
};
