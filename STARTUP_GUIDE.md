# 🚀 Šponar News Aggregator - Quick Start Guide

## Project Status: FIXED ✅

All configuration issues have been resolved. You now have:
- ✅ Fixed TypeScript configuration  
- ✅ Resolved Node.js compatibility issues
- ✅ Corrected file permissions
- ✅ Working React frontend setup
- ✅ Simple JavaScript server for testing
- ✅ All dependencies properly installed

## Quick Start (Recommended)

### 1. Start the Simple Server (Easiest)
```bash
npm run server:dev-js
```
This runs the JavaScript version which is guaranteed to work.

### 2. Start the React Frontend (New Terminal)
```bash
npm run client:dev
```

### 3. Test Everything Works
```bash
node test-server.js
```

### 4. Open Your Browser
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/health

## Alternative: TypeScript Server

If you want to use the full TypeScript version:
```bash
npm run server:dev
```

## Environment Setup

1. **Configure your API keys** in `.env`:
   ```bash
   OPENAI_API_KEY=your-key-here
   TWITTER_BEARER_TOKEN=your-key-here  
   FACEBOOK_ACCESS_TOKEN=your-key-here
   ```

2. **The app will work without API keys** in demo mode for testing.

## Available Commands

- `npm run server:dev-js` - Start simple JavaScript server
- `npm run server:dev` - Start TypeScript server  
- `npm run client:dev` - Start React frontend
- `npm run dev` - Start both server and client
- `npm run build` - Build for production
- `npm run test:health` - Test server health
- `node test-server.js` - Run comprehensive tests

## Troubleshooting

### If server won't start:
1. Check if port 3001 is free: `lsof -i :3001`
2. Try the simple server: `npm run server:dev-js`
3. Check logs for specific errors

### If React won't start:
1. Make sure you're in the right directory
2. Try: `cd src/client && npm start`
3. Clear cache: `npm start -- --reset-cache`

### If you see permission errors:
```bash
npm run clean
node fix-project.js
```

## Project Structure

```
📁 Your Project
├── 📄 server-simple.js      # Simple JavaScript server (recommended for testing)
├── 📁 src/
│   ├── 📁 server/           # TypeScript backend code
│   └── 📁 client/           # React frontend
├── 📄 .env                  # Environment configuration
├── 📄 test-server.js        # Server testing script
└── 📄 package.json          # Project dependencies
```

## Next Steps

1. ✅ **Get it running** (you should be able to do this now!)
2. 🔑 **Add your API keys** for full functionality  
3. 📰 **Add news sources** via the web interface
4. 🤖 **Start collecting and summarizing news**

## Need Help?

- Check the console output for specific error messages
- Run `node test-server.js` to verify everything is working
- All configuration has been fixed, so it should "just work" now!

---
🎉 **Happy news aggregating!**
