const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', 'node_modules/**', 'android/**', 'ios/**', 'coverage/**']
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  }
])
