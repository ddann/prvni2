// FILE: package.json
// Main application dependencies and scripts
{
  "name": "sponar-news-aggregator",
  "version": "1.0.0",
  "description": "AI-powered news aggregation platform for Šponar hot news s.r.o.",
  "main": "dist/server.js",
  "scripts": {
    "start": "node dist/server.js",
    "dev": "concurrently \"npm run server:dev\" \"npm run client:dev\"",
    "server:dev": "nodemon --exec ts-node src/server/server.ts",
    "client:dev": "cd src/client && npm start",
    "build": "npm run build:server && npm run build:client",
    "build:server": "tsc -p tsconfig.server.json",
    "build:client": "cd src/client && npm run build",
    "install:all": "npm install && cd src/client && npm install"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "sqlite3": "^5.1.6",
    "puppeteer": "^21.5.2",
    "cheerio": "^1.0.0-rc.12",
    "axios": "^1.6.2",
    "openai": "^4.28.0",
    "node-cron": "^3.0.3",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1",
    "date-fns": "^2.30.0",
    "sanitize-html": "^2.11.0",
    "rate-limiter-flexible": "^4.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.4",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/compression": "^1.7.5",
    "@types/node-cron": "^3.0.11",
    "@types/sanitize-html": "^2.9.5",
    "typescript": "^5.3.3",
    "nodemon": "^3.0.2",
    "ts-node": "^10.9.1",
    "concurrently": "^8.2.2"
  }
}

// FILE: tsconfig.server.json
// TypeScript configuration for server-side code
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src/server",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/server/**/*"],
  "exclude": ["node_modules", "dist", "src/client"]
}

// FILE: .env.example
// Environment variables template - rename to .env and fill in your values
NODE_ENV=development
PORT=3001
DATABASE_PATH=./data/news.db
OPENAI_API_KEY=your-openai-api-key-here
TWITTER_BEARER_TOKEN=your-twitter-bearer-token-here
FACEBOOK_ACCESS_TOKEN=your-facebook-access-token-here
LOG_LEVEL=info
MAX_SOURCES_PER_USER=50
SCAN_INTERVAL_MINUTES=30

// FILE: src/server/server.ts
// Main server application - the heart of our news aggregation platform
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

// Load environment variables from .env file
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
        
        // Initialize core services
        this.databaseService = new DatabaseService();
        this.scrapingService = new ScrapingService();
        this.summarizationService = new SummarizationService();
        this.schedulerService = new SchedulerService(
            this.databaseService,
            this.scrapingService,
            this.summarizationService
        );
    }

    /**
     * Initialize the server and all its services
     * This sets up the database, configures middleware, and starts background tasks
     */
    public async initialize(): Promise<void> {
        try {
            Logger.info('🚀 Starting Šponar News Aggregator...');

            // Initialize database and create tables
            await this.databaseService.initialize();
            Logger.info('✅ Database initialized');

            // Configure Express middleware
            this.configureMiddleware();
            
            // Set up API routes
            this.configureRoutes();

            // Start the background scanning scheduler
            await this.schedulerService.start();
            Logger.info('✅ Background scanner started');

            Logger.info('🎉 Server initialization complete');
        } catch (error) {
            Logger.error('❌ Failed to initialize server:', error);
            throw error;
        }
    }

    /**
     * Configure Express middleware for security, performance, and functionality
     */
    private configureMiddleware(): void {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                }
            }
        }));

        // Enable CORS for frontend communication
        this.app.use(cors({
            origin: process.env.NODE_ENV === 'production' 
                ? ['https://sponar-news.com'] // Replace with your actual domain
                : ['http://localhost:3000'],
            credentials: true
        }));

        // Performance middleware
        this.app.use(compression());
        
        // Parse JSON requests
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Serve static files in production
        if (process.env.NODE_ENV === 'production') {
            this.app.use(express.static(path.join(__dirname, '../client/build')));
        }

        // Request logging middleware
        this.app.use((req, res, next) => {
            Logger.info(`${req.method} ${req.path} - ${req.ip}`);
            next();
        });
    }

    /**
     * Configure API routes for different functionalities
     */
    private configureRoutes(): void {
        // API routes with version prefix
        this.app.use('/api/v1/sources', sourceRoutes(this.databaseService, this.scrapingService));
        this.app.use('/api/v1/articles', articleRoutes(this.databaseService));
        this.app.use('/api/v1/analytics', analyticsRoutes(this.databaseService));

        // Health check endpoint
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '1.0.0'
            });
        });

        // Serve React app for all other routes in production
        if (process.env.NODE_ENV === 'production') {
            this.app.get('*', (req, res) => {
                res.sendFile(path.join(__dirname, '../client/build/index.html'));
            });
        }

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({ error: 'Route not found' });
        });

        // Global error handler
        this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
            Logger.error('Unhandled error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        });
    }

    /**
     * Start the server and listen for connections
     */
    public async start(): Promise<void> {
        await this.initialize();
        
        this.app.listen(this.port, () => {
            Logger.info(`🌐 Server running on port ${this.port}`);
            Logger.info(`📊 Dashboard available at http://localhost:${this.port}`);
            Logger.info(`🔗 API available at http://localhost:${this.port}/api/v1`);
        });
    }

    /**
     * Gracefully shut down the server and clean up resources
     */
    public async shutdown(): Promise<void> {
        Logger.info('🛑 Shutting down server...');
        
        try {
            await this.schedulerService.stop();
            await this.databaseService.close();
            Logger.info('✅ Server shutdown complete');
        } catch (error) {
            Logger.error('❌ Error during shutdown:', error);
        }
    }
}

// Handle graceful shutdown
const server = new NewsAggregatorServer();

process.on('SIGTERM', async () => {
    await server.shutdown();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await server.shutdown();
    process.exit(0);
});

// Start the server
server.start().catch((error) => {
    Logger.error('❌ Failed to start server:', error);
    process.exit(1);
});

// FILE: src/server/services/DatabaseService.ts
// Database service for managing news sources, articles, and summaries
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { Logger } from '../utils/Logger';

// Type definitions for our data models
export interface NewsSource {
    id?: number;
    name: string;
    url: string;
    type: 'website' | 'twitter' | 'facebook';
    isActive: boolean;
    lastScanned?: string;
    scanFrequency: number; // minutes
    maxResults: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface Article {
    id?: number;
    sourceId: number;
    title: string;
    content: string;
    url: string;
    publishedAt: string;
    summary?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    keywords?: string;
    createdAt?: string;
}

export interface ScanResult {
    id?: number;
    sourceId: number;
    articlesFound: number;
    articlesProcessed: number;
    errors?: string;
    scanDuration: number; // milliseconds
    createdAt?: string;
}

export class DatabaseService {
    private db: sqlite3.Database | null = null;
    private dbPath: string;

