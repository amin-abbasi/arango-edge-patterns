import { Database } from 'arangojs';
import { WarehouseQueries } from '../src/queries/warehouse';

const TEST_DB_NAME = 'erp_showcase_test';

let queries: WarehouseQueries;

beforeAll(() => {
    process.env.ARANGO_DB = TEST_DB_NAME;
    queries = new WarehouseQueries();
});

// ── Read operations ──

describe('WarehouseQueries — reads', () => {
    describe('listStorages', () => {
        it('should return all seeded storages', async () => {
            const storages = await queries.listStorages();
            expect(storages.length).toBeGreaterThanOrEqual(1);
            const keys = storages.map((s) => s._key);
            expect(keys).toContain('storage-a');
        });
    });

    describe('getStorage', () => {
        it('should return a storage by key', async () => {
            const storage = await queries.getStorage('storage-a');
            expect(storage).not.toBeNull();
            expect(storage!._key).toBe('storage-a');
            expect(storage!.code).toBe('STG-A');
            expect(storage!.description).toBe('Main Warehouse');
        });

        it('should return null for non-existent key', async () => {
            const storage = await queries.getStorage('nonexistent');
            expect(storage).toBeNull();
        });
    });

    describe('getNode', () => {
        it('should return a node by key', async () => {
            const node = await queries.getNode('zone-a');
            expect(node).not.toBeNull();
            expect(node!._key).toBe('zone-a');
            expect(node!.code).toBe('ZN-A');
            expect(node!.type).toBe('zone');
            expect(node!.zone).toBe('green');
        });

        it('should return null for non-existent key', async () => {
            const node = await queries.getNode('nonexistent');
            expect(node).toBeNull();
        });
    });

    describe('getStorageNodes', () => {
        it('should return direct children of a storage', async () => {
            const nodes = await queries.getStorageNodes('storage-a');
            expect(nodes).toHaveLength(1);
            expect(nodes[0]._key).toBe('zone-a');
        });
    });

    describe('getDirectChildren', () => {
        it('should return children of zone-a', async () => {
            const children = await queries.getDirectChildren('zone-a');
            expect(children).toHaveLength(1);
            expect(children[0]._key).toBe('rack-a1');
        });

        it('should return children of rack-a1', async () => {
            const children = await queries.getDirectChildren('rack-a1');
            expect(children).toHaveLength(1);
            expect(children[0]._key).toBe('shelf-a1-1');
        });

        it('should return empty array for leaf nodes', async () => {
            const children = await queries.getDirectChildren('shelf-a1-1');
            expect(children).toHaveLength(0);
        });
    });

    describe('getSubtree', () => {
        it('should return all descendants of zone-a', async () => {
            const subtree = await queries.getSubtree('zone-a');
            expect(subtree).toHaveLength(2);
            const keys = subtree.map((n) => n._key).sort();
            expect(keys).toEqual(['rack-a1', 'shelf-a1-1']);
        });

        it('should respect maxDepth', async () => {
            const subtree = await queries.getSubtree('zone-a', 1);
            expect(subtree).toHaveLength(1);
            expect(subtree[0]._key).toBe('rack-a1');
        });
    });

    describe('getAncestors', () => {
        it('should return ancestor chain for shelf-a1-1', async () => {
            const ancestors = await queries.getAncestors('shelf-a1-1');
            // 0..100 INBOUND includes self, rack-a1, zone-a, and possibly storage-a
            expect(ancestors.length).toBeGreaterThanOrEqual(3);
            const keys = ancestors.map((a) => a._key);
            expect(keys).toContain('shelf-a1-1');
            expect(keys).toContain('rack-a1');
            expect(keys).toContain('zone-a');
        });
    });

    describe('getParent', () => {
        it('should return the parent of rack-a1', async () => {
            const parent = await queries.getParent('rack-a1');
            expect(parent).not.toBeNull();
            expect(parent!._key).toBe('zone-a');
        });
    });

    describe('getParentStorage', () => {
        it('should find the root storage for shelf-a1-1', async () => {
            const storage = await queries.getParentStorage('shelf-a1-1');
            expect(storage).not.toBeNull();
            expect(storage!._key).toBe('storage-a');
        });
    });

    describe('getNodeCapacity', () => {
        it('should return capacity info for shelf-a1-1', async () => {
            const capacity = await queries.getNodeCapacity('shelf-a1-1');
            expect(capacity).not.toBeNull();
            expect(capacity!.node._key).toBe('shelf-a1-1');
            expect(capacity!.nodeType._key).toBe('shelf');
            expect(capacity!.capacity).toBe(50);
            // We seeded one container with quantity 100
            expect(capacity!.used).toBe(100);
            expect(capacity!.available).toBe(50 - 100); // negative = over capacity
        });

        it('should return null for non-existent node', async () => {
            const capacity = await queries.getNodeCapacity('nonexistent');
            // DOCUMENT returns null for missing docs so the query may error or return null
            expect(capacity?.node).toBeFalsy();
        });
    });

    describe('getNodeWithContainers', () => {
        it('should return containers for shelf-a1-1', async () => {
            const result = await queries.getNodeWithContainers('shelf-a1-1');
            expect(result).not.toBeNull();
            expect(result!.containerCount).toBe(1);
            expect(result!.containers).toHaveLength(1);
            expect(result!.containers[0]._key).toBe('container-1');
            expect(result!.totalQuantity).toBe(100);
        });

        it('should return zero containers for nodes without containers', async () => {
            const result = await queries.getNodeWithContainers('zone-a');
            expect(result).not.toBeNull();
            expect(result!.containerCount).toBe(0);
            expect(result!.containers).toHaveLength(0);
        });
    });

    describe('getSubtreeCapacity', () => {
        it('should return aggregated capacity for zone-a subtree', async () => {
            const capacity = await queries.getSubtreeCapacity('zone-a');
            expect(capacity).not.toBeNull();
            expect(capacity!.nodeCount).toBe(2); // rack-a1 + shelf-a1-1
            expect(capacity!.totalCapacity).toBe(200 + 50); // rack=200, shelf=50
        });
    });

    describe('findEmptyLocations', () => {
        it('should return nodes with no containers', async () => {
            const empty = await queries.findEmptyLocations();
            const keys = empty.map((n) => n._key);
            // zone-a and rack-a1 have no containers, shelf-a1-1 has one
            expect(keys).toContain('zone-a');
            expect(keys).toContain('rack-a1');
            expect(keys).not.toContain('shelf-a1-1');
        });
    });

    describe('searchNodes', () => {
        it('should find nodes by code', async () => {
            const results = await queries.searchNodes('RK');
            expect(results.length).toBeGreaterThanOrEqual(1);
            expect(results.map((r) => r._key)).toContain('rack-a1');
        });

        it('should be case-insensitive', async () => {
            const results = await queries.searchNodes('zn-a');
            expect(results.length).toBeGreaterThanOrEqual(1);
            expect(results.map((r) => r._key)).toContain('zone-a');
        });
    });

    describe('getNodesByZone', () => {
        it('should return all green zone nodes', async () => {
            const nodes = await queries.getNodesByZone('green');
            expect(nodes.length).toBeGreaterThanOrEqual(3);
            const keys = nodes.map((n) => n._key);
            expect(keys).toContain('zone-a');
            expect(keys).toContain('rack-a1');
            expect(keys).toContain('shelf-a1-1');
        });

        it('should return empty for non-existent zone', async () => {
            const nodes = await queries.getNodesByZone('purple');
            expect(nodes).toHaveLength(0);
        });
    });

    describe('getNodesByType', () => {
        it('should return all rack-type nodes', async () => {
            const nodes = await queries.getNodesByType('rack');
            expect(nodes.length).toBeGreaterThanOrEqual(1);
            expect(nodes.every((n) => n.type === 'rack')).toBe(true);
        });
    });
});

