import { aql } from 'arangojs/aql.js';
import { CategoryDescendant, CategoryTree, CategoryStatistics, PartCategory, AncestorPath } from '../models/types.js';
import { getDatabase } from '../db.js';

export class CategoryQueries {
    private db = getDatabase();

    /**
     * Get a single category by key
     */
    async getCategory(categoryKey: string): Promise<PartCategory | null> {
        const result = await this.db.query(aql`
            RETURN DOCUMENT(${`part_cats/${categoryKey}`})
        `);
        const docs = await result.all();
        return docs[0] || null;
    }

    /**
     * Get all categories (optionally filtered by deleted status)
     */
    async listCategories(includeDeleted = false): Promise<PartCategory[]> {
        const query = includeDeleted ? aql`FOR cat IN part_cats RETURN cat` : aql`FOR cat IN part_cats FILTER cat._deleted == null RETURN cat`;
        const result = await this.db.query(query);
        return result.all();
    }

    /**
     * Get all root categories (categories with no parents)
     */
    async getRootCategories(): Promise<PartCategory[]> {
        const result = await this.db.query(aql`
            FOR cat IN part_cats
                FILTER cat._deleted == null
                FILTER !EXISTS(
                    FIRST(
                        FOR edge IN part_cats_links
                            FILTER edge._to == cat._id
                            RETURN 1
                    )
                )
            )
            RETURN cat
        `);
        return result.all();
    }

    /**
     * Get direct children of a category
     */
    async getDirectChildren(parentKey: string): Promise<PartCategory[]> {
        const result = await this.db.query(aql`
            FOR child, edge IN 1..1 OUTBOUND ${`part_cats/${parentKey}`} part_cats_links
                FILTER child._deleted == null
            RETURN {
                _key: child._key,
                _id: child._id,
                _rev: child._rev,
                name: child.name,
                code: child.code,
                containParts: child.containParts,
                _created: child._created,
                _updated: child._updated,
                _deleted: child._deleted
            }
        `);
        return result.all();
    }

    /**
     * Get all descendants at any depth
     */
    async getDescendants(parentKey: string, maxDepth = 100): Promise<CategoryDescendant[]> {
        const result = await this.db.query(aql`
            FOR doc, edge, path IN 1..${maxDepth} OUTBOUND ${'part_cats/' + parentKey} part_cats_links
                FILTER doc._deleted == null
                RETURN {
                    _key: doc._key,
                    name: doc.name,
                    depth: LENGTH(path.vertices) - 1,
                    path: path.vertices[*]._key
                }
        `);
        return result.all();
    }

    /**
     * Get all ancestors (parents and grandparents)
     */
    async getAncestors(childKey: string): Promise<AncestorPath[]> {
        const result = await this.db.query(aql`
            FOR ancestor, edge, path IN 0..100 INBOUND ${'part_cats/' + childKey} part_cats_links
                RETURN {
                    level: LENGTH(path.vertices),
                    _key: ancestor._key,
                    name: ancestor.name,
                    code: ancestor.code
                }
        `);
        return result.all();
    }

    /**
     * Get the immediate parent of a category
     */
    async getParent(childKey: string): Promise<PartCategory | null> {
        const result = await this.db.query(aql`
            FOR parent IN 1..1 INBOUND ${'part_cats/' + childKey} part_cats_links
                RETURN parent
        `);
        const docs = await result.all();
        return docs[0] || null;
    }

    /**
     * Get sibling categories (same parent)
     */
    async getSiblings(childKey: string): Promise<PartCategory[]> {
        const result = await this.db.query(aql`
            LET parentEdges = (
                FOR edge IN part_cats_links
                    FILTER edge._to == ${'part_cats/' + childKey}
                    RETURN edge._from
            )
            LET parentId = FIRST(parentEdges)
            FOR sibling, edge IN 1..1 OUTBOUND parentId part_cats_links
                FILTER sibling._deleted == null
                RETURN sibling
        `);
        return result.all();
    }

    /**
     * Build full category tree recursively.
     * TODO: Replace stub implementation with real AQL traversal that
     * fetches actual child data instead of returning placeholder names.
     */
    async getCategoryTree(parentKey?: string, maxDepth = 5): Promise<CategoryTree> {
        const buildTree = (catKey: string, level: number): CategoryTree | null => {
            if (level > maxDepth) return null;

            return {
                _key: catKey,
                name: `Category ${catKey}`,
                code: `CODE-${catKey}`,
                depth: level,
                children: [],
            };
        };

        if (!parentKey) {
            const roots = await this.getRootCategories();
            return {
                _key: 'root',
                name: 'Root',
                code: 'ROOT',
                depth: 0,
                children: roots.map((r) => buildTree(r._key, 1)).filter((c): c is CategoryTree => c !== null),
            };
        }

        return buildTree(parentKey, 1) ?? { _key: parentKey, name: '', code: '', depth: 0, children: [] };
    }

