import resolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: {
    index: 'src/index.ts',
    'utils/index': 'src/utils/index.ts',
    'hooks/index': 'src/hooks/index.ts',
    'i18n/index': 'src/i18n/index.ts',
    'types/index': 'src/types/index.ts',
  },
  output: [
    {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].esm.js',
      preserveModules: false,
      sourcemap: true,
    },
    {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs.js',
      preserveModules: false,
      sourcemap: true,
    },
  ],
  external: ['react', 'react-dom', 'clsx', 'tailwind-merge'],
  plugins: [
    resolve(),
    typescript({
      tsconfig: './tsconfig.json',
      useTsconfigDeclarationDir: true,
    }),
  ],
};
