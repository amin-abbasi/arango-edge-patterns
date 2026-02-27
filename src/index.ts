import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { initializeDatabase, seedDatabase } from './db.js';
import { categoryQueries } from './queries/categories.js';
import { warehouseQueries } from './queries/warehouse.js';
import { logger } from './utils/logger.js';

const app: Express = express();
const PORT = process.env.PORT || 6000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error(err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
        timestamp: new Date().toISOString(),
    });
});

// ============================================
// HEALTH & INFO
// ============================================

app.get('/api/health', async (req: Request, res: Response) => {
    try {
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// ============================================
// CATEGORY ENDPOINTS
// ============================================

// GET /api/categories - List all categories
app.get('/api/categories', async (req: Request, res: Response) => {
    try {
        const categories = await categoryQueries.listCategories();
        res.json({
            success: true,
            data: categories,
            count: categories.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new String(),
        });
    }
});

// GET /api/categories/roots - Get root categories
app.get('/api/categories/roots', async (req: Request, res: Response) => {
    try {
        const roots = await categoryQueries.getRootCategories();
        res.json({
            success: true,
            data: roots,
            count: roots.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// GET /api/categories/:id - Get specific category
app.get('/api/categories/:id', async (req: Request, res: Response) => {
    try {
        const category = await categoryQueries.getCategory(req.params.id);
        if (!category) {
            return res.status(404).json({
                success: false,
                error: 'Category not found',
                timestamp: new Date().toISOString(),
            });
        }
        res.json({
            success: true,
            data: category,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// GET /api/categories/:id/children - Get direct children
app.get('/api/categories/:id/children', async (req: Request, res: Response) => {
    try {
        const children = await categoryQueries.getDirectChildren(req.params.id);
        res.json({
            success: true,
            data: children,
            count: children.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// GET /api/categories/:id/descendants - Get all descendants
app.get('/api/categories/:id/descendants', async (req: Request, res: Response) => {
    try {
        const maxDepth = req.query.depth ? parseInt(req.query.depth as string) : 100;
        const descendants = await categoryQueries.getDescendants(req.params.id, maxDepth);
        res.json({
            success: true,
            data: descendants,
            count: descendants.length,
            depth: maxDepth,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// GET /api/categories/:id/ancestors - Get all ancestors
app.get('/api/categories/:id/ancestors', async (req: Request, res: Response) => {
    try {
        const ancestors = await categoryQueries.getAncestors(req.params.id);
        res.json({
            success: true,
            data: ancestors,
            count: ancestors.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// GET /api/categories/:id/stats - GetCategory stats
app.get('/api/categories/stats', async (req: Request, res: Response) => {
    try {
        const stats = await categoryQueries.getCategoryStats();
        res.json({
            success: true,
            data: stats,
            count: stats.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// POST /api/categories - Create category
app.post('/api/categories', async (req: Request, res: Response) => {
    try {
        const { key, name, code, parentId, containParts } = req.body;
        if (!key || !name || !code) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: key, name, code',
                timestamp: new Date().toISOString(),
            });
        }
        const category = await categoryQueries.createCategory(key, name, code, parentId, containParts || false);
        res.status(201).json({
            success: true,
            data: category,
            message: 'Category created',
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// DELETE /api/categories/:id - Delete category
app.delete('/api/categories/:id', async (req: Request, res: Response) => {
    try {
        const result = await categoryQueries.cascadeDelete(req.params.id);
        res.json({
            success: true,
            data: result,
            message: 'Category deleted with cascade',
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// ============================================
// WAREHOUSE ENDPOINTS
// ============================================

// GET /api/warehouse/storages - List all storages
app.get('/api/warehouse/storages', async (req: Request, res: Response) => {
    try {
        const storages = await warehouseQueries.listStorages();
        res.json({
            success: true,
            data: storages,
            count: storages.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// GET /api/warehouse/nodes/:id - Get node details
app.get('/api/warehouse/nodes/:id', async (req: Request, res: Response) => {
    try {
        const node = await warehouseQueries.getNode(req.params.id);
        if (!node) {
            return res.status(404).json({
                success: false,
                error: 'Node not found',
                timestamp: new Date().toISOString(),
            });
        }
        res.json({
            success: true,
            data: node,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// GET /api/warehouse/nodes/:id/children - Get direct children
app.get('/api/warehouse/nodes/:id/children', async (req: Request, res: Response) => {
    try {
        const children = await warehouseQueries.getDirectChildren(req.params.id);
        res.json({
            success: true,
            data: children,
            count: children.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// GET /api/warehouse/nodes/:id/capacity - Get capacity info
app.get('/api/warehouse/nodes/:id/capacity', async (req: Request, res: Response) => {
    try {
        const capacity = await warehouseQueries.getNodeCapacity(req.params.id);
        if (!capacity) {
            return res.status(404).json({
                success: false,
                error: 'Node not found',
                timestamp: new Date().toISOString(),
            });
        }
        res.json({
            success: true,
            data: capacity,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// GET /api/warehouse/nodes/:id/containers - Get containers in node
app.get('/api/warehouse/nodes/:id/containers', async (req: Request, res: Response) => {
    try {
        const containers = await warehouseQueries.getNodeWithContainers(req.params.id);
        if (!containers) {
            return res.status(404).json({
                success: false,
                error: 'Node not found',
                timestamp: new Date().toISOString(),
            });
        }
        res.json({
            success: true,
            data: containers,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// GET /api/warehouse/nodes/:id/ancestors - Get ancestor path
app.get('/api/warehouse/nodes/:id/ancestors', async (req: Request, res: Response) => {
    try {
        const ancestors = await warehouseQueries.getAncestors(req.params.id);
        res.json({
            success: true,
            data: ancestors,
            count: ancestors.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

// GET /api/warehouse/nodes/:id/empty - Find empty locations
app.get('/api/warehouse/nodes/empty', async (req: Request, res: Response) => {
    try {
        const empty = await warehouseQueries.findEmptyLocations();
        res.json({
            success: true,
            data: empty,
            count: empty.length,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

export async function startServer() {
    try {
        // Initialize database and seed if neededWait
        await initializeDatabase();

        if (process.env.SEED_DB === 'true') {
            await seedDatabase();
        }

        app.listen(PORT, () => {
            logger.info(`✨ Server running on http://localhost:${PORT}`);
            logger.info('📚 API Documentation:');
            logger.info('   Categories: GET /api/categories');
            logger.info('   Warehouse: GET /api/warehouse/storages');
            logger.info('   Health: GET /api/health');
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

export default app;