    /**
     * Create new category with optional parent
     */
    async createCategory(key: string, name: string, code: string, parentKey?: string, containParts = false): Promise<PartCategory> {
        const newCat = {
            _key: key,
            name,
            code,
            containParts,
        };

        // Insert category
        const catResult = await this.db.query(aql`
            INSERT ${newCat} INTO part_cats RETURN NEW
        `);
        const [insertedCat] = await catResult.all();

        // Link to parent if provided
        if (parentKey) {
            await this.db.query(aql`
                INSERT {
                    _from: ${'part_cats/' + parentKey},
                    _to: ${insertedCat._id},
                    order: 0
                } INTO part_cats_links
            `);
        }

        return insertedCat;
    }

    /**
     * Move a category to a different parent
     */
    async moveCategory(childKey: string, newParentKey: string): Promise<boolean> {
        // Delete old edge
        await this.db.query(aql`
            FOR edge IN part_cats_links
                FILTER edge._to == ${'part_cats/' + childKey}
                REMOVE edge IN part_cats_links
        `);

        // Create new edge
        await this.db.query(aql`
            INSERT {
                _from: ${'part_cats/' + newParentKey},
                _to: ${'part_cats/' + childKey},
                order: 0
            } INTO part_cats_links
        `);

        return true;
    }

    /**
     * Soft delete a category (mark as deleted)
     */
    async softDelete(categoryKey: string): Promise<boolean> {
        const now = new Date();
        const result = await this.db.query(aql`
            UPDATE {_key: ${categoryKey}} WITH {_deleted: ${now}} IN part_cats
            RETURN NEW
        `);
        return Boolean(await result.next());
    }

    /**
     * Hard delete a category and cascade to children
     */
    async cascadeDelete(categoryKey: string): Promise<{
        deletedCount: number;
        deletedEdgeCount: number;
    }> {
        const categoryId = `part_cats/${categoryKey}`;

        // Single query: collect all descendants, delete edges and docs in bulk
        const result = await this.db.query(aql`
            LET descendantKeys = (
                FOR doc IN 1..100 OUTBOUND ${categoryId} part_cats_links
                    RETURN doc._key
            )
            LET allKeys = APPEND(descendantKeys, ${categoryKey})
            LET allIds = ( FOR k IN allKeys RETURN CONCAT('part_cats/', k) )

            LET deletedEdges = (
                FOR edge IN part_cats_links
                    FILTER edge._from IN allIds OR edge._to IN allIds
                    REMOVE edge IN part_cats_links
                    RETURN 1
            )

            LET deletedDocs = (
                FOR k IN allKeys
                    REMOVE { _key: k } IN part_cats
                    RETURN 1
            )

            RETURN {
                deletedCount: LENGTH(deletedDocs),
                deletedEdgeCount: LENGTH(deletedEdges)
            }
        `);

        const [counts] = await result.all();
        return counts;
    }

    /**
     * Get category statistics
     */
    async getCategoryStats(): Promise<CategoryStatistics[]> {
        const result = await this.db.query(aql`
            FOR cat IN part_cats
                FILTER cat._deleted == null
                LET childCount = LENGTH(
                    FOR edge IN part_cats_links
                        FILTER edge._from == cat._id
                        RETURN 1
                )
                LET parentCount = LENGTH(
                    FOR edge IN part_cats_links
                        FILTER edge._to == cat._id
                        RETURN 1
                )
                LET depth = COUNT(
                    FOR ancestor IN 0..100 INBOUND cat._id part_cats_links
                        RETURN 1
                )
                RETURN {
                    category: cat._key,
                    name: cat.name,
                    code: cat.code,
                    containParts: cat.containParts,
                    childCount: childCount,
                    parentCount: parentCount,
                    depth: depth,
                    isLeaf: childCount == 0,
                    isRoot: parentCount == 0
                }
    `);
        return result.all();
    }

    /**
     * Search for categories by name or code
     */
    async searchCategories(searchTerm: string): Promise<PartCategory[]> {
        const lowerSearch = searchTerm.toLowerCase();
        const result = await this.db.query(aql`
            FOR cat IN part_cats
                FILTER cat._deleted == null
                FILTER (CONTAINS(LOWER(cat.code), ${lowerSearch})
                    || CONTAINS(LOWER(cat.name), ${lowerSearch}))
                RETURN cat
        `);
        return result.all();
    }
}

export const categoryQueries = new CategoryQueries();
