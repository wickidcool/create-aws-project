module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '{{PACKAGE_SCOPE}}/common-types': '../../packages/common-types/src',
            '{{PACKAGE_SCOPE}}/api-client': '../../packages/api-client/src',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
    ],
  };
};
