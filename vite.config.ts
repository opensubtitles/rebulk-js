import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'RebulkJS',
      fileName: 'rebulk-js',
      formats: ['es', 'cjs'],
    },
    target: 'es2022',
    sourcemap: true,
    minify: false,
  },
  plugins: [
    dts({ rollupTypes: true }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
