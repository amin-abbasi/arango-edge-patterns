# Edge Patterns Explained

## What are Edge Collections?

Edge collections in ArangoDB are special document collections designed to represent **relationships between documents**. Each edge document has two mandatory fields:

- `_from`: The ID of the source document
- `_to`: The ID of the destination document
- All other fields are optional and can store relationship metadata

```typescript
// Example edge document
{
  _key: "semiconductors-to-electronics",
  _from: "part_cats/semiconductors",
  _to: "part_cats/electronics",
  order: 1,
  status: "active"
}
```

## Pattern 1: Hierarchical Category Trees

### Overview

Categories are organized in a multi-level tree structure where:
- Each category can have **one or more parent categories**
- Each category can have **multiple child categories**
- Properties can be inherited from ancestors
- Deletions can cascade through descendants

### Schema

```mermaid
erDiagram
    PART_CATS ||--o{ PART_CATS_LINKS : ""
    PART_CATS {
        string _key
        string name
        string code
        boolean containParts
        string _deleted "optional"
    }
    PART_CATS_LINKS {
        string _key
        string _from "part_cats/${parentId}"
        string _to "part_cats/${childId}"
        int order
    }
```

### Data Flow

```mermaid
sequenceDiagram
    Client->>API: GET /categories/:id/descendants
    API->>ArangoDB: Query hierarchy
    ArangoDB->>ArangoDB: 1. Get document by _key
    ArangoDB->>ArangoDB: 2. Traverse outbound edges
    ArangoDB->>ArangoDB: 3. Follow chains recursively
    ArangoDB-->>API: Return all descendants
    API-->>Client: JSON response
```

### Query Pattern: Find All Descendants at Depth

**Why this matters**: You want to show a category and all its direct children (depth 1) or full subtree (depth ∞).

```aql
LET parentKey = @parentKey
LET depth = @depth  // 1 for direct children, 'LARGEST_INT' for all

FOR doc, edge, path IN 1..depth OUTBOUND parent part_cats_links
  FILTER doc._deleted == null
  RETURN {
    _key: doc._key,
    name: doc.name,
    code: doc.code,
    level: path.vertices[*]._key[* - 1]
  }
```

### Query Pattern: Get Full Ancestry Chain

**Why this matters**: Trace from any category all the way up to root for breadcrumb navigation.

```aql
FOR doc, edge, path IN 0..100 INBOUND category part_cats_links
  FILTER doc._deleted == null
  RETURN {
    level: LENGTH(path.vertices),
    _key: doc._key,
    name: doc.name
  }
```

### Visualization: Query Execution

```mermaid
graph TD
    Query["Query: Get descendants of Electronics"]
    Start["Start: Electronics (_key)"]
    Query --> Start
    
    Start --> Step1["Step 1: Look up document"]
    Step1 --> Step2["Step 2: Find outbound edges<br/>(where _from = electronics)"]
    Step2 --> Step3["Step 3: Get target documents<br/>(Semiconductors, Passives)"]
    Step3 --> Step4["Step 4: Repeat for each child<br/>(if depth > 1)"]
    Step4 --> Step5["Step 5: Filter _deleted == null"]
    Step5 --> Return["Return: Array of all descendants"]
    
    style Start fill:#ff6b6b
    style Step2 fill:#4ecdc4
    style Step3 fill:#45b7d1
    style Return fill:#2ecc71
```

### Cascade Deletion Pattern

**Problem**: When you delete a parent category, what happens to children?

**Solution**: Use mutations to find and delete all related edges first.

```aql
// Step 1: Find all child edges pointing TO this category
FOR edge IN part_cats_links
  FILTER edge._to == @categoryId
  REMOVE edge IN part_cats_links

// Step 2: Find all parent edges coming FROM this category  
FOR edge IN part_cats_links
  FILTER edge._from == @categoryId
  REMOVE edge IN part_cats_links

// Step 3: Finally delete the category itself
REMOVE @categoryId IN part_cats
```

---

## Pattern 2: Warehouse Node Hierarchy

### Overview

Warehouse locations form a tree:

```
Storage (Root)
  └── Zones (level 1: "Electronics", "Mechanical")
      └── Racks (level 2: "Rack A1", "Rack B3")
          └── Shelves (level 3: "Shelf A1-1", "Shelf A1-2")
              └── Containers (level 4: items stored here)
```