    constructor() {
        this.dbPath = process.env.DATABASE_PATH || './data/news.db';
        
        // Ensure data directory exists
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    /**
     * Initialize database connection and create tables if they don't exist
     */
    public async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    Logger.error('Error opening database:', err);
                    reject(err);
                    return;
                }

                Logger.info(`📦 Database connected: ${this.dbPath}`);
                this.createTables()
                    .then(() => resolve())
                    .catch(reject);
            });
        });
    }

    /**
     * Create database tables with proper schema
     */
    private async createTables(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const run = promisify(this.db.run.bind(this.db));

        // News sources table
        await run(`
            CREATE TABLE IF NOT EXISTS sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                url TEXT NOT NULL UNIQUE,
                type TEXT NOT NULL CHECK (type IN ('website', 'twitter', 'facebook')),
                isActive BOOLEAN DEFAULT 1,
                lastScanned DATETIME,
                scanFrequency INTEGER DEFAULT 30,
                maxResults INTEGER DEFAULT 3,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Articles table
        await run(`
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sourceId INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                url TEXT NOT NULL UNIQUE,
                publishedAt DATETIME NOT NULL,
                summary TEXT,
                sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
                keywords TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sourceId) REFERENCES sources (id) ON DELETE CASCADE
            )
        `);

        // Scan results table for monitoring and analytics
        await run(`
            CREATE TABLE IF NOT EXISTS scan_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sourceId INTEGER NOT NULL,
                articlesFound INTEGER DEFAULT 0,
                articlesProcessed INTEGER DEFAULT 0,
                errors TEXT,
                scanDuration INTEGER DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sourceId) REFERENCES sources (id) ON DELETE CASCADE
            )
        `);

        // Create indexes for better performance
        await run(`CREATE INDEX IF NOT EXISTS idx_articles_published ON articles (publishedAt DESC)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_articles_source ON articles (sourceId)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_sources_active ON sources (isActive)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_scan_results_created ON scan_results (createdAt DESC)`);

        Logger.info('✅ Database tables created/verified');
    }

    /**
     * Add a new news source to monitor
     */
    public async addSource(source: Omit<NewsSource, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');

        const run = promisify(this.db.run.bind(this.db));
        
        const result = await run(`
            INSERT INTO sources (name, url, type, isActive, scanFrequency, maxResults)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [source.name, source.url, source.type, source.isActive, source.scanFrequency, source.maxResults]);

        Logger.info(`📰 Added new source: ${source.name} (${source.url})`);
        return result.lastID!;
    }

    /**
     * Get all news sources, optionally filtered by active status
     */
    public async getSources(activeOnly = false): Promise<NewsSource[]> {
        if (!this.db) throw new Error('Database not initialized');

        const all = promisify(this.db.all.bind(this.db));
        
        const query = activeOnly 
            ? 'SELECT * FROM sources WHERE isActive = 1 ORDER BY name'
            : 'SELECT * FROM sources ORDER BY name';
            
        return await all(query);
    }

    /**
     * Update a news source
     */
    public async updateSource(id: number, updates: Partial<NewsSource>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const run = promisify(this.db.run.bind(this.db));
        
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        
        await run(`
            UPDATE sources 
            SET ${fields}, updatedAt = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [...values, id]);

        Logger.info(`📝 Updated source ${id}`);
    }

    /**
     * Delete a news source and all its articles
     */
    public async deleteSource(id: number): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const run = promisify(this.db.run.bind(this.db));
        
        await run('DELETE FROM sources WHERE id = ?', [id]);
        Logger.info(`🗑️ Deleted source ${id}`);
    }

    /**
     * Add a new article
     */
    public async addArticle(article: Omit<Article, 'id' | 'createdAt'>): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');

        const run = promisify(this.db.run.bind(this.db));
        
        try {
            const result = await run(`
                INSERT INTO articles (sourceId, title, content, url, publishedAt, summary, sentiment, keywords)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                article.sourceId,
                article.title,
                article.content,
                article.url,
                article.publishedAt,
                article.summary,
                article.sentiment,
                article.keywords
            ]);

            return result.lastID!;
        } catch (error: any) {
            // Handle duplicate URL constraint
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                Logger.debug(`Article already exists: ${article.url}`);
                return -1; // Indicate duplicate
            }
            throw error;
        }
    }

    /**
     * Get articles with pagination and filtering
     */
    public async getArticles(options: {
        limit?: number;
        offset?: number;
        sourceId?: number;
        since?: string;
        orderBy?: 'publishedAt' | 'createdAt';
        order?: 'ASC' | 'DESC';
    } = {}): Promise<{ articles: Article[]; total: number }> {
        if (!this.db) throw new Error('Database not initialized');

        const all = promisify(this.db.all.bind(this.db));
        const get = promisify(this.db.get.bind(this.db));

        const {
            limit = 50,
            offset = 0,
            sourceId,
            since,
            orderBy = 'publishedAt',
            order = 'DESC'
        } = options;

        // Build WHERE clause
        const conditions: string[] = [];
        const params: any[] = [];

        if (sourceId) {
            conditions.push('a.sourceId = ?');
            params.push(sourceId);
        }

        if (since) {
            conditions.push('a.publishedAt >= ?');
            params.push(since);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM articles a 
            ${whereClause}
        `;
        const countResult = await get(countQuery, params);
        const total = countResult.total;

        // Get articles with source information
        const articlesQuery = `
            SELECT 
                a.*,
                s.name as sourceName,
                s.type as sourceType
            FROM articles a
            JOIN sources s ON a.sourceId = s.id
            ${whereClause}
            ORDER BY a.${orderBy} ${order}
            LIMIT ? OFFSET ?
        `;

        const articles = await all(articlesQuery, [...params, limit, offset]);

        return { articles, total };
    }

    /**
     * Record scan results for monitoring
     */
    public async recordScanResult(result: Omit<ScanResult, 'id' | 'createdAt'>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const run = promisify(this.db.run.bind(this.db));
        
        await run(`
            INSERT INTO scan_results (sourceId, articlesFound, articlesProcessed, errors, scanDuration)
            VALUES (?, ?, ?, ?, ?)
        `, [result.sourceId, result.articlesFound, result.articlesProcessed, result.errors, result.scanDuration]);
    }

    /**
     * Get analytics data for dashboard
     */
    public async getAnalytics(days = 7): Promise<any> {
        if (!this.db) throw new Error('Database not initialized');

        const all = promisify(this.db.all.bind(this.db));
        const get = promisify(this.db.get.bind(this.db));

        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        // Articles per day
        const articlesPerDay = await all(`
            SELECT 
                DATE(publishedAt) as date,
                COUNT(*) as count
            FROM articles 
            WHERE publishedAt >= ?
            GROUP BY DATE(publishedAt)
            ORDER BY date DESC
        `, [since]);

        // Articles by source
        const articlesBySource = await all(`
            SELECT 
                s.name,
                s.type,
                COUNT(a.id) as articleCount
            FROM sources s
            LEFT JOIN articles a ON s.id = a.sourceId AND a.publishedAt >= ?
            GROUP BY s.id, s.name, s.type
            ORDER BY articleCount DESC
        `, [since]);

        // Total stats
        const totalStats = await get(`
            SELECT 
                COUNT(DISTINCT s.id) as totalSources,
                COUNT(a.id) as totalArticles,
                COUNT(CASE WHEN a.summary IS NOT NULL THEN 1 END) as summarizedArticles
            FROM sources s
            LEFT JOIN articles a ON s.id = a.sourceId AND a.publishedAt >= ?
        `, [since]);

        return {
            period: `${days} days`,
            articlesPerDay,
            articlesBySource,
            totalStats
        };
    }

    /**
     * Close database connection
     */
    public async close(): Promise<void> {
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db!.close((err) => {
                    if (err) {
                        Logger.error('Error closing database:', err);
                        reject(err);
                    } else {
                        Logger.info('📦 Database connection closed');
                        resolve();
                    }
                });
            });
        }
    }
}

// FILE: src/server/services/ScrapingService.ts
// Web scraping service for extracting content from various sources
import puppeteer, { Browser, Page } from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger } from '../utils/Logger';
import sanitizeHtml from 'sanitize-html';
import { NewsSource } from './DatabaseService';

export interface ScrapedArticle {
    title: string;
    content: string;
    url: string;
    publishedAt: string;
    author?: string;
}

export class ScrapingService {
    private browser: Browser | null = null;
    private twitterBearerToken: string;
    private facebookAccessToken: string;

    constructor() {
        this.twitterBearerToken = process.env.TWITTER_BEARER_TOKEN || '';
        this.facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN || '';
    }

    /**
     * Initialize Puppeteer browser for JavaScript-heavy sites
     */
    private async initializeBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920x1080'
                ]
            });
            Logger.info('🌐 Browser initialized for scraping');
        }
        return this.browser;
    }

    /**
     * Main method to scrape content from a news source
     */
    public async scrapeSource(source: NewsSource): Promise<ScrapedArticle[]> {
        const startTime = Date.now();
        Logger.info(`🔍 Starting to scrape: ${source.name} (${source.type})`);

        try {
            let articles: ScrapedArticle[] = [];

            switch (source.type) {
                case 'website':
                    articles = await this.scrapeWebsite(source);
                    break;
                case 'twitter':
                    articles = await this.scrapeTwitter(source);
                    break;
                case 'facebook':
                    articles = await this.scrapeFacebook(source);
                    break;
                default:
                    throw new Error(`Unsupported source type: ${source.type}`);
            }

            const duration = Date.now() - startTime;
            Logger.info(`✅ Scraped ${articles.length} articles from ${source.name} in ${duration}ms`);

            return articles.slice(0, source.maxResults); // Limit results as configured
        } catch (error) {
            Logger.error(`❌ Error scraping ${source.name}:`, error);
            throw error;
        }
    }

    /**
     * Scrape content from regular websites (press releases, blogs)
     */
    private async scrapeWebsite(source: NewsSource): Promise<ScrapedArticle[]> {
        try {
            // First try with simple HTTP request
            const response = await axios.get(source.url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                }
            });

            const $ = cheerio.load(response.data);
            
            // Try to detect if this is a JavaScript-heavy site
            const jsDetection = $('script').length > 10 || $('.loading').length > 0 || $('#root').length > 0;
            
            if (jsDetection) {
                Logger.info(`🔄 ${source.name} appears to be JavaScript-heavy, using browser scraping`);
                return await this.scrapeWithBrowser(source);
            }

            return await this.extractArticlesFromHtml($, source);
        } catch (error) {
            Logger.warn(`⚠️ HTTP scraping failed for ${source.name}, trying browser scraping:`, error);
            return await this.scrapeWithBrowser(source);
        }
    }

    /**
     * Scrape using Puppeteer for JavaScript-heavy sites
     */
    private async scrapeWithBrowser(source: NewsSource): Promise<ScrapedArticle[]> {
        const browser = await this.initializeBrowser();
        const page = await browser.newPage();

        try {
            // Set user agent and viewport
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            await page.setViewport({ width: 1920, height: 1080 });

            // Navigate to the page
            await page.goto(source.url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Wait for content to load
            await page.waitForTimeout(3000);

            // Get the page content
            const content = await page.content();
            const $ = cheerio.load(content);

            return await this.extractArticlesFromHtml($, source);
        } finally {
            await page.close();
        }
    }

    /**
     * Extract articles from HTML using Cheerio
     * This method uses heuristics to identify article content
     */
    private async extractArticlesFromHtml($: cheerio.CheerioAPI, source: NewsSource): Promise<ScrapedArticle[]> {
        const articles: ScrapedArticle[] = [];

        // Common selectors for articles/posts
        const articleSelectors = [
            'article',
            '.post',
            '.news-item',
            '.press-release',
            '.blog-post',
            '[class*="article"]',
            '[class*="post"]',
            '[class*="news"]'
        ];

        let foundElements = $();
        for (const selector of articleSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                foundElements = elements;
                break;
            }
        }

        // If no specific article elements found, look for common content structures
        if (foundElements.length === 0) {
            foundElements = $('main, .content, .main-content, #content').find('h1, h2, h3').parent();
        }

        foundElements.each((index, element) => {
            if (articles.length >= source.maxResults) return false;

            try {
                const $element = $(element);
                
                // Extract title
                const title = this.extractTitle($element);
                if (!title) return; // Skip if no title found

                // Extract content
                const content = this.extractContent($element);
                if (!content || content.length < 100) return; // Skip short content

                // Extract or construct URL
                const url = this.extractUrl($element, source.url);

                // Extract or estimate publish date
                const publishedAt = this.extractPublishDate($element);

                articles.push({
                    title: this.sanitizeText(title),
                    content: this.sanitizeText(content),
                    url,
                    publishedAt
                });
            } catch (error) {
                Logger.warn(`Error extracting article from ${source.name}:`, error);
            }
        });

        return articles;
    }

    /**
     * Extract title from article element using various selectors
     */
    private extractTitle($element: cheerio.Cheerio<cheerio.Element>): string {
        const titleSelectors = [
            'h1', 'h2', 'h3',
            '.title', '.headline', '.post-title',
            '[class*="title"]', '[class*="headline"]'
        ];

        for (const selector of titleSelectors) {
            const titleElement = $element.find(selector).first();
            if (titleElement.length > 0) {
                const title = titleElement.text().trim();
                if (title.length > 10) return title;
            }
        }

        return '';
    }

    /**
     * Extract main content from article element
     */
    private extractContent($element: cheerio.Cheerio<cheerio.Element>): string {
        const contentSelectors = [
            '.content', '.post-content', '.article-content',
            '.description', '.summary', '.excerpt',
            'p', '.text'
        ];

        let content = '';

        for (const selector of contentSelectors) {
            const contentElements = $element.find(selector);
            if (contentElements.length > 0) {
                contentElements.each((index, el) => {
                    const text = cheerio.load(el).text().trim();
                    if (text.length > 50) {
                        content += text + ' ';
                    }
                });
                if (content.length > 200) break;
            }
        }

        // If no specific content found, get all text from element
        if (!content) {
            content = $element.text().trim();
        }

        return content.substring(0, 2000); // Limit content length
    }

    /**
     * Extract or construct article URL
     */
    private extractUrl($element: cheerio.Cheerio<cheerio.Element>, sourceUrl: string): string {
        // Look for links within the article
        const linkSelectors = ['a[href]', '.read-more', '.permalink'];
        
        for (const selector of linkSelectors) {
            const link = $element.find(selector).first();
            if (link.length > 0) {
                const href = link.attr('href');
                if (href) {
                    // Convert relative URLs to absolute
                    if (href.startsWith('http')) {
                        return href;
                    } else if (href.startsWith('/')) {
                        const baseUrl = new URL(sourceUrl);
                        return `${baseUrl.protocol}//${baseUrl.host}${href}`;
                    }
                }
            }
        }

        // Fallback to source URL with timestamp
        return `${sourceUrl}#article-${Date.now()}`;
    }

    /**
     * Extract or estimate publish date
     */
    private extractPublishDate($element: cheerio.Cheerio<cheerio.Element>): string {
        const dateSelectors = [
            'time[datetime]', '.date', '.published', '.post-date',
            '[class*="date"]', '[class*="time"]'
        ];

        for (const selector of dateSelectors) {
            const dateElement = $element.find(selector).first();
            if (dateElement.length > 0) {
                // Check for datetime attribute first
                const datetime = dateElement.attr('datetime');
                if (datetime) {
                    return new Date(datetime).toISOString();
                }

                // Try to parse text content
                const dateText = dateElement.text().trim();
                const parsedDate = this.parseDate(dateText);
                if (parsedDate) {
                    return parsedDate.toISOString();
                }
            }
        }

        // Fallback to current time
        return new Date().toISOString();
    }

    /**
     * Parse various date formats
     */
    private parseDate(dateString: string): Date | null {
        try {
            // Try standard date parsing first
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date;
            }

            // Try common date patterns
            const patterns = [
                /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
                /(\d{1,2})-(\d{1,2})-(\d{4})/, // MM-DD-YYYY
                /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
            ];

            for (const pattern of patterns) {
                const match = dateString.match(pattern);
                if (match) {
                    const [, first, second, third] = match;
                    // Assume YYYY-MM-DD format for the third pattern
                    if (pattern === patterns[2]) {
                        return new Date(`${first}-${second}-${third}`);
                    } else {
                        return new Date(`${third}-${first}-${second}`);
                    }
                }
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Scrape Twitter/X posts using API
     */
    private async scrapeTwitter(source: NewsSource): Promise<ScrapedArticle[]> {
        if (!this.twitterBearerToken) {
            throw new Error('Twitter Bearer Token not configured');
        }

        try {
            // Extract username from URL
            const urlMatch = source.url.match(/twitter\.com\/([^\/]+)/);
            const username = urlMatch ? urlMatch[1] : null;
            
            if (!username) {
                throw new Error('Invalid Twitter URL format');
            }

            // Use Twitter API v2 to get recent tweets
            const response = await axios.get(
                `https://api.twitter.com/2/users/by/username/${username}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.twitterBearerToken}`
                    }
                }
            );

            const userId = response.data.data.id;

            // Get recent tweets
            const tweetsResponse = await axios.get(
                `https://api.twitter.com/2/users/${userId}/tweets`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.twitterBearerToken}`
                    },
                    params: {
                        'max_results': source.maxResults,
                        'tweet.fields': 'created_at,public_metrics,context_annotations'
                    }
                }
            );

            const articles: ScrapedArticle[] = [];
            
            if (tweetsResponse.data.data) {
                for (const tweet of tweetsResponse.data.data) {
                    articles.push({
                        title: `Tweet by @${username}`,
                        content: tweet.text,
                        url: `https://twitter.com/${username}/status/${tweet.id}`,
                        publishedAt: tweet.created_at || new Date().toISOString()
                    });
                }
            }

            return articles;
        } catch (error) {
            Logger.error(`Error scraping Twitter for ${source.name}:`, error);
            throw error;
        }
    }

    /**
     * Scrape Facebook posts using Graph API
     */
    private async scrapeFacebook(source: NewsSource): Promise<ScrapedArticle[]> {
        if (!this.facebookAccessToken) {
            throw new Error('Facebook Access Token not configured');
        }

        try {
            // Extract page ID or handle from URL
            const urlMatch = source.url.match(/facebook\.com\/([^\/\?]+)/);
            const pageIdentifier = urlMatch ? urlMatch[1] : null;
            
            if (!pageIdentifier) {
                throw new Error('Invalid Facebook URL format');
            }

            // Get page posts using Graph API
            const response = await axios.get(
                `https://graph.facebook.com/v18.0/${pageIdentifier}/posts`,
                {
                    params: {
                        access_token: this.facebookAccessToken,
                        fields: 'message,created_time,permalink_url,full_picture',
                        limit: source.maxResults
                    }
                }
            );

            const articles: ScrapedArticle[] = [];
            
            if (response.data.data) {
                for (const post of response.data.data) {
                    if (post.message) { // Only include posts with text content
                        articles.push({
                            title: `Facebook Post - ${post.message.substring(0, 50)}...`,
                            content: post.message,
                            url: post.permalink_url || source.url,
                            publishedAt: post.created_time || new Date().toISOString()
                        });
                    }
                }
            }

            return articles;
        } catch (error) {
            Logger.error(`Error scraping Facebook for ${source.name}:`, error);
            throw error;
        }
    }

    /**
     * Sanitize text content
     */
    private sanitizeText(text: string): string {
        return sanitizeHtml(text, {
            allowedTags: [],
            allowedAttributes: {}
        }).trim();
    }

    /**
     * Clean up resources
     */
    public async dispose(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            Logger.info('🌐 Browser closed');
        }
    }
}

