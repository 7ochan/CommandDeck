import { defineConfig, globalIgnores } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier/flat';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  prettierConfig,
  globalIgnores([
    '.next/**',
    '.server/**',
    '.electron/**',
    'coverage/**',
    'node_modules/**',
    'dist/**',
    'next-env.d.ts',
  ]),
]);
