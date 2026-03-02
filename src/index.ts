import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { initializeDatabase, seedDatabase } from './db.js';
import { categoryQueries } from './queries/categories.js';
import { warehouseQueries } from './queries/warehouse.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 6000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// ============================================
// RESPONSE HELPERS
// ============================================

function sendSuccess(res: Response, data: unknown, extras?: Record<string, unknown>) {
    res.json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
        ...extras,
    });
}

function sendCreated(res: Response, data: unknown, message: string) {
    res.status(201).json({
        success: true,
        data,
        message,
        timestamp: new Date().toISOString(),
    });
}

function sendNotFound(res: Response, message: string) {
    res.status(404).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
    });
}

function sendError(res: Response, error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
    });
}

// ============================================
// HEALTH & INFO
// ============================================

app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
    });
});

// ============================================
// ITEM CATEGORY ENDPOINTS
// ============================================

app.get('/api/categories', async (_req: Request, res: Response) => {
    try {
        const categories = await categoryQueries.listCategories();
        sendSuccess(res, categories, { count: categories.length });
    } catch (error) {
        sendError(res, error);
    }
});

app.get('/api/categories/roots', async (_req: Request, res: Response) => {
    try {
        const roots = await categoryQueries.getRootCategories();
        sendSuccess(res, roots, { count: roots.length });
    } catch (error) {
        sendError(res, error);
    }
});

app.get('/api/categories/stats', async (_req: Request, res: Response) => {
    try {
        const stats = await categoryQueries.getCategoryStats();
        sendSuccess(res, stats, { count: stats.length });
    } catch (error) {
        sendError(res, error);
    }
});

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
        sendCreated(res, category, 'Category created');
    } catch (error) {
        sendError(res, error);
    }
});

// Parameterized routes come after static routes

app.get('/api/categories/:id', async (req: Request, res: Response) => {
    try {
        const category = await categoryQueries.getCategory(req.params.id);
        if (!category) {
            return sendNotFound(res, 'Category not found');
        }
        sendSuccess(res, category);
    } catch (error) {
        sendError(res, error);
    }
});

app.get('/api/categories/:id/children', async (req: Request, res: Response) => {
    try {
        const children = await categoryQueries.getDirectChildren(req.params.id);
        sendSuccess(res, children, { count: children.length });
    } catch (error) {
        sendError(res, error);
    }
});

app.get('/api/categories/:id/descendants', async (req: Request, res: Response) => {
    try {
        const maxDepth = req.query.depth ? parseInt(req.query.depth as string) : 100;
        const descendants = await categoryQueries.getDescendants(req.params.id, maxDepth);
        sendSuccess(res, descendants, { count: descendants.length, depth: maxDepth });
    } catch (error) {
        sendError(res, error);
    }
});

app.get('/api/categories/:id/ancestors', async (req: Request, res: Response) => {
    try {
        const ancestors = await categoryQueries.getAncestors(req.params.id);
        sendSuccess(res, ancestors, { count: ancestors.length });
    } catch (error) {
        sendError(res, error);
    }
});

app.delete('/api/categories/:id', async (req: Request, res: Response) => {
    try {
        const result = await categoryQueries.cascadeDelete(req.params.id);
        sendSuccess(res, result, { message: 'Category deleted with cascade' });
    } catch (error) {
        sendError(res, error);
    }
});

// ============================================
// WAREHOUSE ENDPOINTS
// ============================================

// Static routes first

app.get('/api/warehouse/storages', async (_req: Request, res: Response) => {
    try {
        const storages = await warehouseQueries.listStorages();
        sendSuccess(res, storages, { count: storages.length });
    } catch (error) {
        sendError(res, error);
    }
});

app.get('/api/warehouse/nodes/empty', async (_req: Request, res: Response) => {
    try {
        const empty = await warehouseQueries.findEmptyLocations();
        sendSuccess(res, empty, { count: empty.length });
    } catch (error) {
        sendError(res, error);
    }
});

// Parameterized routes

app.get('/api/warehouse/nodes/:id', async (req: Request, res: Response) => {
    try {
        const node = await warehouseQueries.getNode(req.params.id);
        if (!node) {
            return sendNotFound(res, 'Node not found');
        }
        sendSuccess(res, node);
    } catch (error) {
        sendError(res, error);
    }
});

app.get('/api/warehouse/nodes/:id/children', async (req: Request, res: Response) => {
    try {
        const children = await warehouseQueries.getDirectChildren(req.params.id);
        sendSuccess(res, children, { count: children.length });
    } catch (error) {
        sendError(res, error);
    }
});

app.get('/api/warehouse/nodes/:id/capacity', async (req: Request, res: Response) => {
    try {
        const capacity = await warehouseQueries.getNodeCapacity(req.params.id);
        if (!capacity) {
            return sendNotFound(res, 'Node not found');
        }
        sendSuccess(res, capacity);
    } catch (error) {
        sendError(res, error);
    }
});

app.get('/api/warehouse/nodes/:id/containers', async (req: Request, res: Response) => {
    try {
        const containers = await warehouseQueries.getNodeWithContainers(req.params.id);
        if (!containers) {
            return sendNotFound(res, 'Node not found');
        }
        sendSuccess(res, containers);
    } catch (error) {
        sendError(res, error);
    }
});

app.get('/api/warehouse/nodes/:id/ancestors', async (req: Request, res: Response) => {
    try {
        const ancestors = await warehouseQueries.getAncestors(req.params.id);
        sendSuccess(res, ancestors, { count: ancestors.length });
    } catch (error) {
        sendError(res, error);
    }
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
        timestamp: new Date().toISOString(),
    });
});

// ============================================
// SERVER STARTUP
// ============================================
export async function startServer() {
    try {
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
