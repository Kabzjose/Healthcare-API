/**
 * Global test setup — runs once before any test file.
 *
 * MUST be the very first thing that happens: load .env.test before any
 * module is imported, so that env.ts (which validates at import time) sees
 * the test values rather than the dev .env.
 */
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });
