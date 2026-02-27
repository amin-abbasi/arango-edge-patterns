# ArangoDB Edge Patterns in Enterprise ERP Systems

A comprehensive showcase of advanced ArangoDB edge collection patterns used in real-world enterprise resource planning (ERP) systems. This repository demonstrates practical implementations of hierarchical relationships, traversal queries, and graph-based data operations.

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 16+
- npm

### Setup

```bash
# Start ArangoDB
docker-compose up -d

# Install dependencies
npm install

# Seed sample data
npm run seed

# Start development server
npm run dev

# Server runs on http://localhost:6000
```

## 📚 What You'll Learn

This repository showcases **three core edge patterns** used in production ERP systems:

### Pattern 1: Hierarchical Category Trees

**Use Case**: Product categorization with inherited properties

```mermaid
graph TD
    Root["🏷️ Root Category"]
    Root -->|part_cats_links| Electronics["Electronics"]
    Root -->|part_cats_links| Mechanical["Mechanical"]

    Electronics -->|part_cats_links| Semiconductors["Semiconductors"]
    Electronics -->|part_cats_links| Passives["Passive Components"]

    Semiconductors -->|part_cats_links| ICs["Integrated Circuits"]
    Semiconductors -->|part_cats_links| Transistors["Transistors"]

    Passives -->|part_cats_links| Resistors["Resistors"]
    Passives -->|part_cats_links| Capacitors["Capacitors"]

    style Root fill:#ff6b6b
    style Electronics fill:#4ecdc4
    style Mechanical fill:#4ecdc4
    style Semiconductors fill:#45b7d1
    style ICs fill:#96ceb4
```

**Key Operations**:

- Find all descendants at specific depth
- Retrieve hierarchical properties
- Delete with cascade behavior
- Validate parent-child relationships

---

### Pattern 2: Warehouse Node Hierarchy

**Use Case**: Storage location structure with capacity tracking

```mermaid
graph TD
    Storage["🏭 Storage"]
    Storage -->|w_node_links| Zone1["Zone A: Electronics"]
    Storage -->|w_node_links| Zone2["Zone B: Mechanical"]

    Zone1 -->|w_node_links| Rack1["Rack A1"]
    Zone1 -->|w_node_links| Rack2["Rack A2"]

    Rack1 -->|w_node_links| Shelf1["Shelf A1-1"]
    Rack1 -->|w_node_links| Shelf2["Shelf A1-2"]

    Shelf1 -->|w_node_links| Container1["Container A1-1-1"]
    Shelf1 -->|w_node_links| Container2["Container A1-1-2"]

    style Storage fill:#ff6b6b
    style Zone1 fill:#4ecdc4
    style Zone2 fill:#4ecdc4
    style Rack1 fill:#45b7d1
    style Container1 fill:#96ceb4
```

**Key Operations**:

- Bidirectional traversal (ancestors and descendants)
- Location-based inventory queries
- Capacity calculations across hierarchy
- Dynamic property fetching from related node types

---

### Pattern 3: Advanced Traversals & Aggregations

**Use Case**: Complex multi-level queries with related data

```mermaid
graph LR
    QR["Query Root:<br/>Find Total Qty<br/>in Subtree"]
    QR -->|OUTBOUND| N1["Node 1"]
    QR -->|OUTBOUND| N2["Node 2"]

    N1 -->|OUTBOUND| N1A["Node 1.1"]
    N1 -->|OUTBOUND| N1B["Node 1.2"]

    N1A -->|LOOKUP Container| CT["Container Info"]
    CT -->|LOOKUP Type| TY["Type w/ Capacity"]

    QR -->|JOIN| T["Tasks Table"]
    T -->|JOIN| P["Positions"]
    P -->|SUM Qty| Total["Total Quantity"]

    style QR fill:#ff6b6b
    style N1 fill:#4ecdc4
    style N2 fill:#4ecdc4
    style Total fill:#2ecc71
    style CT fill:#f39c12
```

**Key Operations**:

- Multi-level OUTBOUND/INBOUND traversals
- Cross-collection joins
- Conditional aggregations
- Performance-optimized queries

---

## 📁 Repository Structure

```
arango-edge-patterns-erp/
├── README.md                          # This file
├── docs/
│   ├── edge-patterns-explained.md     # Detailed pattern explanations
│   ├── architecture.md                # System design & relationships
│   ├── performance-guide.md           # Optimization & indexing
│   └── query-patterns.md              # Common query templates
├── examples/
│   ├── 01-hierarchical-categories/
│   │   ├── schema.aql                 # Collection definitions
│   │   ├── queries.aql                # AQL query patterns
│   │   └── relations.md               # Entity relationships
│   ├── 02-warehouse-hierarchy/
│   │   ├── schema.aql
│   │   ├── queries.aql
│   │   └── relations.md
│   └── 03-advanced-traversals/
│       ├── queries.aql
│       └── use-cases.md
├── src/
│   ├── index.ts                       # Express.js entry point
│   ├── db.ts                          # ArangoDB connection
│   ├── models/
│   │   ├── PartCategory.ts            # Category model
│   │   ├── WarehouseNode.ts           # Warehouse node model
│   │   └── types.ts                   # TypeScript interfaces
│   ├── queries/
│   │   ├── categories.ts              # Category queries
│   │   ├── warehouse.ts               # Warehouse queries
│   │   └── traversal.ts               # Generic traversal utilities
│   ├── utils/
│   │   └── logger.ts
│   └── routes/
│       ├── categories.ts              # Category endpoints
│       ├── warehouse.ts               # Warehouse endpoints
│       └── health.ts                  # Health check
├── docker-compose.yml                 # ArangoDB setup
├── seed-data.aql                      # Sample data for demos
├── tsconfig.json                      # TypeScript config
├── package.json
└── .env.example                       # Environment variables
```

## 🔍 Core Concepts

### What are Edges?

Edges in ArangoDB are collections that store relationships between documents. They have special `_from` and `_to` fields pointing to document IDs.

```typescript
// Document Collection
{ _key: "electronics", name: "Electronics", ... }

// Edge Collection
{ _key: "semiconductors->electronics", _from: "categories/semiconductors", _to: "categories/electronics" }
```

### Why Use Edges Instead of Denormalization?

```mermaid
graph LR
    A["❌ Denormalization<br/>---<br/>Store parent in<br/>each child doc"]
    B["✅ Edge Collections<br/>---<br/>Store relationship<br/>separately"]

    A1["Pros: Direct access"] --> A
    A2["Cons: Data duplication<br/>Update complexity<br/>Query flexibility"] --> A

    B1["Pros: Single source<br/>Rich queries<br/>Graph traversal"] --> B
    B2["Cons: Need joins<br/>Slight overhead"] --> B

    style A fill:#ff6b6b
    style B fill:#2ecc71
    style A1 fill:#ffcccc
    style A2 fill:#ff9999
    style B1 fill:#ccffcc
    style B2 fill:#99ff99
```

## 📖 Examples Overview

### 1. Hierarchical Categories

- **File**: `examples/01-hierarchical-categories/`
- **Demonstrates**:
    - Creating multi-level category trees
    - Querying all descendants at any depth
    - Filtering categories by parent
    - Handling cascade deletions
    - Inherited property traversal

**Query Example**:

```aql
FOR doc, edge, path IN 1..LEVELS OUTBOUND parent part_cats_links
  FILTER doc._deleted == null
  RETURN doc
```

### 2. Warehouse Hierarchy

- **File**: `examples/02-warehouse-hierarchy/`
- **Demonstrates**:
    - Building location trees (Storage → Zone → Rack → Shelf)
    - Finding ancestors (get parent storage of any location)
    - Finding descendants (all sub-locations)
    - Aggregating quantities across hierarchy
    - Lookup related collections (node types, containers)

**Query Example**:

