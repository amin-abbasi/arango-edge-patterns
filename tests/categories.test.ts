import { Database } from 'arangojs';
import { CategoryQueries } from '../src/queries/categories';

const TEST_DB_NAME = 'erp_showcase_test';

// Create a CategoryQueries instance pointing at the test DB
let queries: CategoryQueries;

beforeAll(() => {
    process.env.ARANGO_DB = TEST_DB_NAME;
    queries = new CategoryQueries();
});

// ── Read operations (run against seeded data) ──

describe('CategoryQueries — reads', () => {
    describe('listCategories', () => {
        it('should return all 6 seeded categories', async () => {
            const categories = await queries.listCategories();
            expect(categories).toHaveLength(6);
            const keys = categories.map((c) => c._key).sort();
            expect(keys).toEqual(['electronics', 'ics', 'passives', 'resistors', 'semiconductors', 'transistors']);
        });

        it('should filter out soft-deleted categories by default', async () => {
            const categories = await queries.listCategories(false);
            for (const cat of categories) {
                expect(cat._deleted).toBeUndefined();
            }
        });
    });

    describe('getCategory', () => {
        it('should return a category by key', async () => {
            const cat = await queries.getCategory('electronics');
            expect(cat).not.toBeNull();
            expect(cat!._key).toBe('electronics');
            expect(cat!.name).toBe('Electronics');
            expect(cat!.code).toBe('ELEC');
            expect(cat!.containParts).toBe(false);
        });

        it('should return null for a non-existent key', async () => {
            const cat = await queries.getCategory('nonexistent');
            expect(cat).toBeNull();
        });
    });

    describe('getRootCategories', () => {
        it('should return only categories with no parent edges', async () => {
            const roots = await queries.getRootCategories();
            expect(roots.length).toBeGreaterThanOrEqual(1);
            const keys = roots.map((r) => r._key);
            expect(keys).toContain('electronics');
            // These all have parent edges so should NOT be roots
            expect(keys).not.toContain('semiconductors');
            expect(keys).not.toContain('resistors');
        });
    });

    describe('getDirectChildren', () => {
        it('should return immediate children of electronics', async () => {
            const children = await queries.getDirectChildren('electronics');
            expect(children).toHaveLength(2);
            const keys = children.map((c) => c._key).sort();
            expect(keys).toEqual(['passives', 'semiconductors']);
        });

        it('should return immediate children of semiconductors', async () => {
            const children = await queries.getDirectChildren('semiconductors');
            expect(children).toHaveLength(2);
            const keys = children.map((c) => c._key).sort();
            expect(keys).toEqual(['ics', 'transistors']);
        });

        it('should return empty array for leaf nodes', async () => {
            const children = await queries.getDirectChildren('resistors');
            expect(children).toHaveLength(0);
        });
    });

    describe('getDescendants', () => {
        it('should return all descendants of electronics', async () => {
            const descendants = await queries.getDescendants('electronics');
            expect(descendants).toHaveLength(5);
            const keys = descendants.map((d) => d._key).sort();
            expect(keys).toEqual(['ics', 'passives', 'resistors', 'semiconductors', 'transistors']);
        });

        it('should include correct depth values', async () => {
            const descendants = await queries.getDescendants('electronics');
            const byKey = Object.fromEntries(descendants.map((d) => [d._key, d]));
            expect(byKey['semiconductors'].depth).toBe(1);
            expect(byKey['ics'].depth).toBe(2);
            expect(byKey['resistors'].depth).toBe(2);
        });

        it('should respect maxDepth parameter', async () => {
            const descendants = await queries.getDescendants('electronics', 1);
            expect(descendants).toHaveLength(2);
            const keys = descendants.map((d) => d._key).sort();
            expect(keys).toEqual(['passives', 'semiconductors']);
        });

        it('should return empty array for leaf nodes', async () => {
            const descendants = await queries.getDescendants('resistors');
            expect(descendants).toHaveLength(0);
        });
    });

    describe('getAncestors', () => {
        it('should return ancestor chain for resistors', async () => {
            const ancestors = await queries.getAncestors('resistors');
            // 0..100 INBOUND includes self, then passives, then electronics
            expect(ancestors.length).toBeGreaterThanOrEqual(3);
            const keys = ancestors.map((a) => a._key);
            expect(keys).toContain('resistors');
            expect(keys).toContain('passives');
            expect(keys).toContain('electronics');
        });

        it('should return only self for root categories', async () => {
            const ancestors = await queries.getAncestors('electronics');
            // Only self since electronics has no parent
            expect(ancestors).toHaveLength(1);
            expect(ancestors[0]._key).toBe('electronics');
        });
    });

    describe('getParent', () => {
        it('should return the parent of semiconductors', async () => {
            const parent = await queries.getParent('semiconductors');
            expect(parent).not.toBeNull();
            expect(parent!._key).toBe('electronics');
        });

        it('should return null for root categories', async () => {
            const parent = await queries.getParent('electronics');
            expect(parent).toBeNull();
        });
    });

    describe('getSiblings', () => {
        it('should return siblings of semiconductors', async () => {
            const siblings = await queries.getSiblings('semiconductors');
            const keys = siblings.map((s) => s._key);
            // Siblings = children of electronics = semiconductors + passives
            expect(keys).toContain('semiconductors');
            expect(keys).toContain('passives');
        });
    });

    describe('searchCategories', () => {
        it('should find categories by name', async () => {
            const results = await queries.searchCategories('transistor');
            expect(results).toHaveLength(1);
            expect(results[0]._key).toBe('transistors');
        });

        it('should find categories by code', async () => {
            const results = await queries.searchCategories('ELEC');
            expect(results.length).toBeGreaterThanOrEqual(1);
            expect(results.map((r) => r._key)).toContain('electronics');
        });

        it('should be case-insensitive', async () => {
            const results = await queries.searchCategories('RESISTOR');
            expect(results).toHaveLength(1);
            expect(results[0]._key).toBe('resistors');
        });

        it('should return empty for no matches', async () => {
            const results = await queries.searchCategories('zzz_no_match');
            expect(results).toHaveLength(0);
        });
    });

    describe('getCategoryStats', () => {
        it('should return stats for all categories', async () => {
            const stats = await queries.getCategoryStats();
            expect(stats).toHaveLength(6);

            const byKey = Object.fromEntries(stats.map((s) => [s.category, s]));

            // electronics: 2 children, 0 parents → root, not leaf
            expect(byKey['electronics'].childCount).toBe(2);
            expect(byKey['electronics'].parentCount).toBe(0);
            expect(byKey['electronics'].isRoot).toBe(true);
            expect(byKey['electronics'].isLeaf).toBe(false);

            // resistors: 0 children, 1 parent → not root, leaf
            expect(byKey['resistors'].childCount).toBe(0);
            expect(byKey['resistors'].parentCount).toBe(1);
            expect(byKey['resistors'].isRoot).toBe(false);
            expect(byKey['resistors'].isLeaf).toBe(true);
        });
    });
});

