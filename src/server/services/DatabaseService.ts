import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { Logger } from '../utils/Logger';

export interface NewsSource {
    id?: number;
    name: string;
    url: string;
    type: 'website' | 'twitter' | 'facebook';
    isActive: boolean;
    lastScanned?: string;
    scanFrequency: number;
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

export class DatabaseService {
    private db: sqlite3.Database | null = null;
    private dbPath: string;

    constructor() {
        this.dbPath = process.env.DATABASE_PATH || './data/news.db';
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    public async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    Logger.error('Database error:', err);
                    reject(err);
                    return;
                }
                Logger.info(`📦 Database connected: ${this.dbPath}`);
                this.createTables().then(resolve).catch(reject);
            });
        });
    }

    private async createTables(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        const run = promisify(this.db.run.bind(this.db)) as (sql: string) => Promise<any>;

        await run(`CREATE TABLE IF NOT EXISTS sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL,
            isActive BOOLEAN DEFAULT 1,
            lastScanned DATETIME,
            scanFrequency INTEGER DEFAULT 30,
            maxResults INTEGER DEFAULT 3,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await run(`CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sourceId INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            url TEXT NOT NULL UNIQUE,
            publishedAt DATETIME NOT NULL,
            summary TEXT,
            sentiment TEXT,
            keywords TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sourceId) REFERENCES sources (id)
        )`);

        await run(`CREATE TABLE IF NOT EXISTS scan_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sourceId INTEGER NOT NULL,
            articlesFound INTEGER DEFAULT 0,
            articlesProcessed INTEGER DEFAULT 0,
            errors TEXT,
            scanDuration INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        Logger.info('✅ Database tables ready');
    }

    public async addSource(source: Omit<NewsSource, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');
        const run = promisify(this.db.run.bind(this.db)) as (sql: string, params: any[]) => Promise<any>;
        
        const result = await run(`INSERT INTO sources (name, url, type, isActive, scanFrequency, maxResults)
            VALUES (?, ?, ?, ?, ?, ?)`, 
            [source.name, source.url, source.type, source.isActive, source.scanFrequency, source.maxResults]);
        
        Logger.info(`📰 Added source: ${source.name}`);
        return result.lastID;
    }

    public async getSources(activeOnly = false): Promise<NewsSource[]> {
        if (!this.db) throw new Error('Database not initialized');
        const all = promisify(this.db.all.bind(this.db)) as (sql: string) => Promise<any[]>;
        
        const query = activeOnly ? 'SELECT * FROM sources WHERE isActive = 1' : 'SELECT * FROM sources';
        return await all(query);
    }

    public async updateSource(id: number, updates: Partial<NewsSource>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        const run = promisify(this.db.run.bind(this.db)) as (sql: string, params: any[]) => Promise<any>;
        
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        
        await run(`UPDATE sources SET ${fields}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, 
            [...values, id]);
    }

    public async deleteSource(id: number): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        const run = promisify(this.db.run.bind(this.db)) as (sql: string, params: any[]) => Promise<any>;
        await run('DELETE FROM sources WHERE id = ?', [id]);
    }

    public async addArticle(article: Omit<Article, 'id' | 'createdAt'>): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');
        const run = promisify(this.db.run.bind(this.db)) as (sql: string, params: any[]) => Promise<any>;
        
        try {
            const result = await run(`INSERT INTO articles 
                (sourceId, title, content, url, publishedAt, summary, sentiment, keywords)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [article.sourceId, article.title, article.content, article.url, 
                 article.publishedAt, article.summary, article.sentiment, article.keywords]);
            return result.lastID;
        } catch (error: any) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return -1;
            throw error;
        }
    }

    public async getArticles(options: any = {}): Promise<{ articles: Article[]; total: number }> {
        if (!this.db) throw new Error('Database not initialized');
        const all = promisify(this.db.all.bind(this.db)) as (sql: string, params?: any[]) => Promise<any[]>;
        const get = promisify(this.db.get.bind(this.db)) as (sql: string, params?: any[]) => Promise<any>;

        const { limit = 50, offset = 0, sourceId, since, orderBy = 'publishedAt', order = 'DESC' } = options;
        const conditions: string[] = [];
        const params: any[] = [];

        if (sourceId) { conditions.push('a.sourceId = ?'); params.push(sourceId); }
        if (since) { conditions.push('a.publishedAt >= ?'); params.push(since); }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        const countResult = await get(`SELECT COUNT(*) as total FROM articles a ${whereClause}`, params);
        const articles = await all(`
            SELECT a.*, s.name as sourceName, s.type as sourceType
            FROM articles a JOIN sources s ON a.sourceId = s.id
            ${whereClause} ORDER BY a.${orderBy} ${order} LIMIT ? OFFSET ?`,
            [...params, limit, offset]);

        return { articles, total: countResult.total };
    }

    public async close(): Promise<void> {
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db!.close(err => err ? reject(err) : resolve());
            });
        }
    }
}