// FILE: src/server/services/SummarizationService.ts
// AI-powered text summarization service using OpenAI
import { OpenAI } from 'openai';
import { Logger } from '../utils/Logger';
import { ScrapedArticle } from './ScrapingService';

export interface SummarizedArticle extends ScrapedArticle {
    summary: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    keywords: string[];
}

export class SummarizationService {
    private openai: OpenAI;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        this.openai = new OpenAI({
            apiKey,
            timeout: 30000 // 30 second timeout
        });
    }

    /**
     * Summarize a single article with sentiment analysis and keyword extraction
     */
    public async summarizeArticle(article: ScrapedArticle): Promise<SummarizedArticle> {
        try {
            Logger.info(`📝 Summarizing: ${article.title.substring(0, 50)}...`);

            const prompt = this.buildSummarizationPrompt(article);
            
            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert news analyst for Šponar hot news s.r.o. Your job is to create concise, informative summaries of news articles and social media posts. Always provide exactly 3-5 sentences that capture the essence of the content.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 300,
                temperature: 0.3 // Lower temperature for more consistent results
            });

            const aiResponse = response.choices[0]?.message?.content || '';
            const analysis = this.parseAIResponse(aiResponse);

            return {
                ...article,
                summary: analysis.summary,
                sentiment: analysis.sentiment,
                keywords: analysis.keywords
            };

        } catch (error) {
            Logger.error(`❌ Error summarizing article: ${article.title}`, error);
            
            // Fallback to simple truncation if AI fails
            return {
                ...article,
                summary: this.createFallbackSummary(article.content),
                sentiment: 'neutral' as const,
                keywords: this.extractSimpleKeywords(article.content)
            };
        }
    }

    /**
     * Summarize multiple articles in batch for efficiency
     */
    public async summarizeArticles(articles: ScrapedArticle[]): Promise<SummarizedArticle[]> {
        const summarized: SummarizedArticle[] = [];
        
        // Process articles in small batches to avoid rate limits
        const batchSize = 3;
        for (let i = 0; i < articles.length; i += batchSize) {
            const batch = articles.slice(i, i + batchSize);
            
            const batchPromises = batch.map(article => 
                this.summarizeArticle(article).catch(error => {
                    Logger.error(`Failed to summarize article: ${article.title}`, error);
                    return {
                        ...article,
                        summary: this.createFallbackSummary(article.content),
                        sentiment: 'neutral' as const,
                        keywords: this.extractSimpleKeywords(article.content)
                    };
                })
            );

            const batchResults = await Promise.allSettled(batchPromises);
            
            batchResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    summarized.push(result.value);
                }
            });

            // Small delay between batches to respect rate limits
            if (i + batchSize < articles.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        Logger.info(`✅ Summarized ${summarized.length} articles`);
        return summarized;
    }

    /**
     * Build the prompt for AI summarization
     */
    private buildSummarizationPrompt(article: ScrapedArticle): string {
        return `Please analyze the following news content and provide:

1. SUMMARY: A concise 3-5 sentence summary that captures the main points and importance
2. SENTIMENT: Classify as "positive", "negative", or "neutral"
3. KEYWORDS: Extract 3-5 key terms or phrases (comma-separated)

Title: ${article.title}

Content: ${article.content.substring(0, 2000)} ${article.content.length > 2000 ? '...' : ''}

Please format your response as:
SUMMARY: [your 3-5 sentence summary]
SENTIMENT: [positive/negative/neutral]
KEYWORDS: [keyword1, keyword2, keyword3, ...]`;
    }

    /**
     * Parse the AI response to extract summary, sentiment, and keywords
     */
    private parseAIResponse(response: string): {
        summary: string;
        sentiment: 'positive' | 'negative' | 'neutral';
        keywords: string[];
    } {
        const defaultResult = {
            summary: 'Summary could not be generated.',
            sentiment: 'neutral' as const,
            keywords: []
        };

        try {
            const summaryMatch = response.match(/SUMMARY:\s*(.+?)(?=\n|SENTIMENT:|KEYWORDS:|$)/s);
            const sentimentMatch = response.match(/SENTIMENT:\s*(positive|negative|neutral)/i);
            const keywordsMatch = response.match(/KEYWORDS:\s*(.+?)(?=\n|$)/s);

            const summary = summaryMatch ? summaryMatch[1].trim() : defaultResult.summary;
            const sentiment = sentimentMatch ? 
                sentimentMatch[1].toLowerCase() as 'positive' | 'negative' | 'neutral' : 
                defaultResult.sentiment;
            const keywords = keywordsMatch ? 
                keywordsMatch[1].split(',').map(k => k.trim()).filter(k => k.length > 0) : 
                defaultResult.keywords;

            return {
                summary: summary.length > 10 ? summary : defaultResult.summary,
                sentiment,
                keywords: keywords.slice(0, 5) // Limit to 5 keywords
            };
        } catch (error) {
            Logger.warn('Error parsing AI response:', error);
            return defaultResult;
        }
    }

    /**
     * Create a simple fallback summary when AI fails
     */
    private createFallbackSummary(content: string): string {
        // Take first few sentences up to about 200 characters
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
        let summary = '';
        
        for (const sentence of sentences.slice(0, 3)) {
            if (summary.length + sentence.length > 200) break;
            summary += sentence.trim() + '. ';
        }

        return summary.trim() || content.substring(0, 200) + '...';
    }

    /**
     * Extract simple keywords when AI processing fails
     */
    private extractSimpleKeywords(content: string): string[] {
        // Simple keyword extraction based on frequency and length
        const words = content.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 4 && word.length < 20);

        const wordCount = new Map<string, number>();
        words.forEach(word => {
            wordCount.set(word, (wordCount.get(word) || 0) + 1);
        });

        // Get most frequent words, excluding common stop words
        const stopWords = new Set(['that', 'this', 'with', 'from', 'they', 'have', 'were', 'said', 'will', 'there', 'their', 'what', 'would', 'about', 'which', 'when', 'where']);
        
        return Array.from(wordCount.entries())
            .filter(([word, count]) => count > 1 && !stopWords.has(word))
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    }
}

