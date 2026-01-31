export default {
  displayName: 'mobile',
  preset: 'jest-expo',
  testRunner: 'jest-jasmine2',
  resolver: '@nx/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    '\\.svg$': '@nx/expo/plugins/jest/svg-mock',
  },
  transform: {
    '^.+\\.(js|ts|tsx)$': [
      'babel-jest',
      {
        configFile: './apps/mobile/babel.config.js',
      },
    ],
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$':
      'jest-expo/src/preset/assetFileTransformer.js',
  },
  coverageDirectory: '../../coverage/apps/mobile',
  coverageReporters: ['html', 'text', 'json', 'json-summary'],
};
