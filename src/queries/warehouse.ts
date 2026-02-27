import { aql } from 'arangojs/aql.js';
import { WarehouseNode, WarehouseNodeTree, NodeCapacityInfo, NodeWithContainers, SubtreeCapacity, ZoneInventory, AncestorPath, Storage } from '../models/types.js';
import { getDatabase } from '../db.js';

export class WarehouseQueries {
    private db = getDatabase();

    /**
     * Get all storage facilities
     */
    async listStorages(): Promise<Storage[]> {
        const result = await this.db.query(aql`
      FOR storage IN w_storages
        RETURN storage
    `);
        return result.all();
    }

    /**
     * Get a single storage by key
     */
    async getStorage(storageKey: string): Promise<Storage | null> {
        const result = await this.db.query(aql`
      RETURN DOCUMENT(${`w_storages/${storageKey}`})
    `);
        const docs = await result.all();
        return docs[0] || null;
    }

    /**
     * Get all nodes in a storage (direct children only)
     */
    async getStorageNodes(storageKey: string): Promise<WarehouseNode[]> {
        const result = await this.db.query(aql`
      LET storageKey = ${storageKey}
      FOR node, edge IN 1..1 OUTBOUND ${'w_storages/' + storageKey} w_node_links
        FILTER node._deleted == null
        RETURN node
    `);
        return result.all();
    }

    /**
     * Get a single node by key
     */
    async getNode(nodeKey: string): Promise<WarehouseNode | null> {
        const result = await this.db.query(aql`
      RETURN DOCUMENT(${`w_nodes/${nodeKey}`})
    `);
        const docs = await result.all();
        return docs[0] || null;
    }

    /**
     * Get direct children of a node
     */
    async getDirectChildren(nodeKey: string): Promise<WarehouseNode[]> {
        const result = await this.db.query(aql`
      FOR child, edge IN 1..1 OUTBOUND ${'w_nodes/' + nodeKey} w_node_links
        FILTER child._deleted == null
        RETURN child
    `);
        return result.all();
    }

    /**
     * Get full subtree of a node
     */
    async getSubtree(nodeKey: string, maxDepth = 100): Promise<WarehouseNode[]> {
        const result = await this.db.query(aql`
      FOR node IN 1..${maxDepth} OUTBOUND ${'w_nodes/' + nodeKey} w_node_links
        FILTER node._deleted == null
        RETURN node
    `);
        return result.all();
    }

    /**
     * Get all ancestors (parent chain)
     */
    async getAncestors(nodeKey: string): Promise<AncestorPath[]> {
        const result = await this.db.query(aql`
      FOR ancestor, edge, path IN 0..100 INBOUND ${'w_nodes/' + nodeKey} w_node_links
        RETURN {
          level: LENGTH(path.vertices),
          _key: ancestor._key,
          name: ancestor.code,
          code: ancestor.code
        }
    `);
        return result.all();
    }

    /**
     * Get immediate parent
     */
    async getParent(nodeKey: string): Promise<WarehouseNode | null> {
        const result = await this.db.query(aql`
      FOR parent IN 1..1 INBOUND ${'w_nodes/' + nodeKey} w_node_links
        RETURN parent
    `);
        const docs = await result.all();
        return docs[0] || null;
    }

    /**
     * Get parent storage (traverse all the way up to storage)
     */
    async getParentStorage(nodeKey: string): Promise<Storage | null> {
        const result = await this.db.query(aql`
      FOR ancestor IN 0..100 INBOUND ${'w_nodes/' + nodeKey} w_node_links
        FILTER CONTAINS(ancestor._id, 'w_storages/')
        RETURN ancestor
    `);
        const docs = await result.all();
        return docs[0] || null;
    }