// FILE: src/server/services/SchedulerService.ts
// Background scheduler for automatic content scanning and processing
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

    /**
     * Start the scheduler and set up automatic scanning
     */
    public async start(): Promise<void> {
        if (this.isRunning) return;

        Logger.info('⏰ Starting content scanning scheduler...');

        // Main scanning job - runs every 15 minutes
        const mainTask = cron.schedule('*/15 * * * *', async () => {
            await this.scanAllSources();
        }, {
            scheduled: false
        });

        // Cleanup job - runs daily at 2 AM
        const cleanupTask = cron.schedule('0 2 * * *', async () => {
            await this.performCleanup();
        }, {
            scheduled: false
        });

        this.tasks.set('main-scan', mainTask);
        this.tasks.set('cleanup', cleanupTask);

        // Start all tasks
        this.tasks.forEach(task => task.start());

        this.isRunning = true;
        Logger.info('✅ Scheduler started successfully');

        // Run initial scan
        setTimeout(() => this.scanAllSources(), 5000);
    }

    /**
     * Stop the scheduler
     */
    public async stop(): Promise<void> {
        if (!this.isRunning) return;

        Logger.info('⏹️ Stopping scheduler...');

        this.tasks.forEach(task => task.stop());
        this.tasks.clear();

        this.isRunning = false;
        Logger.info('✅ Scheduler stopped');
    }

    /**
     * Scan all active sources for new content
     */
    private async scanAllSources(): Promise<void> {
        try {
            Logger.info('🔄 Starting scheduled scan of all sources...');
            const startTime = Date.now();

            const sources = await this.databaseService.getSources(true); // Active sources only
            const scanPromises = sources.map(source => this.scanSingleSource(source));

            const results = await Promise.allSettled(scanPromises);
            
            let totalArticles = 0;
            let successfulScans = 0;
            let failedScans = 0;

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    totalArticles += result.value;
                    successfulScans++;
                } else {
                    Logger.error(`Failed to scan ${sources[index].name}:`, result.reason);
                    failedScans++;
                }
            });

            const duration = Date.now() - startTime;
            Logger.info(`✅ Scan completed: ${totalArticles} articles processed, ${successfulScans} successful, ${failedScans} failed (${duration}ms)`);

        } catch (error) {
            Logger.error('❌ Error during scheduled scan:', error);
        }
    }

    /**
     * Scan a single source and process its content
     */
    private async scanSingleSource(source: NewsSource): Promise<number> {
        const startTime = Date.now();
        let articlesProcessed = 0;
        let articlesFound = 0;
        let errors: string[] = [];

        try {
            // Check if enough time has passed since last scan
            if (source.lastScanned) {
                const lastScan = new Date(source.lastScanned);
                const nextScan = new Date(lastScan.getTime() + source.scanFrequency * 60 * 1000);
                if (new Date() < nextScan) {
                    Logger.debug(`⏭️ Skipping ${source.name} - not time for next scan yet`);
                    return 0;
                }
            }

            Logger.info(`🔍 Scanning source: ${source.name}`);

            // Scrape articles
            const articles = await this.scrapingService.scrapeSource(source);
            articlesFound = articles.length;

            if (articles.length === 0) {
                Logger.info(`📰 No new articles found for ${source.name}`);
            } else {
                // Summarize articles
                const summarizedArticles = await this.summarizationService.summarizeArticles(articles);

                // Save to database
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

                        if (articleId > 0) {
                            articlesProcessed++;
                        }
                    } catch (error: any) {
                        if (!error.message.includes('UNIQUE constraint failed')) {
                            errors.push(`Failed to save article: ${error.message}`);
                        }
                    }
                }

                Logger.info(`📰 Processed ${articlesProcessed} new articles from ${source.name}`);
            }

            // Update source's last scanned time
            await this.databaseService.updateSource(source.id!, {
                lastScanned: new Date().toISOString()
            });

        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';
            errors.push(errorMessage);
            Logger.error(`❌ Error scanning ${source.name}:`, error);
        } finally {
            // Record scan results for analytics
            const scanDuration = Date.now() - startTime;
            await this.databaseService.recordScanResult({
                sourceId: source.id!,
                articlesFound,
                articlesProcessed,
                errors: errors.length > 0 ? errors.join('; ') : undefined,
                scanDuration
            });
        }

        return articlesProcessed;
    }

    /**
     * Perform daily cleanup tasks
     */
    private async performCleanup(): Promise<void> {
        try {
            Logger.info('🧹 Starting daily cleanup...');

            // Here you could add cleanup tasks like:
            // - Remove old articles beyond retention period
            // - Clean up scan results older than X days
            // - Optimize database
            // - Generate daily reports

            Logger.info('✅ Daily cleanup completed');
        } catch (error) {
            Logger.error('❌ Error during cleanup:', error);
        }
    }
}