### Schema

```mermaid
erDiagram
    W_STORAGES ||--o{ W_NODE_LINKS : ""
    W_NODES ||--o{ W_NODE_LINKS : "parent"
    W_NODES ||--o{ W_NODE_TYPES : ""
    W_NODES ||--o{ W_CONTAINERS : ""
    
    W_STORAGES {
        string _key
        string code
        string description
        string business_unit
    }
    
    W_NODES {
        string _key
        string code
        string description
        string type
        string zone
        boolean hasContainer
    }
    
    W_NODE_LINKS {
        string _from "w_nodes/ or w_storages/"
        string _to "w_nodes/"
    }
    
    W_NODE_TYPES {
        string _key
        string name
        boolean hasContainer
        string zone
        int capacity
    }
    
    W_CONTAINERS {
        string _key
        string node
        string id
        int quantity
    }
```

### Key Difference from Categories

Unlike categories which are simpler, warehouse nodes need **bidirectional queries**:

```mermaid
graph LR
    Root["Node: Shelf A1-1"]
    
    Root -->|OUTBOUND| Child1["Child 1: Container"]
    Root -->|OUTBOUND| Child2["Child 2: Container"]
    
    Root -->|INBOUND| Parent["Parent: Rack A1"]
    Parent -->|INBOUND| GrandParent["GrandParent: Zone A"]
    
    Root -->|Lookup| Type["Node Type<br/>hasContainer=true<br/>capacity=100"]
    Root -->|Lookup| Containers["Containers<br/>quantity=45"]
    
    style Root fill:#ff6b6b
    style Child1 fill:#96ceb4
    style Parent fill:#4ecdc4
    style Type fill:#f39c12
    style Containers fill:#f39c12
```

### Query Pattern: Get Full Node Ancestry

**Why this matters**: Navigate from any location back to the storage root for context.

```aql
FOR node, edge, path IN 0..100 INBOUND currentNode w_node_links
  RETURN {
    depth: LENGTH(path.vertices),
    _key: node._key,
    code: node.code,
    type: node.type
  }
```

### Query Pattern: Get Subtree with Capacity

**Why this matters**: Find all child locations and their current capacity usage.

```aql
LET currentNode = @nodeKey
FOR node, edge, path IN 1..100 OUTBOUND currentNode w_node_links
  LET nodeType = FIRST(
    FOR type IN w_node_types
      FILTER type._key == node.type
      RETURN type
  )
  LET containers = (
    FOR container IN w_containers
      FILTER container.node == node._key
      RETURN container
  )
  LET usedCapacity = SUM(containers[*].quantity)
  RETURN {
    node: node,
    capacity: nodeType.capacity,
    used: usedCapacity,
    available: nodeType.capacity - usedCapacity,
    containerCount: LENGTH(containers)
  }
```

### Query Pattern: Get Storage Root from Any Node

**Why this matters**: Find which storage facility any item is in, regardless of depth.

```aql
FOR node, edge, path IN 0..100 INBOUND startNode w_node_links
  FILTER path.edges[-1].source == null || CONTAINS(path.edges[-1]._from, 'w_storages/')
  RETURN {
    storage: node,
    depth: LENGTH(path.vertices),
    path: path.vertices[*]._key
  }
```

---

## Pattern 3: Advanced Traversals & Aggregations

### Complex Real-World Scenario

Calculate total inventory quantity in a warehouse zone including:
1. All containers recursively
2. Across all subtree nodes
3. With container type information
4. Filtered by product category

```mermaid
graph TD
    Query["Goal: Get total qty<br/>of Semiconductors<br/>in Zone A"]
    Query --> Step1["Find Zone A"]
    Step1 --> Step2["Get all Rack descendants"]
    Step2 --> Step3["Get all Shelf descendants"]
    Step3 --> Step4["Get all Container descendants"]
    Step4 --> Step5["For each container:<br/>lookup quantity"]
    Step5 --> Step6["Filter by part category"]
    Step6 --> Step7["Sum all quantities"]
    Step7 --> Result["Total: 5,427 units"]
    
    style Query fill:#ff6b6b
    style Step7 fill:#f39c12
    style Result fill:#2ecc71
```

