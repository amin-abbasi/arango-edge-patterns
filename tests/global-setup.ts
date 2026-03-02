/**
 * Global Jest setup — runs once before all test suites.
 * Creates a dedicated test database and seeds it.
 */
import { Database } from 'arangojs';
import { CollectionType } from 'arangojs/collection.js';

const DB_CONFIG = {
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    auth: {
        username: process.env.ARANGO_USER || 'root',
        password: process.env.ARANGO_PASSWORD || 'local',
    },
};

const TEST_DB_NAME = 'erp_showcase_test';

export default async function globalSetup() {
    // Set the env var so the app code connects to the test DB
    process.env.ARANGO_DB = TEST_DB_NAME;

    const systemDb = new Database({ ...DB_CONFIG, databaseName: '_system' });

    // Drop test DB if it exists from a previous failed run
    const databases = await systemDb.listDatabases();
    if (databases.includes(TEST_DB_NAME)) {
        await systemDb.dropDatabase(TEST_DB_NAME);
    }

    // Create fresh test database
    await systemDb.createDatabase(TEST_DB_NAME);

    const testDb = new Database({ ...DB_CONFIG, databaseName: TEST_DB_NAME });

    // Create collections
    const collections: Array<{ name: string; type: 'document' | 'edge' }> = [
        { name: 'part_cats', type: 'document' },
        { name: 'part_cats_links', type: 'edge' },
        { name: 'w_storages', type: 'document' },
        { name: 'w_nodes', type: 'document' },
        { name: 'w_node_links', type: 'edge' },
        { name: 'w_node_types', type: 'document' },
        { name: 'w_containers', type: 'document' },
    ];

    for (const col of collections) {
        const collection = testDb.collection(col.name);
        if (col.type === 'edge') {
            await collection.create({ type: CollectionType.EDGE_COLLECTION });
        } else {
            await collection.create();
        }
    }

    // Seed test data
    const part_cats = testDb.collection('part_cats');
    const part_cats_links = testDb.collection('part_cats_links');
    const w_storages = testDb.collection('w_storages');
    const w_nodes = testDb.collection('w_nodes');
    const w_node_links = testDb.collection('w_node_links');
    const w_node_types = testDb.collection('w_node_types');
    const w_containers = testDb.collection('w_containers');

    // ── Category hierarchy ──
    // electronics
    //   ├── semiconductors
    //   │     ├── ics
    //   │     └── transistors
    //   └── passives
    //         └── resistors

    await part_cats.save({ _key: 'electronics', name: 'Electronics', code: 'ELEC', containParts: false });
    await part_cats.save({ _key: 'semiconductors', name: 'Semiconductors', code: 'SEMI', containParts: false });
    await part_cats.save({ _key: 'passives', name: 'Passive Components', code: 'PASS', containParts: true });
    await part_cats.save({ _key: 'ics', name: 'Integrated Circuits', code: 'ICS', containParts: true });
    await part_cats.save({ _key: 'transistors', name: 'Transistors', code: 'TRANS', containParts: true });
    await part_cats.save({ _key: 'resistors', name: 'Resistors', code: 'RES', containParts: true });

    await part_cats_links.save({ _from: 'part_cats/electronics', _to: 'part_cats/semiconductors', order: 1 });
    await part_cats_links.save({ _from: 'part_cats/electronics', _to: 'part_cats/passives', order: 2 });
    await part_cats_links.save({ _from: 'part_cats/semiconductors', _to: 'part_cats/ics', order: 1 });
    await part_cats_links.save({ _from: 'part_cats/semiconductors', _to: 'part_cats/transistors', order: 2 });
    await part_cats_links.save({ _from: 'part_cats/passives', _to: 'part_cats/resistors', order: 1 });

    // ── Warehouse hierarchy ──
    // storage-a
    //   └── zone-a
    //         └── rack-a1
    //               └── shelf-a1-1

    await w_storages.save({ _key: 'storage-a', code: 'STG-A', description: 'Main Warehouse', business_unit: 'manufacturing' });

    await w_node_types.save({ _key: 'zone', name: 'Zone', hasContainer: false, zone: 'green', capacity: 1000 });
    await w_node_types.save({ _key: 'rack', name: 'Rack', hasContainer: false, zone: 'green', capacity: 200 });
    await w_node_types.save({ _key: 'shelf', name: 'Shelf', hasContainer: true, zone: 'green', capacity: 50 });

    await w_nodes.save({ _key: 'zone-a', code: 'ZN-A', description: 'Electronics Zone', type: 'zone', zone: 'green', hasContainer: false });
    await w_nodes.save({ _key: 'rack-a1', code: 'RK-A1', description: 'Rack A1', type: 'rack', zone: 'green', hasContainer: false });
    await w_nodes.save({ _key: 'shelf-a1-1', code: 'SH-A1-1', description: 'Shelf A1-1', type: 'shelf', zone: 'green', hasContainer: true });

    await w_node_links.save({ _from: 'w_storages/storage-a', _to: 'w_nodes/zone-a' });
    await w_node_links.save({ _from: 'w_nodes/zone-a', _to: 'w_nodes/rack-a1' });
    await w_node_links.save({ _from: 'w_nodes/rack-a1', _to: 'w_nodes/shelf-a1-1' });

    // Add a container on shelf-a1-1 for capacity tests
    await w_containers.save({ _key: 'container-1', node: 'shelf-a1-1', id: 'BC-001', part_id: 'resistor-10k', quantity: 100 });
}
