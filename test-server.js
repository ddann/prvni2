#!/usr/bin/env node

/**
 * Quick test script to verify the setup
 */

const http = require('http');

function testEndpoint(url, description) {
    return new Promise((resolve) => {
        const request = http.get(url, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                console.log(`✅ ${description}: ${response.statusCode}`);
                if (response.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        console.log(`   Response: ${json.message || json.status || 'OK'}`);
                    } catch (e) {
                        console.log(`   Response: ${data.substring(0, 100)}...`);
                    }
                } else {
                    console.log(`   Error: ${response.statusCode}`);
                }
                resolve(response.statusCode === 200);
            });
        });
        
        request.on('error', (error) => {
            console.log(`❌ ${description}: ${error.message}`);
            resolve(false);
        });
        
        request.setTimeout(5000, () => {
            console.log(`⏰ ${description}: Timeout`);
            request.destroy();
            resolve(false);
        });
    });
}

async function runTests() {
    console.log('🧪 Testing Šponar News Aggregator endpoints...
');
    
    const tests = [
        ['http://localhost:3001/api/health', 'Health Check'],
        ['http://localhost:3001/api/v1/sources', 'Sources API'],
        ['http://localhost:3001/api/v1/articles/latest', 'Articles API']
    ];
    
    for (const [url, description] of tests) {
        await testEndpoint(url, description);
    }
    
    console.log('
🎉 Testing complete!');
    console.log('If all tests passed, your server is working correctly.');
    console.log('If tests failed, make sure the server is running: npm run server:dev-js');
}

runTests();