### Query Pattern: Multi-Level Aggregation

```aql
LET zoneKey = @zoneKey
LET categoryFilter = @categoryKey

// Get all descendant nodes
LET allNodes = (
  FOR node IN 1..100 OUTBOUND zoneKey w_node_links
    RETURN node._key
)

// For each node, get containers and sum
LET inventory = (
  FOR nodeKey IN allNodes
    LET containers = (
      FOR container IN w_containers
        FILTER container.node == nodeKey
        LET item = FIRST(
          FOR part IN parts
            FILTER part._key == container.part_id
            LET itemCategory = FIRST(
              FOR cat IN part_cats
                FILTER cat._key == part.category
                RETURN cat._key
            )
            FILTER itemCategory == categoryFilter
            RETURN { _key: part._key, qty: container.quantity }
        )
        FILTER item != null
        RETURN item.qty
    )
    RETURN { node: nodeKey, qty: SUM(containers) }
)

RETURN {
  zone: zoneKey,
  category: categoryFilter,
  nodes: LENGTH(allNodes),
  containers: LENGTH(FLATTEN(inventory)),
  totalQuantity: SUM(inventory[*].qty)
}
```

### Comparison: Edge vs Denormalization

```mermaid
graph LR
    A["❌ Denormalized<br/>(parent_id in child)"]
    B["✅ Edge Collection"]
    
    A1["Pros"] --> AP1["✠ Fast child queries"]
    A1 --> AP2["✠ No joins needed"]
    
    A2["Cons"] --> AC1["✗ Update parent_id<br/>in all children"]
    A2 --> AC2["✗ Can't traverse UP"]
    A2 --> AC3["✗ Move/reparent<br/>is expensive"]
    A2 --> AC4["✗ Duplicate parent<br/>reference"]
    
    B1["Pros"] --> BP1["✠ Traverse both<br/>directions"]
    B1 --> BP2["✠ Reparent is<br/>one edge update"]
    B1 --> BP3["✠ Rich relationship<br/>metadata"]
    B1 --> BP4["✠ Graph operations"]
    
    B2["Cons"] --> BC1["✗ Need JOIN for<br/>parent lookup"]
    B2 --> BC2["✗ Slight overhead<br/>for traversals"]
    
    style A fill:#ff6b6b
    style B fill:#2ecc71
```

---

## Common Pitfalls & Solutions

### Pitfall 1: No Filtering on _deleted

**Problem**: When you soft-delete, old documents still returned in traversals.

```aql
// ❌ WRONG - returns deleted categories
FOR doc IN 1..100 OUTBOUND parent part_cats_links
  RETURN doc

// ✅ CORRECT - filters deleted
FOR doc IN 1..100 OUTBOUND parent part_cats_links
  FILTER doc._deleted == null
  RETURN doc
```

### Pitfall 2: Unbounded Traversals

**Problem**: Circular edges or very deep trees can timeout.

```aql
// ❌ WRONG - infinite traversal
FOR doc IN OUTBOUND parent part_cats_links
  RETURN doc

// ✅ CORRECT - bounded depth
FOR doc IN 1..10 OUTBOUND parent part_cats_links
  RETURN doc
```

### Pitfall 3: Missing Index Direction

**Problem**: Edge indexes need direction for optimal performance.

```aql
// Index for outbound traversals (child lookup)
db.part_cats_links.ensureIndex({
  fields: ["_from"],
  type: "persistent"
})

// Index for inbound traversals (parent lookup)
db.part_cats_links.ensureIndex({
  fields: ["_to"],
  type: "persistent"
})
```

---

## Summary Table

| Pattern | Use Case | Primary Operation | Example |
|---------|----------|-------------------|---------|
| **Category Tree** | Product hierarchies | OUTBOUND (find children) | "Show all Semiconductors under Electronics" |
| **Warehouse Nodes** | Location trees | Bidirectional (parent + children) | "Find all shelves in Rack A + parent Zone" |
| **Traversal + Aggregation** | Complex analytics | Multi-path joins | "Total Semiconductors qty in Zone A" |

---

**Next**: See [architecture.md](architecture.md) for system design details.
