import express from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { Logger } from '../utils/Logger';

export function analyticsRoutes(databaseService: DatabaseService): express.Router {
    const router = express.Router();

    router.get('/summary', async (req, res) => {
        try {
            const db = (databaseService as any).db;
            const { promisify } = require('util');
            const get = promisify(db.get.bind(db));
            
            const summaryData = await get(`
                SELECT 
                    COUNT(DISTINCT s.id) as totalSources,
                    COUNT(DISTINCT CASE WHEN s.isActive = 1 THEN s.id END) as activeSources,
                    COUNT(a.id) as totalArticles,
                    COUNT(CASE WHEN a.createdAt >= datetime('now', '-1 day') THEN a.id END) as articlesToday,
                    COUNT(CASE WHEN a.createdAt >= datetime('now', '-7 days') THEN a.id END) as articlesThisWeek
                FROM sources s
                LEFT JOIN articles a ON s.id = a.sourceId
            `);

            res.json({ success: true, data: summaryData });
        } catch (error) {
            Logger.error('Error fetching summary:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch summary' });
        }
    });

    return router;
}
