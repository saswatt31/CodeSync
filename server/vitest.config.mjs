import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Inject all env vars before any module is loaded.
    // NODE_ENV=test ensures express-rate-limit is bypassed (see index.js).
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-secret-for-vitest-12345",
      SUPABASE_URL: "https://mock.supabase.co",
      SUPABASE_SERVICE_KEY: "mock-service-key",
      GEMINI_API_KEY: "mock-gemini-key",
      JUDGE0_API_KEY: "mock-judge0-key",
      JUDGE0_API_URL: "https://judge0-ce.p.rapidapi.com",
      CLIENT_URL: "http://localhost:3000",
    },
    pool: "forks",
  },
});
