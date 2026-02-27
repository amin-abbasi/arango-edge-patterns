# System Architecture

## Overall System Design

```mermaid
graph TB
    Client["Client Browser"]
    
    subgraph "Node.js Application"
        API["Express.js API<br/>Routes & Controllers"]
        Models["Models<br/>PartCategory, WarehouseNode"]
        Queries["Query Service<br/>Abstract AQL logic"]
        Utils["Utilities<br/>Logging, error handling"]
    end
    
    subgraph "ArangoDB Database"
        Collections["Collections"]
        Edges["Edge Collections"]
    end
    
    Client -->|HTTP| API
    API --> Models
    Models --> Queries
    Queries -->|AQL| Edges
    Queries -->|AQL| Collections
    
    style Client fill:#95e1d3
    style API fill:#38a792
    style Models fill:#247ab0
    style Queries fill:#4e87c8
    style Collections fill:#6ba5d4
    style Edges fill:#a8d4e8
```

## Data Collections

### Part Categories System

```mermaid
erDiagram
    PART_CATS ||--o{ PART_CATS_LINKS : "hierarchy"
    PART_CATS ||--o{ PART_CATS_PROPS : "properties"
    PART_CATS ||--o{ PARTS : "contains"
    
    PART_CATS {
        string _key "unique category identifier"
        string name "Category name"
        string code "Short code"
        boolean containParts "Can hold parts"
        timestamp _created
        timestamp _updated
        datetime _deleted "soft delete marker"
    }
    
    PART_CATS_LINKS {
        string _from "parent category"
        string _to "child category"
        int order "display order"
    }
    
    PART_CATS_PROPS {
        string _key
        string cat "category _key"
        string name "property name"
        string type "enum, number, string"
        boolean isOptional
        string options "json for enums"
    }
    
    PARTS {
        string _key
        string name
        string category "category _key"
        string manufacturer
    }
```

### Warehouse System

```mermaid
erDiagram
    W_STORAGES ||--o{ W_NODES : "contains"
    W_NODES ||--o{ W_NODE_LINKS : "hierarchy"
    W_NODES ||--o{ W_NODE_TYPES : "typed_by"
    W_NODES ||--o{ W_CONTAINERS : "holds"
    W_CONTAINERS ||--o{ W_CONTAINER_ITEMS : "contains"
    
    W_STORAGES {
        string _key "storage facility id"
        string code "facility code"
        string description
        string business_unit "which unit owns"
    }
    
    W_NODES {
        string _key "location identifier"
        string code "location code"
        string description
        string type "zone, rack, shelf, etc"
        string zone "red, green, yellow"
        boolean hasContainer "accepts items"
    }
    
    W_NODE_LINKS {
        string _from "parent node or storage"
        string _to "child node"
    }
    
    W_NODE_TYPES {
        string _key "type identifier"
        string name "Human readable name"
        boolean hasContainer
        string zone "red, green, yellow"
        int capacity "max items per location"
    }
    
    W_CONTAINERS {
        string _key
        string node "which node"
        string id "container barcode"
        string part_id "what part stored"
        int quantity "how many"
    }
    
    W_CONTAINER_ITEMS {
        string container
        string part
        int quantity
    }
```

## Request Flow: Get Category Descendants

```mermaid
sequenceDiagram
    participant Client
    participant RouteHandler
    participant QueryService
    participant Database as ArangoDB
    participant Cache as Memory Cache

    Client->>RouteHandler: GET /api/categories/electronics/descendants?depth=2
    
    RouteHandler->>RouteHandler: Validate params
    RouteHandler->>Cache: Check if cached
    alt Cache hit
        Cache-->>RouteHandler: Return cached result
    else Cache miss
        RouteHandler->>QueryService: getDescendants(electronicKey, depth=2)
        QueryService->>QueryService: Build AQL query
        QueryService->>Database: Execute AQL
        
        Database->>Database: Step 1: Lookup electronics
        Database->>Database: Step 2: Find outbound edges<br/>(where _from='categories/electronics')
        Database->>Database: Step 3: Get targets<br/>(semiconductors, passives)
        Database->>Database: Step 4: Repeat for depth=2
        Database->>Database: Step 5: Filter _deleted==null
        
        Database-->>QueryService: Result: array of docs
        QueryService->>Cache: Store result (5 min TTL)
        QueryService-->>RouteHandler: { descendants: [...] }
    end
    
    RouteHandler->>RouteHandler: Format response
    RouteHandler-->>Client: HTTP 200 + JSON
```

## Request Flow: Get Warehouse Node Tree with Capacity

