import config from '@vainjs/eslint-config/react'

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    rules: {
      'react/react-in-jsx-scope': 'off',
    },
  },
]
