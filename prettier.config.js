export default {
  semi: false,
  singleQuote: true,
  printWidth: 120,
  tabWidth: 2,
  trailingComma: 'all',
  arrowParens: 'always',
  endOfLine: 'lf',
  overrides: [
    {
      files: '*.md',
      options: { proseWrap: 'preserve' },
    },
  ],
}
