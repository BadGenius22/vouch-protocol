import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: [
    // Peer dependencies - let consumers provide these
    '@solana/web3.js',
    '@solana/wallet-adapter-base',
    '@solana/wallet-adapter-react',
    // React is a peer dep of wallet-adapter-react
    'react',
    'react-dom',
  ],
  noExternal: [
    // Bundle the workspace package into the output
    '@vouch/web',
  ],
  esbuildOptions(options) {
    options.banner = {
      js: '/**\n * @vouch-protocol/sdk\n * Privacy infrastructure for Solana\n * @license MIT\n */',
    };
  },
});
