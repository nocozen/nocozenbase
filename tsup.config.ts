import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],  // Entry point(s) for the application
  outDir: 'dist',          // Output directory for built files
  platform: 'node',        // Target platform (node, browser, neutral)
  target: 'node20',   // Ensure compatibility
  format: ['cjs'],    // For esm modules, consider adding package.json: "type": "module",
  dts: false,          // Generate type declaration files
  sourcemap: false,        // Generate source maps
  minify: true,       // Optional: Minify code
  clean: false,            // Clean output directory before building
  bundle: true,       // Bundle all dependencies
  splitting: false,        // Code splitting (experimental)
  shims: true,        // Handle Node.js built-in modules (e.g., `fs`, `path`)

  loader: {
    '.env': 'text', // Bundle .env files as text
    '.pem': 'text', // Bundle SSL certificates as text
    '.html': 'text',
    '.ejs': 'text',
  },

  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'production'}"`,
  },

})