const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  { ignores: ['dist/*', '.expo/*', 'node_modules/*'] },
  { files: ['jest.setup.ts'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
];