    /**
     * Get node with capacity information
     */
    async getNodeCapacity(nodeKey: string): Promise<NodeCapacityInfo | null> {
        const result = await this.db.query(aql`
      LET node = DOCUMENT(${'w_nodes/' + nodeKey})
      LET nodeType = (
        FOR type IN w_node_types
          FILTER type._key == node.type
          RETURN type
      )[0]
      LET usedCapacity = SUM(
        FOR container IN w_containers
          FILTER container.node == ${nodeKey}
          RETURN container.quantity
      )
      RETURN {
        node: node,
        nodeType: nodeType,
        capacity: nodeType.capacity,
        used: usedCapacity || 0,
        available: (nodeType.capacity || 0) - (usedCapacity || 0),
        utilizationPercent: ROUND(((usedCapacity || 0) / (nodeType.capacity || 1)) * 100)
      }
    `);
        const docs = await result.all();
        return docs[0] || null;
    }

    /**
     * Get node with all containers
     */
    async getNodeWithContainers(nodeKey: string): Promise<NodeWithContainers | null> {
        const result = await this.db.query(aql`
      LET node = DOCUMENT(${'w_nodes/' + nodeKey})
      LET containers = (
        FOR container IN w_containers
          FILTER container.node == ${nodeKey}
          RETURN container
      )
      RETURN {
        node: node,
        containerCount: LENGTH(containers),
        containers: containers,
        totalQuantity: SUM(containers[*].quantity)
      }
    `);
        const docs = await result.all();
        return docs[0] || null;
    }

    /**
     * Get subtree capacity (total capacity for entire subtree)
     */
    async getSubtreeCapacity(nodeKey: string): Promise<SubtreeCapacity | null> {
        const result = await this.db.query(aql`
      LET nodeKey = ${nodeKey}
      LET nodeId = ${'w_nodes/' + nodeKey}
      
      LET subtreeNodes = (
        FOR node IN 1..100 OUTBOUND nodeId w_node_links
          FILTER node._deleted == null
          RETURN {_key: node._key, type: node.type}
      )
      
      LET capacityData = (
        FOR nodeInfo IN subtreeNodes
          LET containers = (
            FOR container IN w_containers
              FILTER container.node == nodeInfo._key
              RETURN container.quantity
          )
          LET nodeType = (
            FOR type IN w_node_types
              FILTER type._key == nodeInfo.type
              RETURN type.capacity
          )[0]
          RETURN {
            node: nodeInfo._key,
            capacity: nodeType || 0,
            used: SUM(containers) || 0
          }
      )
      
      RETURN {
        node: nodeKey,
        totalCapacity: SUM(capacityData[*].capacity),
        totalUsed: SUM(capacityData[*].used),
        totalAvailable: SUM(capacityData[*].capacity) - SUM(capacityData[*].used),
        nodeCount: LENGTH(subtreeNodes)
      }
    `);
        const docs = await result.all();
        return docs[0] || null;
    }

    /**
     * Get zone inventory (total items grouped by part)
     */
    async getZoneInventory(zoneKey: string): Promise<ZoneInventory | null> {
        const result = await this.db.query(aql`
      LET zoneKey = ${zoneKey}
      LET zoneId = ${'w_nodes/' + zoneKey}
      
      LET subtreeNodes = (
        FOR node IN 1..100 OUTBOUND zoneId w_node_links
          FILTER node._deleted == null
          RETURN node._key
      )
      
      LET inventory = (
        FOR nodeKey IN subtreeNodes
          FOR container IN w_containers
            FILTER container.node == nodeKey
            COLLECT partId = container.part_id
            AGGREGATE totalQty = SUM(container.quantity),
                      containerCount = COUNT(1)
            RETURN {
              part: partId,
              quantity: totalQty,
              containerCount: containerCount
            }
      )
      
      RETURN {
        zone: zoneKey,
        totalQuantity: SUM(inventory[*].quantity),
        partsType: LENGTH(inventory),
        inventory: inventory
      }
    `);
        const docs = await result.all();
        return docs[0] || null;
    }

    /**
     * Find all empty (unused) locations
     */
    async findEmptyLocations(): Promise<WarehouseNode[]> {
        const result = await this.db.query(aql`
      FOR node IN w_nodes
        FILTER node._deleted == null
        LET containerCount = COUNT(
          FOR container IN w_containers
            FILTER container.node == node._key
            RETURN 1
        )
        FILTER containerCount == 0
        RETURN node
    `);
        return result.all();
    }

