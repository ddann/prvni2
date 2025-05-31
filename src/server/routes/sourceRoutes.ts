import express from 'express';
import { DatabaseService, NewsSource } from '../services/DatabaseService';
import { ScrapingService } from '../services/ScrapingService';
import { Logger } from '../utils/Logger';

export function sourceRoutes(databaseService: DatabaseService, scrapingService: ScrapingService): express.Router {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const activeOnly = req.query.active === 'true';
            const sources = await databaseService.getSources(activeOnly);
            res.json({ success: true, data: sources, count: sources.length });
        } catch (error) {
            Logger.error('Error fetching sources:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch sources' });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const { name, url, type, scanFrequency = 30, maxResults = 3 } = req.body;
            
            if (!name || !url || !type) {
                return res.status(400).json({ success: false, error: 'Name, URL, and type are required' });
            }

            if (!['website', 'twitter', 'facebook'].includes(type)) {
                return res.status(400).json({ success: false, error: 'Invalid type' });
            }

            try { new URL(url); } catch { 
                return res.status(400).json({ success: false, error: 'Invalid URL' }); 
            }

            const sourceData = {
                name, url, type, isActive: true,
                scanFrequency: Math.max(5, scanFrequency),
                maxResults: Math.min(10, Math.max(1, maxResults))
            };

            const sourceId = await databaseService.addSource(sourceData);
            res.status(201).json({ success: true, data: { id: sourceId, ...sourceData } });
        } catch (error: any) {
            Logger.error('Error adding source:', error);
            if (error.message.includes('UNIQUE constraint')) {
                res.status(409).json({ success: false, error: 'URL already exists' });
            } else {
                res.status(500).json({ success: false, error: 'Failed to add source' });
            }
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const sourceId = parseInt(req.params.id);
            const updates = req.body;
            delete updates.id; delete updates.createdAt; delete updates.updatedAt;
            
            if (updates.scanFrequency) updates.scanFrequency = Math.max(5, updates.scanFrequency);
            if (updates.maxResults) updates.maxResults = Math.min(10, Math.max(1, updates.maxResults));

            await databaseService.updateSource(sourceId, updates);
            res.json({ success: true, message: 'Source updated' });
        } catch (error) {
            Logger.error('Error updating source:', error);
            res.status(500).json({ success: false, error: 'Failed to update source' });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const sourceId = parseInt(req.params.id);
            await databaseService.deleteSource(sourceId);
            res.json({ success: true, message: 'Source deleted' });
        } catch (error) {
            Logger.error('Error deleting source:', error);
            res.status(500).json({ success: false, error: 'Failed to delete source' });
        }
    });

    router.post('/:id/test', async (req, res) => {
        try {
            const sourceId = parseInt(req.params.id);
            const sources = await databaseService.getSources();
            const source = sources.find(s => s.id === sourceId);

            if (!source) {
                return res.status(404).json({ success: false, error: 'Source not found' });
            }

            const articles = await scrapingService.scrapeSource(source);
            res.json({
                success: true,
                data: {
                    articlesFound: articles.length,
                    sampleArticles: articles.slice(0, 2).map(a => ({
                        title: a.title,
                        url: a.url,
                        contentPreview: a.content.substring(0, 200) + '...'
                    }))
                }
            });
        } catch (error) {
            Logger.error('Error testing source:', error);
            res.status(500).json({ success: false, error: 'Test failed: ' + (error as Error).message });
        }
    });

    return router;
}
