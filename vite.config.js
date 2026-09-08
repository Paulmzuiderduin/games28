import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { target: ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14'] },
  server: {
    port: 4178
  }
});
