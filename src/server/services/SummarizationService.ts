import { Logger } from '../utils/Logger';
import { ScrapedArticle } from './ScrapingService';

let OpenAI: any;
try { OpenAI = require('openai').OpenAI; } catch (error) { /* OpenAI optional */ }

export interface SummarizedArticle extends ScrapedArticle {
    summary: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    keywords: string[];
}

export class SummarizationService {
    private openai: any;
    private hasApiKey: boolean = false;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey && OpenAI) {
            try {
                this.openai = new OpenAI({ apiKey, timeout: 30000 });
                this.hasApiKey = true;
                Logger.info('🤖 OpenAI summarization enabled');
            } catch (error) {
                this.hasApiKey = false;
            }
        } else {
            Logger.info('🧠 Using intelligent fallback summarization');
            this.hasApiKey = false;
        }
    }

    public async summarizeArticle(article: ScrapedArticle): Promise<SummarizedArticle> {
        try {
            if (this.hasApiKey && this.openai) {
                return await this.summarizeWithOpenAI(article);
            } else {
                return await this.summarizeWithFallback(article);
            }
        } catch (error) {
            Logger.error(`Error summarizing: ${article.title}`, error);
            return await this.summarizeWithFallback(article);
        }
    }

    private async summarizeWithOpenAI(article: ScrapedArticle): Promise<SummarizedArticle> {
        const response = await this.openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{
                role: 'system',
                content: 'Create 3-5 sentence summaries of news articles with sentiment and keywords.'
            }, {
                role: 'user',
                content: `Summarize this article:\n\nTitle: ${article.title}\n\nContent: ${article.content.substring(0, 2000)}`
            }],
            max_tokens: 300,
            temperature: 0.3
        });
        
        const summary = response.choices[0]?.message?.content || this.createIntelligentSummary(article.content);
        return {
            ...article,
            summary,
            sentiment: this.analyzeSentiment(article.content),
            keywords: this.extractKeywords(article.content)
        };
    }

    private async summarizeWithFallback(article: ScrapedArticle): Promise<SummarizedArticle> {
        return {
            ...article,
            summary: this.createIntelligentSummary(article.content),
            sentiment: this.analyzeSentiment(article.content),
            keywords: this.extractKeywords(article.content)
        };
    }

    private createIntelligentSummary(content: string): string {
        const sentences = this.splitIntoSentences(content);
        if (sentences.length <= 3) return content;

        const scoredSentences = sentences.map((sentence, index) => ({
            sentence, 
            score: this.scoreSentence(sentence, sentences, index),
            index
        }));

        const topSentences = scoredSentences
            .sort((a, b) => b.score - a.score)
            .slice(0, 4)
            .sort((a, b) => a.index - b.index)
            .map(item => item.sentence);

        return topSentences.join(' ').trim();
    }

    private scoreSentence(sentence: string, allSentences: string[], position: number): number {
        let score = 0;
        const words = sentence.split(/\s+/).length;
        
        if (words >= 8 && words <= 30) score += 2;
        if (position === 0) score += 3;
        else if (position <= 2) score += 1;
        
        const importantWords = ['announces', 'new', 'first', 'major', 'breaking', 'official'];
        importantWords.forEach(word => {
            if (sentence.toLowerCase().includes(word)) score += 1;
        });
        
        if (/\d+/.test(sentence)) score += 1;
        if (sentence.includes('"')) score += 1;
        if (sentence.includes('http')) score -= 2;
        
        return score;
    }

    private analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
        const positiveWords = ['good', 'great', 'success', 'growth', 'win', 'positive', 'amazing'];
        const negativeWords = ['bad', 'terrible', 'crisis', 'problem', 'decline', 'loss', 'negative'];
        
        const lowerContent = content.toLowerCase();
        let positiveScore = 0, negativeScore = 0;
        
        positiveWords.forEach(word => {
            positiveScore += (lowerContent.match(new RegExp(word, 'g')) || []).length;
        });
        negativeWords.forEach(word => {
            negativeScore += (lowerContent.match(new RegExp(word, 'g')) || []).length;
        });
        
        const diff = positiveScore - negativeScore;
        return diff > 2 ? 'positive' : diff < -2 ? 'negative' : 'neutral';
    }

    private extractKeywords(content: string): string[] {
        const words = content.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3 && /^[a-zA-Z]+$/.test(word))
            .filter(word => !this.isStopWord(word));
        
        const wordCount = new Map<string, number>();
        words.forEach(word => wordCount.set(word, (wordCount.get(word) || 0) + 1));
        
        return Array.from(wordCount.entries())
            .filter(([word, count]) => count > 1)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    }

    private isStopWord(word: string): boolean {
        const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'was', 'one']);
        return stopWords.has(word);
    }

    private splitIntoSentences(text: string): string[] {
        return text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    }

    public async summarizeArticles(articles: ScrapedArticle[]): Promise<SummarizedArticle[]> {
        const summarized: SummarizedArticle[] = [];
        for (const article of articles) {
            try {
                const result = await this.summarizeArticle(article);
                summarized.push(result);
            } catch (error) {
                Logger.error(`Failed to summarize: ${article.title}`, error);
            }
        }
        Logger.info(`✅ Summarized ${summarized.length} articles`);
        return summarized;
    }
}
