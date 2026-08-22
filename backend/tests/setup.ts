import { config as loadEnv } from "dotenv";
import path from "path";

// Loaded via vitest.config.ts `setupFiles` so both unit tests (which never
// touch the DB/Redis, but still import modules that eagerly validate env
// config) and integration tests (which do touch a real test DB) have a
// valid, non-production configuration without requiring a manually
// maintained .env in CI.
loadEnv({ path: path.resolve(__dirname, "../.env.test") });
