const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'Šponar News Aggregator is running',
        features: ['Advanced web scraping', 'No API keys required', 'AI summarization']
    });
});

app.get('/api/v1/sources', (req, res) => {
    res.json({ success: true, data: [], message: 'Demo mode - add TypeScript server for full functionality' });
});

app.get('/api/v1/articles/latest', (req, res) => {
    res.json({
        success: true,
        data: { totalArticles: 0, sources: [], latestArticles: [] },
        message: 'Demo mode - start the TypeScript server for full functionality'
    });
});

app.get('/', (req, res) => {
    res.json({
        message: '🎉 Šponar News Aggregator API Ready!',
        status: 'Running in demo mode',
        instructions: [
            '✅ Basic server is working',
            '📦 Install dependencies: npm install',
            '🚀 Start full server: npm run dev',
            '📱 Access dashboard: http://localhost:3000'
        ],
        features: [
            '🐦 Twitter scraping without API',
            '📘 Facebook scraping without API', 
            '🌐 Website content extraction',
            '🧠 Intelligent AI summarization',
            '📊 Real-time analytics dashboard'
        ]
    });
});

app.listen(port, () => {
    console.log(`\n🎉 Šponar News Aggregator Demo Server Running!`);
    console.log(`📊 Health check: http://localhost:${port}/api/health`);
    console.log(`🚀 Next steps:`);
    console.log(`   1. npm install (install dependencies)`);
    console.log(`   2. npm run dev (start full application)`);
    console.log(`   3. Open http://localhost:3000 in your browser`);
});
