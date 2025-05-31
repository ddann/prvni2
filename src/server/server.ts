import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import dotenv from 'dotenv';
import { DatabaseService } from './services/DatabaseService';
import { ScrapingService } from './services/ScrapingService';
import { SummarizationService } from './services/SummarizationService';
import { SchedulerService } from './services/SchedulerService';
import { Logger } from './utils/Logger';
import { sourceRoutes } from './routes/sourceRoutes';
import { articleRoutes } from './routes/articleRoutes';
import { analyticsRoutes } from './routes/analyticsRoutes';

dotenv.config();

class NewsAggregatorServer {
    private app: express.Application;
    private port: number;
    private databaseService: DatabaseService;
    private scrapingService: ScrapingService;
    private summarizationService: SummarizationService;
    private schedulerService: SchedulerService;

    constructor() {
        this.app = express();
        this.port = parseInt(process.env.PORT || '3001');
        
        this.databaseService = new DatabaseService();
        this.scrapingService = new ScrapingService();
        this.summarizationService = new SummarizationService();
        this.schedulerService = new SchedulerService(
            this.databaseService,
            this.scrapingService,
            this.summarizationService
        );
    }

    public async initialize(): Promise<void> {
        try {
            Logger.info('🚀 Starting Šponar News Aggregator...');
            await this.databaseService.initialize();
            this.configureMiddleware();
            this.configureRoutes();
            await this.schedulerService.start();
            Logger.info('🎉 Server initialization complete');
        } catch (error) {
            Logger.error('❌ Failed to initialize server:', error);
            throw error;
        }
    }

    private configureMiddleware(): void {
        this.app.use(helmet({ contentSecurityPolicy: false }));
        this.app.use(cors({ origin: process.env.NODE_ENV === 'production' ? false : true, credentials: true }));
        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        if (process.env.NODE_ENV === 'production') {
            this.app.use(express.static(path.join(__dirname, '../client/build')));
        }
    }

    private configureRoutes(): void {
        this.app.use('/api/v1/sources', sourceRoutes(this.databaseService, this.scrapingService));
        this.app.use('/api/v1/articles', articleRoutes(this.databaseService));
        this.app.use('/api/v1/analytics', analyticsRoutes(this.databaseService));

        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '1.0.0'
            });
        });

        if (process.env.NODE_ENV === 'production') {
            this.app.get('*', (req, res) => {
                res.sendFile(path.join(__dirname, '../client/build/index.html'));
            });
        }

        this.app.use('*', (req, res) => res.status(404).json({ error: 'Route not found' }));
        this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
            Logger.error('Unhandled error:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    public async start(): Promise<void> {
        await this.initialize();
        this.app.listen(this.port, () => {
            Logger.info(`🌐 Server running on port ${this.port}`);
            Logger.info(`📊 Dashboard: http://localhost:${this.port}`);
            Logger.info(`🔗 API: http://localhost:${this.port}/api/v1`);
        });
    }
}

const server = new NewsAggregatorServer();
server.start().catch(error => {
    Logger.error('❌ Failed to start server:', error);
    process.exit(1);
});
