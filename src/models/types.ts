// TypeScript types for Category and Warehouse models

export interface BaseDocument {
    _key: string;
    _id: string;
    _rev: string;
}

// ============================================
// PART CATEGORY TYPES
// ============================================

export interface PartCategory extends BaseDocument {
    name: string;
    code: string;
    containParts: boolean;
    _created?: Date;
    _updated?: Date;
    _deleted?: Date;
}

export interface PartCategoryLink {
    _key: string;
    _id: string;
    _rev: string;
    _from: string; // "part_cats/{parentId}"
    _to: string; // "part_cats/{childId}"
    order: number;
}

export interface PartCategoryProperty {
    _key: string;
    cat: string; // category _key
    name: string;
    type: 'string' | 'number' | 'enum' | 'boolean';
    isOptional: boolean;
    options?: string; // JSON for enums
}

export interface Part {
    _key: string;
    name: string;
    code: string;
    category: string; // category _key
    manufacturer: string;
}

// Query Results
export interface CategoryDescendant {
    _key: string;
    name: string;
    depth: number;
    path: string[];
}

export interface CategoryTree {
    _key: string;
    name: string;
    code: string;
    children: CategoryTree[];
    depth: number;
}

export interface CategoryStatistics {
    category: string;
    name: string;
    childCount: number;
    parentCount: number;
    depth: number;
    isLeaf: boolean;
    isRoot: boolean;
}

export interface CategoryCreateRequest {
    name: string;
    code: string;
    parentId?: string;
    containParts?: boolean;
}

export interface CategoryUpdateRequest {
    name?: string;
    code?: string;
    containParts?: boolean;
}

// ============================================
// WAREHOUSE TYPES
// ============================================

export interface Storage extends BaseDocument {
    code: string;
    description: string;
    business_unit: string;
}

export interface WarehouseNode extends BaseDocument {
    code: string;
    description: string;
    type: string; // references w_node_types._key
    zone: 'red' | 'green' | 'yellow' | 'white';
    hasContainer: boolean;
    _created?: Date;
    _updated?: Date;
    _deleted?: Date;
}

export interface NodeLink {
    _key: string;
    _id: string;
    _rev: string;
    _from: string; // "w_nodes/{parentId}" or "w_storages/{storageId}"
    _to: string; // "w_nodes/{childId}"
}

export interface NodeType {
    _key: string;
    name: string;
    hasContainer: boolean;
    zone: 'red' | 'green' | 'yellow' | 'white';
    capacity: number;
}

export interface Container {
    _key: string;
    node: string; // node _key
    id: string; // barcode
    part_id: string;
    quantity: number;
}

// Query Results
export interface NodeCapacityInfo {
    node: WarehouseNode;
    nodeType: NodeType;
    capacity: number;
    used: number;
    available: number;
    utilizationPercent: number;
}

export interface NodeWithContainers {
    node: WarehouseNode;
    containerCount: number;
    containers: Container[];
    totalQuantity: number;
}

export interface WarehouseNodeTree {
    _key: string;
    code: string;
    type: string;
    zone: 'red' | 'green' | 'yellow' | 'white';
    capacity: number;
    usedCapacity: number;
    containerCount: number;
    depth: number;
    children: WarehouseNodeTree[];
}

export interface SubtreeCapacity {
    node: string;
    totalCapacity: number;
    totalUsed: number;
    totalAvailable: number;
    nodeCount: number;
}

export interface InventoryItem {
    part: string;
    quantity: number;
    containerCount: number;
}

export interface ZoneInventory {
    zone: string;
    totalQuantity: number;
    partsType: number;
    inventory: InventoryItem[];
}

export interface NodeCreateRequest {
    code: string;
    description: string;
    type: string;
    zone: 'red' | 'green' | 'yellow' | 'white';
    parentId: string; // node or storage _key
    hasContainer?: boolean;
}

export interface NodeUpdateRequest {
    code?: string;
    description?: string;
    zone?: 'red' | 'green' | 'yellow' | 'white';
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: string;
}

export interface ApiListResponse<T = any> extends ApiResponse<T[]> {
    count: number;
    limit: number;
    offset: number;
}

export interface ApiErrorResponse extends ApiResponse {
    error: string;
    statusCode: number;
    details?: Record<string, any>;
}

// ============================================
// TRAVERSAL UTILITY TYPES
// ============================================

export interface TraversalPath {
    vertices: Array<{ _key: string; _id: string }>;
    edges: Array<{ _key: string; _from: string; _to: string }>;
}

export interface TraversalResult<T> {
    doc: T;
    edge: any;
    path: TraversalPath;
}

export interface AncestorPath {
    level: number;
    _key: string;
    name: string;
    code: string;
}

// ============================================
// FILTER & SEARCH TYPES
// ============================================

export interface CategoryFilter {
    name?: string;
    code?: string;
    parentId?: string;
    includeDeleted?: boolean;
}

export interface NodeFilter {
    code?: string;
    type?: string;
    zone?: 'red' | 'green' | 'yellow' | 'white';
    parentId?: string;
    includeDeleted?: boolean;
}

export interface PaginationParams {
    limit: number;
    offset: number;
}

export interface QueryParams extends PaginationParams {
    sort?: string;
    order?: 'asc' | 'desc';
}
