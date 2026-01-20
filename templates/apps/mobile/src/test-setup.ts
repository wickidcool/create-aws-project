import '@testing-library/jest-native/extend-expect';

// Mock expo-status-bar
jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));

// Silence console warnings in tests
// eslint-disable-next-line @typescript-eslint/no-empty-function
jest.spyOn(console, 'warn').mockImplementation(() => { });