```aql
FOR node, edge, path IN 1..DEPTH OUTBOUND parent w_node_links
  LET containers = (FOR c IN w_containers FILTER c.node == node._key RETURN c)
  RETURN { node, containers }
```

### 3. Advanced Traversals

- **File**: `examples/03-advanced-traversals/`
- **Demonstrates**:
    - Multi-collection joins with edges
    - Conditional aggregations
    - Performance-optimized patterns
    - Error handling and constraints

## 🛠️ API Endpoints

```mermaid
graph TD
    API["Express.js API"]

    CATAPI["Category Management"]
    WAREHAPI["Warehouse Management"]
    HEALTHAPI["Health & Status"]

    API -->|/api/categories| CATAPI
    API -->|/api/warehouse| WAREHAPI
    API -->|/api/health| HEALTHAPI

    CATAPI -->|GET /list| ListCats["List all categories"]
    CATAPI -->|GET /:id| GetCat["Get category details"]
    CATAPI -->|GET /:id/descendants| DescCats["Get sub-categories"]
    CATAPI -->|POST| CreateCat["Create category"]
    CATAPI -->|DELETE /:id| DeleteCat["Delete cascade"]

    WAREHAPI -->|GET /nodes| ListNodes["List all nodes"]
    WAREHAPI -->|GET /:id/tree| NodeTree["Get location tree"]
    WAREHAPI -->|GET /:id/capacity| NodeCap["Get capacity info"]

    style API fill:#ff6b6b
    style CATAPI fill:#4ecdc4
    style WAREHAPI fill:#45b7d1
    style ListCats fill:#96ceb4
```

## 📊 Performance Considerations

### Indexing Strategy

The showcase includes indexes on common query patterns:

```aql
// Index on edge traversal starting points
db.part_cats_links.ensureIndex({fields: ["_from", "_to"], type: "persistent"})

// Index on deletion checks
db.part_cats.ensureIndex({fields: ["_deleted"]})
```

### Query Optimization Tips

1. **Use path constraints**: Specify min/max levels to avoid full traversals
2. **Filter early**: Apply filters as close to collection scan as possible
3. **Reduce RETURN data**: Select only needed fields
4. **Use COLLECT for aggregations**: Instead of multiple queries

## 🔒 Real-World Use Cases

### Use Case 1: Product Hierarchy with Inherited Specs

```
Electronics
├── Semiconductors (tolerance: ±10%)
│   ├── ICs (supply: international)
│   └── Transistors (supply: regional)
└── Passives (tolerance: ±5%)
    ├── Resistors
    └── Capacitors
```

Each level can inherit parent specs while allowing overrides.

### Use Case 2: Multi-Warehouse Inventory

```
Enterprise
├── Warehouse A (capacity: 1000 units)
│   ├── Zone A (capacity: 300 units)
│   │   └── Rack A1 (capacity: 75 units)
│   └── Zone B (capacity: 700 units)
└── Warehouse B (capacity: 2000 units)
```

Calculate real-time capacity across any subtree instantly.

### Use Case 3: Supply Chain Lineage

Track materials → parts → assemblies → products using edges to understand complete dependency trees and impact analysis.

## 📚 Documentation

- [Edge Patterns Explained](docs/edge-patterns-explained.md) - Deep dive into each pattern
- [Architecture Guide](docs/architecture.md) - System design decisions
- [Performance Guide](docs/performance-guide.md) - Optimization strategies
- [Query Patterns](docs/query-patterns.md) - Common templates

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific example
npm run test:categories

# Run with coverage
npm test -- --coverage
```

## 🚀 Deployment

See [DEPLOYMENT.md](docs/deployment.md) for production considerations.

## 📄 License

MIT

## 🤝 Contributing

This is a showcase repository. Feel free to fork and adapt to your use cases!

---

**Built with ❤️ as an enterprise ERP pattern showcase** | [ArangoDB Documentation](https://www.arangodb.com/docs/)
