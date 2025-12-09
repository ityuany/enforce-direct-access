import { defineConfig } from '@shined/lecp';

export default defineConfig({
  format: [
    {
      entry: 'src/index.ts',
      mode: 'bundless',
      type: 'cjs',
      outDir: 'cjs',
    },
  ],
  dts: {
    mode: 'bundless',
    builder: 'swc',
  },
  clean: true,
  sourcemap: true,
});
