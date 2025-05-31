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

    private async initializeBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: process.env.BROWSER_HEADLESS !== 'false',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080'],
                defaultViewport: { width: 1920, height: 1080 }
            });
            Logger.info('🌐 Browser initialized for scraping');
        }
        return this.browser;
    }

    public async scrapeSource(source: NewsSource): Promise<ScrapedArticle[]> {
        const startTime = Date.now();
        Logger.info(`🔍 Scraping: ${source.name} (${source.type})`);

        try {
            let articles: ScrapedArticle[] = [];

            switch (source.type) {
                case 'website': articles = await this.scrapeWebsite(source); break;
                case 'twitter': articles = await this.scrapeTwitter(source); break;
                case 'facebook': articles = await this.scrapeFacebook(source); break;
                default: throw new Error(`Unsupported source type: ${source.type}`);
            }

            const duration = Date.now() - startTime;
            Logger.info(`✅ Scraped ${articles.length} articles from ${source.name} in ${duration}ms`);
            return articles.slice(0, source.maxResults);
        } catch (error) {
            Logger.error(`❌ Error scraping ${source.name}:`, error);
            throw error;
        }
    }

    private async scrapeWebsite(source: NewsSource): Promise<ScrapedArticle[]> {
        try {
            const response = await axios.get(source.url, {
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsAggregator/1.0)' }
            });
            const $ = cheerio.load(response.data);
            return await this.extractArticlesFromHtml($, source);
        } catch (error) {
            return await this.scrapeWithBrowser(source);
        }
    }

    private async scrapeTwitter(source: NewsSource): Promise<ScrapedArticle[]> {
        const browser = await this.initializeBrowser();
        const page = await browser.newPage();
        
        try {
            await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.waitForContent(page, '[data-testid="tweet"]', 10000);

            const tweets = await page.evaluate((maxResults) => {
                const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
                const articles = [];
                
                for (let i = 0; i < Math.min(tweetElements.length, maxResults); i++) {
                    const tweet = tweetElements[i];
                    try {
                        const textElement = tweet.querySelector('[data-testid="tweetText"]');
                        const content = textElement ? textElement.textContent : '';
                        if (!content || content.length < 10) continue;
                        
                        const usernameElement = tweet.querySelector('[data-testid="User-Name"] span');
                        const author = usernameElement ? usernameElement.textContent : 'Twitter User';
                        
                        const timeElement = tweet.querySelector('time');
                        const publishedAt = timeElement ? timeElement.getAttribute('datetime') : new Date().toISOString();
                        
                        const linkElement = tweet.querySelector('a[href*="/status/"]');
                        const tweetUrl = linkElement ? 'https://twitter.com' + linkElement.getAttribute('href') : '';
                        
                        articles.push({
                            title: `Tweet by ${author}`,
                            content: content,
                            url: tweetUrl || window.location.href,
                            publishedAt: publishedAt || new Date().toISOString(),
                            author: author
                        });
                    } catch (error) {
                        console.log('Error extracting tweet:', error);
                    }
                }
                return articles;
            }, source.maxResults);

            Logger.info(`🐦 Extracted ${tweets.length} tweets`);
            return tweets;
        } finally {
            await page.close();
        }
    }

    private async scrapeFacebook(source: NewsSource): Promise<ScrapedArticle[]> {
        const browser = await this.initializeBrowser();
        const page = await browser.newPage();
        
        try {
            await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.handleFacebookAccess(page);
            await this.waitForContent(page, '[role="article"]', 10000);
            await this.autoScroll(page, 3);

            const posts = await page.evaluate((maxResults) => {
                const postElements = document.querySelectorAll('[role="article"], div[data-ft]');
                const articles = [];
                
                for (let i = 0; i < Math.min(postElements.length, maxResults); i++) {
                    const post = postElements[i];
                    try {
                        const textSelectors = ['[data-ad-preview="message"]', '.userContent', 'span[dir="auto"]'];
                        let content = '';
                        
                        for (const selector of textSelectors) {
                            const element = post.querySelector(selector);
                            if (element && element.textContent) {
                                content = element.textContent;
                                break;
                            }
                        }
                        
                        if (!content || content.length < 20) continue;
                        
                        articles.push({
                            title: `Facebook Post - ${content.substring(0, 50)}...`,
                            content: content,
                            url: window.location.href,
                            publishedAt: new Date().toISOString(),
                            author: 'Facebook Page'
                        });
                    } catch (error) {
                        console.log('Error extracting Facebook post:', error);
                    }
                }
                return articles;
            }, source.maxResults);

            Logger.info(`📘 Extracted ${posts.length} Facebook posts`);
            return posts;
        } finally {
            await page.close();
        }
    }

    private async handleFacebookAccess(page: Page): Promise<void> {
        await page.waitForTimeout(2000);
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
            const mobileUrl = currentUrl.replace('www.facebook.com', 'm.facebook.com');
            await page.goto(mobileUrl, { waitUntil: 'networkidle2' });
        }
    }

    private async autoScroll(page: Page, maxScrolls = 3): Promise<void> {
        for (let i = 0; i < maxScrolls; i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);
        }
    }

    private async waitForContent(page: Page, selector: string, timeout = 10000): Promise<void> {
        try {
            await page.waitForSelector(selector, { timeout });
        } catch (error) {
            Logger.warn(`Content selector '${selector}' not found`);
        }
    }

    private async extractArticlesFromHtml($: cheerio.CheerioAPI, source: NewsSource): Promise<ScrapedArticle[]> {
        const articles: ScrapedArticle[] = [];
        const articleSelectors = ['article', '.post', '.news-item', '.entry'];
        
        let foundElements = $();
        for (const selector of articleSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                foundElements = elements;
                break;
            }
        }

        foundElements.each((index, element) => {
            if (articles.length >= source.maxResults) return false;
            
            const $element = $(element);
            const title = this.extractTitle($element);
            const content = this.extractContent($element);
            
            if (title && content && content.length > 100) {
                articles.push({
                    title: this.sanitizeText(title),
                    content: this.sanitizeText(content),
                    url: this.extractUrl($element, source.url),
                    publishedAt: this.extractPublishDate($element)
                });
            }
        });

        return articles;
    }

    private extractTitle($element: cheerio.Cheerio<any>): string {
        const selectors = ['h1', 'h2', 'h3', '.title', '.headline'];
        for (const selector of selectors) {
            const title = $element.find(selector).first().text().trim();
            if (title.length > 10) return title;
        }
        return '';
    }

    private extractContent($element: cheerio.Cheerio<any>): string {
        const selectors = ['.content', '.post-content', '.description', 'p'];
        let content = '';
        for (const selector of selectors) {
            $element.find(selector).each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 50) content += text + ' ';
            });
            if (content.length > 200) break;
        }
        return content || $element.text().trim();
    }

    private extractUrl($element: cheerio.Cheerio<any>, sourceUrl: string): string {
        const link = $element.find('a[href]').first();
        if (link.length > 0) {
            const href = link.attr('href');
            if (href?.startsWith('http')) return href;
            if (href?.startsWith('/')) {
                const baseUrl = new URL(sourceUrl);
                return `${baseUrl.protocol}//${baseUrl.host}${href}`;
            }
        }
        return `${sourceUrl}#article-${Date.now()}`;
    }

    private extractPublishDate($element: cheerio.Cheerio<any>): string {
        const timeElement = $element.find('time[datetime]').first();
        if (timeElement.length > 0) {
            const datetime = timeElement.attr('datetime');
            if (datetime) return new Date(datetime).toISOString();
        }
        return new Date().toISOString();
    }

    private async scrapeWithBrowser(source: NewsSource): Promise<ScrapedArticle[]> {
        const browser = await this.initializeBrowser();
        const page = await browser.newPage();
        try {
            await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 30000 });
            await page.waitForTimeout(3000);
            const content = await page.content();
            const $ = cheerio.load(content);
            return await this.extractArticlesFromHtml($, source);
        } finally {
            await page.close();
        }
    }

    private sanitizeText(text: string): string {
        return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} }).trim();
    }

    public async dispose(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            Logger.info('🌐 Browser closed');
        }
    }
}