    /**
     * Search nodes by code
     */
    async searchNodes(searchTerm: string): Promise<WarehouseNode[]> {
        const lowerSearch = searchTerm.toLowerCase();
        const result = await this.db.query(aql`
      FOR node IN w_nodes
        FILTER node._deleted == null
        FILTER CONTAINS(LOWER(node.code), ${lowerSearch})
        RETURN node
    `);
        return result.all();
    }

    /**
     * Get nodes by zone
     */
    async getNodesByZone(zone: string): Promise<WarehouseNode[]> {
        const result = await this.db.query(aql`
      FOR node IN w_nodes
        FILTER node._deleted == null
        FILTER node.zone == ${zone}
        RETURN node
    `);
        return result.all();
    }

    /**
     * Get nodes by type
     */
    async getNodesByType(nodeType: string): Promise<WarehouseNode[]> {
        const result = await this.db.query(aql`
      FOR node IN w_nodes
        FILTER node._deleted == null
        FILTER node.type == ${nodeType}
        RETURN node
    `);
        return result.all();
    }

    /**
     * Create new node
     */
    async createNode(key: string, code: string, description: string, type: string, zone: string, parentKey: string, hasContainer = false): Promise<WarehouseNode> {
        const newNode = {
            _key: key,
            code,
            description,
            type,
            zone,
            hasContainer,
        };

        const nodeResult = await this.db.query(aql`
      INSERT ${newNode} INTO w_nodes RETURN NEW
    `);
        const [insertedNode] = await nodeResult.all();

        // Link to parent
        const parentId = parentKey.includes('/') ? parentKey : `w_nodes/${parentKey}`;
        await this.db.query(aql`
      INSERT {
        _from: ${parentId},
        _to: ${insertedNode._id}
      } INTO w_node_links
    `);

        return insertedNode;
    }

    /**
     * Move node to different parent
     */
    async moveNode(nodeKey: string, newParentKey: string): Promise<boolean> {
        const nodeId = `w_nodes/${nodeKey}`;
        const newParentId = newParentKey.includes('/') ? newParentKey : `w_nodes/${newParentKey}`;

        // Delete old edge
        await this.db.query(aql`
      FOR edge IN w_node_links
        FILTER edge._to == ${nodeId}
        REMOVE edge IN w_node_links
    `);

        // Create new edge
        await this.db.query(aql`
      INSERT {
        _from: ${newParentId},
        _to: ${nodeId}
      } INTO w_node_links
    `);

        return true;
    }

    /**
     * Delete node (with optional child reassignment)
     */
    async deleteNode(nodeKey: string, reassignToParent = true): Promise<boolean> {
        const nodeId = `w_nodes/${nodeKey}`;

        if (reassignToParent) {
            const parentEdge = await this.db.query(aql`
        FOR edge IN w_node_links
          FILTER edge._to == ${nodeId}
          RETURN edge
      `);
            const [pEdge] = await parentEdge.all();

            if (pEdge) {
                // Reassign children
                const children = await this.db.query(aql`
          FOR child, edge IN 1..1 OUTBOUND ${nodeId} w_node_links
            RETURN child._id
        `);
                const childIds = await children.all();

                for (const childId of childIds) {
                    await this.db.query(aql`
            INSERT {
              _from: ${pEdge._from},
              _to: ${childId}
            } INTO w_node_links
          `);
                }
            }
        }

        // Delete edges
        await this.db.query(aql`
      FOR edge IN w_node_links
        FILTER edge._to == ${nodeId}
        REMOVE edge IN w_node_links
    `);

        await this.db.query(aql`
      FOR edge IN w_node_links
        FILTER edge._from == ${nodeId}
        REMOVE edge IN w_node_links
    `);

        // Delete node
        await this.db.query(aql`
      REMOVE {_key: ${nodeKey}} IN w_nodes
    `);

        return true;
    }
}

export const warehouseQueries = new WarehouseQueries();
