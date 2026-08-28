import { describe, expect, it } from 'vitest';
import { Db, createDb } from '../db/index.js';
import { migrate } from '../db/migrate.js';
import { getAppConfig } from './configService.js';

async function setUp(): Promise<Db> {
  const db: Db = await createDb({ driver: 'sqlite', sqliteFile: ':memory:' });
  await migrate(db);
  return db;
}

describe('getAppConfig cadence legacy-field migration', () => {
  it('converts a pre-rename hours-based cadence config to minutes on read', async () => {
    const db = await setUp();
    // Simulates a config saved before reminderHoursBeforeCutOff/escalationHoursBeforeCutOff
    // were renamed to their ...MinutesBeforeCutOff equivalents.
    await db.run(`INSERT INTO app_config (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)`, [
      'cadence',
      JSON.stringify({ reminderHoursBeforeCutOff: [72, 24, 8], escalationHoursBeforeCutOff: 6, automationEnabled: true }),
      new Date().toISOString(),
      'test',
    ]);

    const { cadence } = await getAppConfig(db);
    expect(cadence.reminderMinutesBeforeCutOff).toEqual([4320, 1440, 480]);
    expect(cadence.escalationMinutesBeforeCutOff).toBe(360);
    expect(cadence.automationEnabled).toBe(true);
  });

  it('preserves a null legacy escalation value as null minutes', async () => {
    const db = await setUp();
    await db.run(`INSERT INTO app_config (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)`, [
      'cadence',
      JSON.stringify({ escalationHoursBeforeCutOff: null }),
      new Date().toISOString(),
      'test',
    ]);

    const { cadence } = await getAppConfig(db);
    expect(cadence.escalationMinutesBeforeCutOff).toBeNull();
  });

  it('leaves an already-migrated config untouched', async () => {
    const db = await setUp();
    await db.run(`INSERT INTO app_config (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)`, [
      'cadence',
      JSON.stringify({ reminderMinutesBeforeCutOff: [10, 5], escalationMinutesBeforeCutOff: 2 }),
      new Date().toISOString(),
      'test',
    ]);

    const { cadence } = await getAppConfig(db);
    expect(cadence.reminderMinutesBeforeCutOff).toEqual([10, 5]);
    expect(cadence.escalationMinutesBeforeCutOff).toBe(2);
  });
});
