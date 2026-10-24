import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the API is reached through this proxy, so VITE_API_URL can stay empty.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
