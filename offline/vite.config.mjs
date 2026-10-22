import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({ root, base: '/', plugins: [react()], css: { postcss: { plugins: [tailwindcss()] } }, publicDir: fileURLToPath(new URL('../public', import.meta.url)), build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' }, server: { host: '127.0.0.1', port: 5174, strictPort: true }, });