// FILE: src/server/routes/sourceRoutes.ts
// API routes for managing news sources
import express from 'express';
import { DatabaseService, NewsSource } from '../services/DatabaseService';
import { ScrapingService } from '../services/ScrapingService';
import { Logger } from '../utils/Logger';

export function sourceRoutes(
    databaseService: DatabaseService,
    scrapingService: ScrapingService
): express.Router {
    const router = express.Router();

    /**
     * GET /api/v1/sources
     * Get all news sources with optional filtering
     */
    router.get('/', async (req, res) => {
        try {
            const activeOnly = req.query.active === 'true';
            const sources = await databaseService.getSources(activeOnly);
            
            res.json({
                success: true,
                data: sources,
                count: sources.length
            });
        } catch (error) {
            Logger.error('Error fetching sources:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch sources'
            });
        }
    });

    /**
     * POST /api/v1/sources
     * Add a new news source
     */
    router.post('/', async (req, res) => {
        try {
            const { name, url, type, scanFrequency = 30, maxResults = 3 } = req.body;

            // Validation
            if (!name || !url || !type) {
                return res.status(400).json({
                    success: false,
                    error: 'Name, URL, and type are required'
                });
            }

            if (!['website', 'twitter', 'facebook'].includes(type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Type must be one of: website, twitter, facebook'
                });
            }

            // Validate URL format
            try {
                new URL(url);
            } catch {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid URL format'
                });
            }

            const sourceData: Omit<NewsSource, 'id' | 'createdAt' | 'updatedAt'> = {
                name,
                url,
                type,
                isActive: true,
                scanFrequency: Math.max(5, scanFrequency), // Minimum 5 minutes
                maxResults: Math.min(10, Math.max(1, maxResults)) // Between 1-10
            };

            const sourceId = await databaseService.addSource(sourceData);

            res.status(201).json({
                success: true,
                data: { id: sourceId, ...sourceData },
                message: 'Source added successfully'
            });

        } catch (error: any) {
            Logger.error('Error adding source:', error);
            
            if (error.message.includes('UNIQUE constraint failed')) {
                res.status(409).json({
                    success: false,
                    error: 'A source with this URL already exists'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to add source'
                });
            }
        }
    });

    /**
     * PUT /api/v1/sources/:id
     * Update an existing news source
     */
    router.put('/:id', async (req, res) => {
        try {
            const sourceId = parseInt(req.params.id);
            const updates = req.body;

            // Remove non-updatable fields
            delete updates.id;
            delete updates.createdAt;
            delete updates.updatedAt;

            // Validate scanFrequency if provided
            if (updates.scanFrequency !== undefined) {
                updates.scanFrequency = Math.max(5, updates.scanFrequency);
            }

            // Validate maxResults if provided
            if (updates.maxResults !== undefined) {
                updates.maxResults = Math.min(10, Math.max(1, updates.maxResults));
            }

            await databaseService.updateSource(sourceId, updates);

            res.json({
                success: true,
                message: 'Source updated successfully'
            });

        } catch (error) {
            Logger.error('Error updating source:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update source'
            });
        }
    });

    /**
     * DELETE /api/v1/sources/:id
     * Delete a news source
     */
    router.delete('/:id', async (req, res) => {
        try {
            const sourceId = parseInt(req.params.id);
            await databaseService.deleteSource(sourceId);

            res.json({
                success: true,
                message: 'Source deleted successfully'
            });

        } catch (error) {
            Logger.error('Error deleting source:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete source'
            });
        }
    });

    /**
     * POST /api/v1/sources/:id/test
     * Test a source by attempting to scrape it
     */
    router.post('/:id/test', async (req, res) => {
        try {
            const sourceId = parseInt(req.params.id);
            const sources = await databaseService.getSources();
            const source = sources.find(s => s.id === sourceId);

            if (!source) {
                return res.status(404).json({
                    success: false,
                    error: 'Source not found'
                });
            }

            Logger.info(`🧪 Testing source: ${source.name}`);
            const articles = await scrapingService.scrapeSource(source);

            res.json({
                success: true,
                data: {
                    articlesFound: articles.length,
                    sampleArticles: articles.slice(0, 2).map(article => ({
                        title: article.title,
                        url: article.url,
                        publishedAt: article.publishedAt,
                        contentPreview: article.content.substring(0, 200) + '...'
                    }))
                },
                message: `Test completed: found ${articles.length} articles`
            });

        } catch (error) {
            Logger.error('Error testing source:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to test source: ' + (error as Error).message
            });
        }
    });

    return router;
}

