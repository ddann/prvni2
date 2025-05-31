import express from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { Logger } from '../utils/Logger';

export function articleRoutes(databaseService: DatabaseService): express.Router {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const { page = 1, limit = 20, sourceId, since, orderBy = 'publishedAt', order = 'DESC' } = req.query;
            const pageNum = Math.max(1, parseInt(page as string));
            const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
            const offset = (pageNum - 1) * limitNum;

            const options = {
                limit: limitNum, offset,
                sourceId: sourceId ? parseInt(sourceId as string) : undefined,
                since: since as string,
                orderBy: orderBy as string,
                order: order as string
            };

            const result = await databaseService.getArticles(options);
            res.json({
                success: true,
                data: result.articles,
                pagination: {
                    page: pageNum, limit: limitNum, total: result.total,
                    totalPages: Math.ceil(result.total / limitNum)
                }
            });
        } catch (error) {
            Logger.error('Error fetching articles:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch articles' });
        }
    });

    router.get('/latest', async (req, res) => {
        try {
            const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
            const result = await databaseService.getArticles({ limit, orderBy: 'publishedAt', order: 'DESC' });
            
            const articlesBySource = result.articles.reduce((acc: any, article: any) => {
                const key = `${article.sourceId}-${article.sourceName}`;
                if (!acc[key]) {
                    acc[key] = {
                        sourceId: article.sourceId,
                        sourceName: article.sourceName,
                        sourceType: article.sourceType,
                        articles: []
                    };
                }
                acc[key].articles.push(article);
                return acc;
            }, {});

            res.json({
                success: true,
                data: {
                    totalArticles: result.total,
                    sources: Object.values(articlesBySource),
                    latestArticles: result.articles
                }
            });
        } catch (error) {
            Logger.error('Error fetching latest articles:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch latest articles' });
        }
    });

    return router;
}
