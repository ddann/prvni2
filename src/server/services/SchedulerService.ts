import cron from 'node-cron';
import { DatabaseService, NewsSource } from './DatabaseService';
import { ScrapingService } from './ScrapingService';
import { SummarizationService } from './SummarizationService';
import { Logger } from '../utils/Logger';

export class SchedulerService {
    private tasks: Map<string, cron.ScheduledTask> = new Map();
    private isRunning = false;

    constructor(
        private databaseService: DatabaseService,
        private scrapingService: ScrapingService,
        private summarizationService: SummarizationService
    ) {}

    public async start(): Promise<void> {
        if (this.isRunning) return;

        Logger.info('⏰ Starting content scanning scheduler...');

        const mainTask = cron.schedule('*/15 * * * *', async () => {
            await this.scanAllSources();
        }, { scheduled: false });

        this.tasks.set('main-scan', mainTask);
        this.tasks.forEach(task => task.start());
        this.isRunning = true;
        
        Logger.info('✅ Scheduler started successfully');
        setTimeout(() => this.scanAllSources(), 5000);
    }

    public async stop(): Promise<void> {
        if (!this.isRunning) return;
        Logger.info('⏹️ Stopping scheduler...');
        this.tasks.forEach(task => task.stop());
        this.tasks.clear();
        this.isRunning = false;
    }

    private async scanAllSources(): Promise<void> {
        try {
            Logger.info('🔄 Starting scheduled scan...');
            const startTime = Date.now();
            const sources = await this.databaseService.getSources(true);
            
            let totalArticles = 0;
            for (const source of sources) {
                try {
                    const articles = await this.scanSingleSource(source);
                    totalArticles += articles;
                } catch (error) {
                    Logger.error(`Failed to scan ${source.name}:`, error);
                }
            }

            const duration = Date.now() - startTime;
            Logger.info(`✅ Scan completed: ${totalArticles} articles processed (${duration}ms)`);
        } catch (error) {
            Logger.error('❌ Error during scheduled scan:', error);
        }
    }

    private async scanSingleSource(source: NewsSource): Promise<number> {
        const startTime = Date.now();
        let articlesProcessed = 0;

        try {
            if (source.lastScanned) {
                const lastScan = new Date(source.lastScanned);
                const nextScan = new Date(lastScan.getTime() + source.scanFrequency * 60 * 1000);
                if (new Date() < nextScan) return 0;
            }

            const articles = await this.scrapingService.scrapeSource(source);
            if (articles.length === 0) return 0;

            const summarizedArticles = await this.summarizationService.summarizeArticles(articles);
            
            for (const article of summarizedArticles) {
                try {
                    const articleId = await this.databaseService.addArticle({
                        sourceId: source.id!,
                        title: article.title,
                        content: article.content,
                        url: article.url,
                        publishedAt: article.publishedAt,
                        summary: article.summary,
                        sentiment: article.sentiment,
                        keywords: article.keywords.join(', ')
                    });
                    if (articleId > 0) articlesProcessed++;
                } catch (error: any) {
                    if (!error.message.includes('UNIQUE constraint')) {
                        Logger.error('Error saving article:', error);
                    }
                }
            }

            await this.databaseService.updateSource(source.id!, {
                lastScanned: new Date().toISOString()
            });

            Logger.info(`📰 Processed ${articlesProcessed} articles from ${source.name}`);
        } catch (error) {
            Logger.error(`❌ Error scanning ${source.name}:`, error);
        }

        return articlesProcessed;
    }
}