// ── Write operations (each test cleans up after itself) ──

describe('CategoryQueries — writes', () => {
    describe('createCategory', () => {
        afterEach(async () => {
            // Clean up created test categories
            try {
                await queries.cascadeDelete('test-cat');
            } catch {
                // Ignore if doesn't exist
            }
        });

        it('should create a category without a parent', async () => {
            const cat = await queries.createCategory('test-cat', 'Test Category', 'TEST');
            expect(cat._key).toBe('test-cat');
            expect(cat.name).toBe('Test Category');
            expect(cat.code).toBe('TEST');
            expect(cat.containParts).toBe(false);

            // Verify it's persisted
            const fetched = await queries.getCategory('test-cat');
            expect(fetched).not.toBeNull();
            expect(fetched!.name).toBe('Test Category');
        });

        it('should create a category with a parent link', async () => {
            const cat = await queries.createCategory('test-cat', 'Test Child', 'TCHLD', 'electronics', true);
            expect(cat._key).toBe('test-cat');
            expect(cat.containParts).toBe(true);

            // Verify the parent link exists
            const parent = await queries.getParent('test-cat');
            expect(parent).not.toBeNull();
            expect(parent!._key).toBe('electronics');
        });
    });

    describe('softDelete', () => {
        beforeEach(async () => {
            await queries.createCategory('soft-del-test', 'Soft Delete Test', 'SDT');
        });

        afterEach(async () => {
            try {
                await queries.cascadeDelete('soft-del-test');
            } catch {
                // Ignore
            }
        });

        it('should mark a category as deleted with a timestamp', async () => {
            const result = await queries.softDelete('soft-del-test');
            expect(result).toBe(true);

            // Category should still exist but have _deleted set
            const cat = await queries.getCategory('soft-del-test');
            expect(cat).not.toBeNull();
            expect(cat!._deleted).toBeDefined();
        });
    });

    describe('moveCategory', () => {
        beforeEach(async () => {
            await queries.createCategory('move-test', 'Move Test', 'MVT', 'electronics');
        });

        afterEach(async () => {
            try {
                await queries.cascadeDelete('move-test');
            } catch {
                // Ignore
            }
        });

        it('should move a category to a new parent', async () => {
            // Initially under electronics
            let parent = await queries.getParent('move-test');
            expect(parent!._key).toBe('electronics');

            // Move under passives
            await queries.moveCategory('move-test', 'passives');

            parent = await queries.getParent('move-test');
            expect(parent!._key).toBe('passives');
        });
    });

    describe('cascadeDelete', () => {
        beforeEach(async () => {
            // Create a small subtree to delete
            await queries.createCategory('del-parent', 'Del Parent', 'DELP');
            await queries.createCategory('del-child1', 'Del Child 1', 'DC1', 'del-parent');
            await queries.createCategory('del-child2', 'Del Child 2', 'DC2', 'del-parent');
        });

        it('should delete the category and all its descendants', async () => {
            const result = await queries.cascadeDelete('del-parent');
            expect(result.deletedCount).toBe(3);
            expect(result.deletedEdgeCount).toBeGreaterThanOrEqual(2);

            // Verify deletion
            expect(await queries.getCategory('del-parent')).toBeNull();
            expect(await queries.getCategory('del-child1')).toBeNull();
            expect(await queries.getCategory('del-child2')).toBeNull();
        });
    });
});
