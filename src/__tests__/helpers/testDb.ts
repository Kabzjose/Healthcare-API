/**
 * Test database utilities.
 *
 * Provides a single `clearTestData()` function that wipes all tables in
 * FK-safe order. Call this in `afterEach` blocks to guarantee each test
 * starts with a clean slate.
 */
import { db } from '../../database/db';

/**
 * Deletes all rows from every table, respecting foreign-key constraints.
 * Order: payments → appointments → availability_slots → doctor_profiles → users
 */
export const clearTestData = async (): Promise<void> => {
  await db.query('DELETE FROM payments');
  await db.query('DELETE FROM appointments');
  await db.query('DELETE FROM availability_slots');
  await db.query('DELETE FROM doctor_profiles');
  await db.query('DELETE FROM users');
};
