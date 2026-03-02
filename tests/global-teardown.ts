/**
 * Global Jest teardown — runs once after all test suites.
 * Drops the test database to clean up.
 */
import { Database } from 'arangojs';

const DB_CONFIG = {
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    auth: {
        username: process.env.ARANGO_USER || 'root',
        password: process.env.ARANGO_PASSWORD || 'local',
    },
};

const TEST_DB_NAME = 'erp_showcase_test';

export default async function globalTeardown() {
    const systemDb = new Database({ ...DB_CONFIG, databaseName: '_system' });

    const databases = await systemDb.listDatabases();
    if (databases.includes(TEST_DB_NAME)) {
        await systemDb.dropDatabase(TEST_DB_NAME);
    }
}