// FILE: src/server/routes/articleRoutes.ts
// API routes for fetching articles and summaries
import express from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { Logger } from '../utils/Logger';

export function articleRoutes(databaseService: DatabaseService): express.Router {
    const router = express.Router();

    /**
     * GET /api/v1/articles
     * Get articles with pagination and filtering
     */
    router.get('/', async (req, res) => {
        try {
            const {
                page = 1,
                limit = 20,
                sourceId,
                since,
                orderBy = 'publishedAt',
                order = 'DESC'
            } = req.query;

            const pageNum = Math.max(1, parseInt(page as string));
            const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
            const offset = (pageNum - 1) * limitNum;

            const options = {
                limit: limitNum,
                offset,
                sourceId: sourceId ? parseInt(sourceId as string) : undefined,
                since: since as string,
                orderBy: orderBy as 'publishedAt' | 'createdAt',
                order: order as 'ASC' | 'DESC'
            };

            const result = await databaseService.getArticles(options);

            res.json({
                success: true,
                data: result.articles,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: result.total,
                    totalPages: Math.ceil(result.total / limitNum)
                }
            });

        } catch (error) {
            Logger.error('Error fetching articles:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch articles'
            });
        }
    });

    /**
     * GET /api/v1/articles/latest
     * Get the latest articles from all sources (for dashboard)
     */
    router.get('/latest', async (req, res) => {
        try {
            const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
            
            const result = await databaseService.getArticles({
                limit,
                orderBy: 'publishedAt',
                order: 'DESC'
            });

            // Group articles by source for better presentation
            const articlesBySource = result.articles.reduce((acc: any, article: any) => {
                const sourceKey = `${article.sourceId}-${article.sourceName}`;
                if (!acc[sourceKey]) {
                    acc[sourceKey] = {
                        sourceId: article.sourceId,
                        sourceName: article.sourceName,
                        sourceType: article.sourceType,
                        articles: []
                    };
                }
                acc[sourceKey].articles.push(article);
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
            res.status(500).json({
                success: false,
                error: 'Failed to fetch latest articles'
            });
        }
    });

    /**
     * GET /api/v1/articles/search
     * Search articles by title, content, or keywords
     */
    router.get('/search', async (req, res) => {
        try {
            const { q: query, page = 1, limit = 20 } = req.query;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Search query is required'
                });
            }

            const pageNum = Math.max(1, parseInt(page as string));
            const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
            const offset = (pageNum - 1) * limitNum;

            // Simple search implementation - could be enhanced with full-text search
            const searchTerm = `%${query}%`;
            const articles = await new Promise<any[]>((resolve, reject) => {
                const db = (databaseService as any).db;
                db.all(`
                    SELECT 
                        a.*,
                        s.name as sourceName,
                        s.type as sourceType
                    FROM articles a
                    JOIN sources s ON a.sourceId = s.id
                    WHERE a.title LIKE ? OR a.content LIKE ? OR a.summary LIKE ? OR a.keywords LIKE ?
                    ORDER BY a.publishedAt DESC
                    LIMIT ? OFFSET ?
                `, [searchTerm, searchTerm, searchTerm, searchTerm, limitNum, offset], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            res.json({
                success: true,
                data: articles,
                query: query,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: articles.length // This would need a separate count query for accuracy
                }
            });

        } catch (error) {
            Logger.error('Error searching articles:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to search articles'
            });
        }
    });

    return router;
}

