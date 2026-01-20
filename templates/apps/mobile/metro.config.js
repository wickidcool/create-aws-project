const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Get the default Expo config
const config = getDefaultConfig(__dirname);

// Get the workspace root (monorepo root)
const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Add support for additional file extensions
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

// Configure how Metro resolves modules
config.resolver.disableHierarchicalLookup = false;

// Add extra node modules to watch (our workspace packages)
config.resolver.extraNodeModules = {
  '{{PACKAGE_SCOPE}}/common-types': path.resolve(workspaceRoot, 'packages/common-types/src'),
  '{{PACKAGE_SCOPE}}/api-client': path.resolve(workspaceRoot, 'packages/api-client/src'),
  // Force React Native to use its own React version
  'react': path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
};

module.exports = config;
