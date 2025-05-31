#!/usr/bin/env node

/**
 * Automated Setup Script for Šponar News Aggregator
 * 
 * This script automatically parses the artifact file and creates the complete
 * project structure with all necessary files, dependencies, and configuration.
 * 
 * Think of this as a "project generator" that transforms a single artifact
 * into a fully functional news aggregation platform.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output to make the process clear and engaging
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

/**
 * Utility function to print colored messages
 * This helps users understand what's happening at each step
 */
function log(message, color = 'reset') {
    console.log(colors[color] + message + colors.reset);
}

/**
 * Create a directory if it doesn't exist
 * This function is "idempotent" - safe to run multiple times
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        log(`📁 Created directory: ${dirPath}`, 'cyan');
    }
}

/**
 * Write a file with proper directory creation
 * This handles the common pattern of "create directory, then create file"
 */
function writeFile(filePath, content) {
    // Ensure the directory exists before writing the file
    const dir = path.dirname(filePath);
    ensureDir(dir);
    
    // Write the file with proper encoding
    fs.writeFileSync(filePath, content, 'utf8');
    log(`📄 Created file: ${filePath}`, 'green');
}

/**
 * Execute a shell command and handle errors gracefully
 * This is how we run npm install and other command-line operations
 */
function executeCommand(command, description, workingDir = '.') {
    try {
        log(`⚡ ${description}...`, 'yellow');
        
        // Execute the command in the specified directory
        const result = execSync(command, { 
            cwd: workingDir, 
            stdio: 'pipe',  // Capture output instead of showing it directly
            encoding: 'utf8' 
        });
        
        log(`✅ ${description} completed successfully`, 'green');
        return result;
    } catch (error) {
        log(`❌ Error during ${description}: ${error.message}`, 'red');
        // Don't stop the entire process for non-critical errors
        return null;
    }
}

/**
 * Parse the artifact file and extract individual files
 * This is the "smart" part that understands the structure of our artifact
 */