// FILE: src/server/routes/analyticsRoutes.ts
// API routes for analytics and reporting
import express from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { Logger } from '../utils/Logger';

export function analyticsRoutes(databaseService: DatabaseService): express.Router {
    const router = express.Router();

    /**
     * GET /api/v1/analytics/dashboard
     * Get dashboard analytics data
     */
    router.get('/dashboard', async (req, res) => {
        try {
            const days = Math.min(30, Math.max(1, parseInt(req.query.days as string) || 7));
            const analytics = await databaseService.getAnalytics(days);

            res.json({
                success: true,
                data: analytics
            });

        } catch (error) {
            Logger.error('Error fetching analytics:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch analytics'
            });
        }
    });

    /**
     * GET /api/v1/analytics/summary
     * Get high-level summary statistics
     */
    router.get('/summary', async (req, res) => {
        try {
            // Get total counts and recent activity
            const summaryData = await new Promise<any>((resolve, reject) => {
                const db = (databaseService as any).db;
                db.get(`
                    SELECT 
                        COUNT(DISTINCT s.id) as totalSources,
                        COUNT(DISTINCT CASE WHEN s.isActive = 1 THEN s.id END) as activeSources,
                        COUNT(a.id) as totalArticles,
                        COUNT(CASE WHEN a.createdAt >= datetime('now', '-1 day') THEN a.id END) as articlesToday,
                        COUNT(CASE WHEN a.createdAt >= datetime('now', '-7 days') THEN a.id END) as articlesThisWeek
                    FROM sources s
                    LEFT JOIN articles a ON s.id = a.sourceId
                `, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            res.json({
                success: true,
                data: summaryData
            });

        } catch (error) {
            Logger.error('Error fetching summary:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch summary'
            });
        }
    });

    return router;
}

// FILE: src/client/package.json
// Frontend React application dependencies
{
  "name": "sponar-news-client",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@types/node": "^16.18.68",
    "@types/react": "^18.2.42",
    "@types/react-dom": "^18.2.17",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "typescript": "^4.9.5",
    "axios": "^1.6.2",
    "react-router-dom": "^6.20.1",
    "date-fns": "^2.30.0",
    "lucide-react": "^0.294.0",
    "@headlessui/react": "^1.7.17",
    "tailwindcss": "^3.3.6",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "proxy": "http://localhost:3001"
}

// FILE: src/client/tailwind.config.js
// Tailwind CSS configuration for modern, responsive design
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom color palette for Šponar news brand
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

// FILE: src/client/src/App.tsx
// Main React application component - the central hub of the frontend
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Sources } from './pages/Sources';
import { Articles } from './pages/Articles';
import { Analytics } from './pages/Analytics';
import './App.css';

