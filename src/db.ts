import { Database } from 'arangojs';
import { CollectionType } from 'arangojs/collection.js';
import { logger } from './utils/logger.js';

const DB_CONFIG = {
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    auth: {
        username: process.env.ARANGO_USER || 'root',
        password: process.env.ARANGO_PASSWORD || 'local',
    },
};

const DB_NAME = process.env.ARANGO_DB || 'erp_showcase';

const db = new Database({
    ...DB_CONFIG,
    databaseName: DB_NAME,
});

export const getDatabase = (): Database => db;

export async function initializeDatabase() {
    try {
        const dbExists = await db.exists();
        if (!dbExists) {
            logger.info('Creating database...');
            const systemDb = new Database({ ...DB_CONFIG, databaseName: '_system' });
            await systemDb.createDatabase(DB_NAME);
        }

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
            const collection = db.collection(col.name);
            const collectionExists = await collection.exists();
            if (!collectionExists) {
                logger.info(`Creating collection: ${col.name}`);
                if (col.type === 'edge') await collection.create({ type: CollectionType.EDGE_COLLECTION });
                else await collection.create();
            }
        }

        await ensureIndexes();

        logger.info('Database initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize database:', error);
        throw error;
    }
}

async function ensureIndexes() {
    const part_cats_links = db.collection('part_cats_links');
    const w_node_links = db.collection('w_node_links');
    const part_cats = db.collection('part_cats');
    const w_nodes = db.collection('w_nodes');

    try {
        // Indexes for traversals
        await part_cats_links.ensureIndex({
            type: 'persistent',
            fields: ['_from'],
        });

        await part_cats_links.ensureIndex({
            type: 'persistent',
            fields: ['_to'],
        });

        await w_node_links.ensureIndex({
            type: 'persistent',
            fields: ['_from'],
        });

        await w_node_links.ensureIndex({
            type: 'persistent',
            fields: ['_to'],
        });

        // Indexes for filtering
        await part_cats.ensureIndex({
            type: 'persistent',
            fields: ['_deleted'],
        });

        await w_nodes.ensureIndex({
            type: 'persistent',
            fields: ['_deleted'],
        });

        logger.info('Indexes created/verified');
    } catch (error) {
        logger.error('Failed to create indexes:', error);
    }
}

export async function seedDatabase() {
    try {
        const part_cats = db.collection('part_cats');
        const part_cats_links = db.collection('part_cats_links');
        const w_storages = db.collection('w_storages');
        const w_nodes = db.collection('w_nodes');
        const w_node_links = db.collection('w_node_links');
        const w_node_types = db.collection('w_node_types');

        // Clear collections
        await part_cats.truncate();
        await part_cats_links.truncate();
        await w_storages.truncate();
        await w_nodes.truncate();
        await w_node_links.truncate();
        await w_node_types.truncate();

        // Seed part categories
        const electronics = await part_cats.save({
            _key: 'electronics',
            name: 'Electronics',
            code: 'ELEC',
            containParts: false,
        });

        const semiconductors = await part_cats.save({
            _key: 'semiconductors',
            name: 'Semiconductors',
            code: 'SEMI',
            containParts: false,
        });

        const passives = await part_cats.save({
            _key: 'passives',
            name: 'Passive Components',
            code: 'PASS',
            containParts: true,
        });

        const ics = await part_cats.save({
            _key: 'ics',
            name: 'Integrated Circuits',
            code: 'ICS',
            containParts: true,
        });

        const transistors = await part_cats.save({
            _key: 'transistors',
            name: 'Transistors',
            code: 'TRANS',
            containParts: true,
        });

        const resistors = await part_cats.save({
            _key: 'resistors',
            name: 'Resistors',
            code: 'RES',
            containParts: true,
        });

        // Create category links
        await part_cats_links.save({
            _from: 'part_cats/electronics',
            _to: 'part_cats/semiconductors',
            order: 1,
        });

        await part_cats_links.save({
            _from: 'part_cats/electronics',
            _to: 'part_cats/passives',
            order: 2,
        });

        await part_cats_links.save({
            _from: 'part_cats/semiconductors',
            _to: 'part_cats/ics',
            order: 1,
        });

        await part_cats_links.save({
            _from: 'part_cats/semiconductors',
            _to: 'part_cats/transistors',
            order: 2,
        });

        await part_cats_links.save({
            _from: 'part_cats/passives',
            _to: 'part_cats/resistors',
            order: 1,
        });

        // Seed warehouse
        const storageA = await w_storages.save({
            _key: 'storage-a',
            code: 'STG-A',
            description: 'Main Warehouse',
            business_unit: 'manufacturing',
        });

        // Node types
        const zoneType = await w_node_types.save({
            _key: 'zone',
            name: 'Zone',
            hasContainer: false,
            zone: 'green',
            capacity: 1000,
        });

        const rackType = await w_node_types.save({
            _key: 'rack',
            name: 'Rack',
            hasContainer: false,
            zone: 'green',
            capacity: 200,
        });

        const shelfType = await w_node_types.save({
            _key: 'shelf',
            name: 'Shelf',
            hasContainer: true,
            zone: 'green',
            capacity: 50,
        });

        // Nodes
        const zoneA = await w_nodes.save({
            _key: 'zone-a',
            code: 'ZN-A',
            description: 'Electronics Zone',
            type: 'zone',
            zone: 'green',
            hasContainer: false,
        });

        const rackA1 = await w_nodes.save({
            _key: 'rack-a1',
            code: 'RK-A1',
            description: 'Rack A1',
            type: 'rack',
            zone: 'green',
            hasContainer: false,
        });

        const shelfA1_1 = await w_nodes.save({
            _key: 'shelf-a1-1',
            code: 'SH-A1-1',
            description: 'Shelf A1-1',
            type: 'shelf',
            zone: 'green',
            hasContainer: true,
        });

        // Node links
        await w_node_links.save({
            _from: 'w_storages/storage-a',
            _to: 'w_nodes/zone-a',
        });

        await w_node_links.save({
            _from: 'w_nodes/zone-a',
            _to: 'w_nodes/rack-a1',
        });

        await w_node_links.save({
            _from: 'w_nodes/rack-a1',
            _to: 'w_nodes/shelf-a1-1',
        });

        logger.info('Database seeded successfully');
    } catch (error) {
        logger.error('Failed to seed database:', error);
        throw error;
    }
}