function parseArtifactFile(artifactPath) {
    log('🔍 Reading and parsing artifact file...', 'blue');
    
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact file not found: ${artifactPath}`);
    }
    
    const content = fs.readFileSync(artifactPath, 'utf8');
    const files = new Map(); // Use Map to preserve order and handle duplicates
    
    // Split the content by file markers
    // The artifact uses "// FILE: filename" to separate different files
    const fileBlocks = content.split(/\/\/ FILE: /);
    
    // Skip the first block (it's just the comment before the first file)
    for (let i = 1; i < fileBlocks.length; i++) {
        const block = fileBlocks[i];
        
        // Extract filename from the first line
        const lines = block.split('\n');
        const fileName = lines[0].trim();
        
        // Extract file content (everything after the filename line)
        const fileContent = lines.slice(1).join('\n');
        
        // Clean up the content by removing artifact-specific comments
        const cleanContent = fileContent
            .replace(/^\/\/ [^\n]*\n/gm, '') // Remove comment lines
            .replace(/^\s*\n/gm, '') // Remove empty lines at the start
            .trim();
        
        if (fileName && cleanContent) {
            files.set(fileName, cleanContent);
            log(`  📋 Found file: ${fileName}`, 'cyan');
        }
    }
    
    log(`🎯 Successfully parsed ${files.size} files from artifact`, 'green');
    return files;
}

/**
 * Create the project structure and write all files
 * This function orchestrates the entire file creation process
 */
function createProjectStructure(files) {
    log('\n🏗️  Creating project structure...', 'blue');
    
    // Create essential directories first
    const directories = [
        'src/server/services',
        'src/server/routes',
        'src/server/utils',
        'src/client/src/components',
        'src/client/src/pages',
        'src/client/src/services',
        'src/client/public',
        'data',
        'logs'
    ];
    
    directories.forEach(dir => ensureDir(dir));
    
    // Write all files to their proper locations
    files.forEach((content, fileName) => {
        writeFile(fileName, content);
    });
    
    // Create additional required files that might not be in the artifact
    createAdditionalFiles();
}

/**
 * Create additional files that are needed but might not be in the artifact
 * These are standard files that every Node.js/React project needs
 */
function createAdditionalFiles() {
    log('\n📝 Creating additional required files...', 'blue');
    
    // Create .gitignore to exclude unnecessary files from version control
    const gitignoreContent = `
# Dependencies
node_modules/
src/client/node_modules/

# Build outputs
dist/
build/
src/client/build/

# Environment variables
.env
.env.local
.env.production

# Database
data/
*.db
*.sqlite

# Logs
logs/
*.log

# OS generated files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Temporary files
.tmp/
.cache/
`;
    writeFile('.gitignore', gitignoreContent.trim());
    
    // Create a basic HTML template for the React app
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Šponar News Aggregator - AI-powered news collection platform" />
    <title>Šponar News Aggregator</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
`;
    writeFile('src/client/public/index.html', htmlTemplate.trim());
    
    // Create PostCSS config for Tailwind CSS
    const postcssConfig = `
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
    writeFile('src/client/postcss.config.js', postcssConfig.trim());
}

/**
 * Install all dependencies for both backend and frontend
 * This handles the complex dependency installation process
 */
function installDependencies() {
    log('\n📦 Installing dependencies...', 'blue');
    
    // Install backend dependencies
    log('Installing backend dependencies (this may take a few minutes)...', 'yellow');
    executeCommand('npm install', 'Backend dependency installation');
    
    // Install frontend dependencies
    log('Installing frontend dependencies...', 'yellow');
    executeCommand('npm install', 'Frontend dependency installation', 'src/client');
    
    log('✅ All dependencies installed successfully!', 'green');
}

/**
 * Create environment configuration file
 * This sets up the basic configuration template
 */
function createEnvironmentConfig() {
    log('\n⚙️  Creating environment configuration...', 'blue');
    
    const envContent = `
# Šponar News Aggregator Configuration
# Copy this file to .env and fill in your actual values

# Server Configuration
NODE_ENV=development
PORT=3001

# Database Configuration
DATABASE_PATH=./data/news.db

# API Keys (Required)
OPENAI_API_KEY=your-openai-api-key-here
TWITTER_BEARER_TOKEN=your-twitter-bearer-token-here
FACEBOOK_ACCESS_TOKEN=your-facebook-access-token-here

# Application Settings
LOG_LEVEL=info
MAX_SOURCES_PER_USER=50
SCAN_INTERVAL_MINUTES=30

# Instructions:
# 1. Get your OpenAI API key from: https://platform.openai.com/api-keys
# 2. Get Twitter Bearer Token from: https://developer.twitter.com/
# 3. Get Facebook Access Token from: https://developers.facebook.com/
# 4. Copy this file to .env and replace the placeholder values
`;
    
    writeFile('.env.example', envContent.trim());
    
    // Create a basic .env file if it doesn't exist
    if (!fs.existsSync('.env')) {
        writeFile('.env', envContent.trim());
        log('📝 Created .env file - remember to add your actual API keys!', 'yellow');
    }
}

/**
 * Build the project to ensure everything is properly configured
 * This is like a "smoke test" to verify the setup worked correctly
 */
function buildProject() {
    log('\n🔨 Building project to verify setup...', 'blue');
    
    // Compile TypeScript for the backend
    executeCommand('npx tsc -p tsconfig.server.json', 'TypeScript compilation');
    
    log('✅ Project built successfully!', 'green');
}

/**
 * Display final setup instructions and next steps
 * This guides the user on how to use their new platform
 */
function displaySetupComplete() {
    log('\n' + '='.repeat(60), 'green');
    log('🎉 SETUP COMPLETE! Your news aggregator is ready!', 'green');
    log('='.repeat(60), 'green');
    
    log('\n📋 Next steps:', 'blue');
    log('1. Add your API keys to the .env file:', 'cyan');
    log('   - OpenAI API key (required for summarization)');
    log('   - Twitter Bearer Token (optional, for Twitter sources)');
    log('   - Facebook Access Token (optional, for Facebook sources)');
    
    log('\n2. Start the development server:', 'cyan');
    log('   npm run dev');
    
    log('\n3. Open your browser to:', 'cyan');
    log('   http://localhost:3001');
    
    log('\n4. Add your first news sources and start collecting articles!', 'cyan');
    
    log('\n🔧 Available commands:', 'blue');
    log('   npm run dev          - Start development server');
    log('   npm run build        - Build for production');
    log('   npm start            - Start production server');
    
    log('\n📖 Check the README.md file for detailed documentation.', 'yellow');
    log('\n🚀 Happy news aggregating!', 'magenta');
}

/**
 * Main setup function that orchestrates the entire process
 * This is the "conductor" that runs all the other functions in order
 */
async function main() {
    try {
        // Print welcome banner
        log('\n' + '='.repeat(60), 'blue');
        log('🤖 Šponar News Aggregator - Automated Setup', 'blue');
        log('='.repeat(60), 'blue');
        log('This script will automatically create your complete news platform.\n', 'cyan');
        
        // Step 1: Find and parse the artifact file
        const possibleArtifactNames = [
            'news_aggregator_app.ts',
            'artifact.ts',
            'complete_ai_assistant.ts',
            'simple_ai_assistant.ts'
        ];
        
        let artifactPath = null;
        for (const name of possibleArtifactNames) {
            if (fs.existsSync(name)) {
                artifactPath = name;
                break;
            }
        }
        
        if (!artifactPath) {
            // If no artifact found, ask user to specify
            log('❓ Artifact file not found. Please specify the path:', 'yellow');
            log('Expected names: ' + possibleArtifactNames.join(', '));
            throw new Error('Artifact file not found');
        }
        
        log(`📁 Found artifact file: ${artifactPath}`, 'green');
        
        // Step 2: Parse the artifact and extract files
        const files = parseArtifactFile(artifactPath);
        
        // Step 3: Create project structure
        createProjectStructure(files);
        
        // Step 4: Create additional required files
        createEnvironmentConfig();
        
        // Step 5: Install dependencies
        installDependencies();
        
        // Step 6: Build project
        buildProject();
        
        // Step 7: Display completion message
        displaySetupComplete();
        
    } catch (error) {
        log('\n❌ Setup failed:', 'red');
        log(error.message, 'red');
        log('\nTroubleshooting tips:', 'yellow');
        log('1. Make sure you have Node.js 16+ installed');
        log('2. Make sure the artifact file is in the current directory');
        log('3. Make sure you have write permissions in this directory');
        log('4. Try running: npm cache clean --force');
        process.exit(1);
    }
}

// Run the main function and handle any uncaught errors
main().catch(error => {
    log('\n💥 Unexpected error:', 'red');
    log(error.stack || error.message, 'red');
    process.exit(1);
});