/**
 * Main application component that sets up routing and layout
 * This component orchestrates the entire frontend experience
 */
function App() {
  return (
    <Router>
      <div className="App min-h-screen bg-gray-50">
        <Layout>
          <Routes>
            {/* Dashboard - main overview of all news activity */}
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Sources management - add, edit, configure news sources */}
            <Route path="/sources" element={<Sources />} />
            
            {/* Articles view - browse and search all collected articles */}
            <Route path="/articles" element={<Articles />} />
            
            {/* Analytics - insights and reports on news collection */}
            <Route path="/analytics" element={<Analytics />} />
            
            {/* Default redirect to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </div>
    </Router>
  );
}

export default App;

// FILE: src/client/src/components/Layout.tsx
// Main layout component with navigation and responsive design
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Radio, 
  FileText, 
  BarChart3, 
  Settings,
  Search,
  Bell
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Layout component that provides the main navigation structure
 * This wraps all pages and provides consistent navigation experience
 */
export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  // Navigation items configuration
  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Sources', href: '/sources', icon: Radio },
    { name: 'Articles', href: '/articles', icon: FileText },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  ];

  /**
   * Check if the current route matches the navigation item
   * This helps highlight the active navigation state
   */
  const isActiveRoute = (href: string) => {
    return location.pathname === href;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar Navigation */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow pt-5 bg-white border-r border-gray-200 overflow-y-auto">
          {/* Logo and Brand */}
          <div className="flex items-center flex-shrink-0 px-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-semibold text-gray-900">Šponar News</h1>
                <p className="text-xs text-gray-500">Hot News Aggregator</p>
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <div className="mt-8 flex-grow flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActiveRoute(item.href);
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                      active
                        ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon
                      className={`mr-3 h-5 w-5 transition-colors ${
                        active ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Status indicator at bottom of sidebar */}
            <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="ml-2 text-xs text-gray-500">System Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex justify-between items-center px-6 py-4">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-gray-900 capitalize">
                {location.pathname.replace('/', '') || 'Dashboard'}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search functionality - could be enhanced later */}
              <div className="hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search articles..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Notifications indicator */}
              <button className="p-2 text-gray-400 hover:text-gray-500 relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400"></span>
              </button>

              {/* Settings access */}
              <button className="p-2 text-gray-400 hover:text-gray-500">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// FILE: src/client/src/pages/Dashboard.tsx
// Dashboard page showing overview of news collection activity
import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  TrendingUp, 
  Clock, 
  Globe, 
  MessageSquare,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { API } from '../services/api';

interface DashboardStats {
  totalSources: number;
  activeSources: number;
  totalArticles: number;
  articlesToday: number;
  articlesThisWeek: number;
}

interface Article {
  id: number;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  sourceType: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  keywords?: string;
}

/**
 * Dashboard component - the main overview page
 * Shows key metrics, recent articles, and system status
 */
export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [latestArticles, setLatestArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load dashboard data from the API
   * This function fetches both summary statistics and recent articles
   */
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch summary statistics and latest articles in parallel
      const [statsResponse, articlesResponse] = await Promise.all([
        API.getAnalyticsSummary(),
        API.getLatestArticles(10)
      ]);

      setStats(statsResponse.data);
      setLatestArticles(articlesResponse.data.latestArticles || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load data when component mounts
  useEffect(() => {
    loadDashboardData();
  }, []);

  /**
   * Get sentiment color classes for visual indicators
   */
  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-100';
      case 'negative': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  /**
   * Get source type icon and styling
   */
  const getSourceTypeDisplay = (type: string) => {
    switch (type) {
      case 'twitter': return { icon: '🐦', label: 'Twitter', color: 'bg-blue-100 text-blue-800' };
      case 'facebook': return { icon: '📘', label: 'Facebook', color: 'bg-blue-100 text-blue-800' };
      default: return { icon: '🌐', label: 'Website', color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-6">
        <p className="text-red-800">{error}</p>
        <button 
          onClick={loadDashboardData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">News Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Monitor your news sources and stay up to date with the latest developments
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <Globe className="h-8 w-8 text-primary-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Sources</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSources}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                <div className="h-3 w-3 bg-green-600 rounded-full"></div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Sources</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeSources}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Articles</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalArticles}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Today</p>
                <p className="text-2xl font-bold text-gray-900">{stats.articlesToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">This Week</p>
                <p className="text-2xl font-bold text-gray-900">{stats.articlesThisWeek}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Latest Articles Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Latest Articles</h2>
            <button 
              onClick={loadDashboardData}
              className="flex items-center text-primary-600 hover:text-primary-700 text-sm"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {latestArticles.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p>No articles found. Add some news sources to get started!</p>
            </div>
          ) : (
            latestArticles.map((article) => {
              const sourceDisplay = getSourceTypeDisplay(article.sourceType);
              
              return (
                <div key={article.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      {/* Article title with external link */}
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
                          {article.title}
                        </h3>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 flex-shrink-0 text-gray-400 hover:text-gray-600"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>

                      {/* Article summary */}
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {article.summary}
                      </p>

                      {/* Metadata row */}
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        {/* Source information */}
                        <span className={`inline-flex items-center px-2 py-1 rounded-full ${sourceDisplay.color}`}>
                          <span className="mr-1">{sourceDisplay.icon}</span>
                          {article.sourceName}
                        </span>

                        {/* Sentiment indicator */}
                        {article.sentiment && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getSentimentColor(article.sentiment)}`}>
                            {article.sentiment}
                          </span>
                        )}

                        {/* Publication time */}
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
                        </span>
                      </div>

                      {/* Keywords */}
                      {article.keywords && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {article.keywords.split(',').slice(0, 3).map((keyword, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {keyword.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// FILE: src/server/utils/Logger.ts
// Centralized logging utility
import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

export const Logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let log = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(meta).length > 0) {
                log += ` ${JSON.stringify(meta)}`;
            }
            return log;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
        })
    ]
});

// Create logs directory if it doesn't exist
import fs from 'fs';
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}
