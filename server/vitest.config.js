import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-that-is-long-enough-for-tests',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      UPLOAD_DIR: './uploads-test',
    },
  },
});