// ── Write operations ──

describe('WarehouseQueries — writes', () => {
    describe('createNode', () => {
        afterEach(async () => {
            try {
                await queries.deleteNode('test-node', false);
            } catch {
                // Ignore
            }
        });

        it('should create a node linked to a parent', async () => {
            const node = await queries.createNode('test-node', 'TST-N1', 'Test Node', 'rack', 'green', 'zone-a');
            expect(node._key).toBe('test-node');
            expect(node.code).toBe('TST-N1');

            // Verify parent link
            const parent = await queries.getParent('test-node');
            expect(parent).not.toBeNull();
            expect(parent!._key).toBe('zone-a');
        });
    });

    describe('moveNode', () => {
        beforeEach(async () => {
            await queries.createNode('move-node', 'MV-N', 'Move Test', 'shelf', 'green', 'rack-a1');
        });

        afterEach(async () => {
            try {
                await queries.deleteNode('move-node', false);
            } catch {
                // Ignore
            }
        });

        it('should move a node to a new parent', async () => {
            // Initially under rack-a1
            let parent = await queries.getParent('move-node');
            expect(parent!._key).toBe('rack-a1');

            // Move under zone-a
            await queries.moveNode('move-node', 'zone-a');

            parent = await queries.getParent('move-node');
            expect(parent!._key).toBe('zone-a');
        });
    });

    describe('deleteNode', () => {
        it('should delete a node and reassign children to parent', async () => {
            // Create parent → middle → child chain
            await queries.createNode('del-middle', 'DM', 'Middle', 'rack', 'green', 'zone-a');
            await queries.createNode('del-leaf', 'DL', 'Leaf', 'shelf', 'green', 'del-middle');

            // Delete middle with reassignment
            await queries.deleteNode('del-middle', true);

            // Middle should be gone
            const middle = await queries.getNode('del-middle');
            expect(middle).toBeNull();

            // Leaf should now be under zone-a
            const parent = await queries.getParent('del-leaf');
            expect(parent).not.toBeNull();
            expect(parent!._key).toBe('zone-a');

            // Cleanup
            await queries.deleteNode('del-leaf', false);
        });

        it('should delete a node without reassigning children', async () => {
            await queries.createNode('del-no-reassign', 'DNR', 'No Reassign', 'rack', 'green', 'zone-a');

            await queries.deleteNode('del-no-reassign', false);

            const node = await queries.getNode('del-no-reassign');
            expect(node).toBeNull();
        });
    });
});