```mermaid
sequenceDiagram
    participant Client
    participant RouteHandler
    participant QueryService
    participant Database as ArangoDB

    Client->>RouteHandler: GET /api/warehouse/Zone-A/tree
    
    RouteHandler->>QueryService: getNodeTree(zoneKey)
    
    QueryService->>Database: 1. Find Zone-A node
    QueryService->>Database: 2. Get descendant nodes (depth: 1..100)
    
    par For each child node
        QueryService->>Database: Lookup w_node_types
        QueryService->>Database: Get containers in this node
    end
    
    Database-->>QueryService: Raw results (nodes + types + containers)
    
    QueryService->>QueryService: Build tree structure
    QueryService->>QueryService: Calculate capacities
    QueryService->>QueryService: Calculate availability
    
    QueryService-->>RouteHandler: Structured tree object
    RouteHandler-->>Client: HTTP 200 + Tree JSON
```

## Class Hierarchy

```mermaid
classDiagram
    class Database {
        +connection: ArangoDB
        +getCollection(name)
        +executeQuery(aql, bindVars)
    }
    
    class PartCategory {
        -key: string
        -name: string
        -code: string
        +getDescendants(depth)
        +getAncestors()
        +delete()
    }
    
    class WarehouseNode {
        -key: string
        -code: string
        -type: string
        +getChildren()
        +getAncestors()
        +getCapacity()
        +getTotalQuantity()
    }
    
    class QueryService {
        +categoryQueries: CategoryQueries
        +warehouseQueries: WarehouseQueries
        +traversalQueries: TraversalQueries
    }
    
    class CategoryQueries {
        +findByKey(key)
        +findDescendants(parentKey, depth)
        +findAncestors(childKey)
        +cascadeDelete(categoryKey)
    }
    
    class WarehouseQueries {
        +findNodes(storageKey)
        +findNodeTree(nodeKey)
        +findAncestors(nodeKey)
        +calculateCapacity(nodeKey)
    }
    
    Database <-- QueryService
    PartCategory ..> CategoryQueries
    WarehouseNode ..> WarehouseQueries
    QueryService *-- CategoryQueries
    QueryService *-- WarehouseQueries
```

## TypeScript Type System

```typescript
// Models
interface PartCategory {
  _key: string;
  _id: string;
  name: string;
  code: string;
  containParts: boolean;
  _created: Date;
  _updated: Date;
  _deleted?: Date;
}

interface PartCategoryLink {
  _key: string;
  _from: string;  // "part_cats/parent_id"
  _to: string;    // "part_cats/child_id"
  order: number;
}

interface WarehouseNode {
  _key: string;
  code: string;
  description: string;
  type: string;
  zone: 'red' | 'green' | 'yellow';
  hasContainer: boolean;
}

interface NodeLink {
  _key: string;
  _from: string;  // "w_nodes/parent_id" or "w_storages/storage_id"
  _to: string;    // "w_nodes/child_id"
}

// Query Results
interface DescendantsResult {
  _key: string;
  name: string;
  level: number;
  path: string[];
}

interface NodeTreeResult {
  node: WarehouseNode;
  capacity: number;
  used: number;
  available: number;
  children: NodeTreeResult[];
}
```

## API Response Signatures

### Category Endpoints

```typescript
// GET /api/categories/list
Response: {
  success: boolean;
  data: PartCategory[];
  count: number;
}

// GET /api/categories/:id/descendants
Response: {
  success: boolean;
  data: DescendantsResult[];
  parent: PartCategory;
  depth: number;
}

// POST /api/categories
Body: { name: string; code: string; parentId?: string }
Response: {
  success: boolean;
  data: PartCategory;
  message: string;
}

// DELETE /api/categories/:id
Response: {
  success: boolean;
  deletedCount: number;
  deletedEdgeCount: number;
  message: string;
}
```

### Warehouse Endpoints

```typescript
// GET /api/warehouse/nodes/:id/tree
Response: {
  success: boolean;
  data: NodeTreeResult;
  generatedAt: ISO8601;
}

// GET /api/warehouse/nodes/:id/ancestors
Response: {
  success: boolean;
  path: WarehouseNode[];
  depth: number;
}

// GET /api/warehouse/capacity/:nodeId
Response: {
  success: boolean;
  node: WarehouseNode;
  capacity: number;
  used: number;
  available: number;
  utilizationPercent: number;
}
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Web["Web Browser"]
    end
    
    subgraph "Application Layer"
        LB["Load Balancer"]
        API1["Node.js App #1"]
        API2["Node.js App #2"]
    end
    
    subgraph "Database Layer"
        ADB["ArangoDB<br/>Cluster"]
        Backup["Backup Storage"]
    end
    
    Web -->|HTTPS| LB
    LB --> API1
    LB --> API2
    API1 -->|Connection Pool| ADB
    API2 -->|Connection Pool| ADB
    ADB -->|Daily| Backup
    
    style Web fill:#95e1d3
    style LB fill:#38a792
    style API1 fill:#247ab0
    style API2 fill:#247ab0
    style ADB fill:#6ba5d4
```

---

**Next**: Read [performance-guide.md](performance-guide.md) for optimization strategies.
