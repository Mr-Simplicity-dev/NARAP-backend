#!/usr/bin/env node

/**
 * Server Status Diagnostic Tool
 * Tests various aspects of server connectivity and health
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const BACKEND_URL = process.env.BACKEND_URL || 'https://narap-backend.onrender.com';

console.log('🔍 NARAP Server Status Diagnostic Tool');
console.log('=====================================');
console.log(`📍 Backend URL: ${BACKEND_URL}`);
console.log('');

// Test functions
async function testBasicConnectivity() {
    console.log('1️⃣ Testing Basic Connectivity...');
    
    try {
        const url = new URL(BACKEND_URL);
        const client = url.protocol === 'https:' ? https : http;
        
        return new Promise((resolve) => {
            const req = client.get(url, (res) => {
                console.log(`   ✅ Server responds with status: ${res.statusCode}`);
                console.log(`   📡 Response headers:`, res.headers);
                resolve({ success: true, status: res.statusCode });
            });
            
            req.on('error', (error) => {
                console.log(`   ❌ Connection failed: ${error.message}`);
                resolve({ success: false, error: error.message });
            });
            
            req.setTimeout(10000, () => {
                console.log('   ⏰ Request timed out after 10 seconds');
                req.destroy();
                resolve({ success: false, error: 'Timeout' });
            });
        });
    } catch (error) {
        console.log(`   ❌ URL parsing error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testHealthEndpoint() {
    console.log('\n2️⃣ Testing Health Endpoint...');
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/health`);
        console.log(`   📡 Health endpoint status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('   ✅ Health endpoint response:', data);
            return { success: true, data };
        } else {
            const text = await response.text();
            console.log(`   ❌ Health endpoint error: ${text}`);
            return { success: false, status: response.status, error: text };
        }
    } catch (error) {
        console.log(`   ❌ Health endpoint failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testCorsHeaders() {
    console.log('\n3️⃣ Testing CORS Headers...');
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/health`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://narapdb.com.ng',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });
        
        console.log(`   📡 CORS preflight status: ${response.status}`);
        console.log(`   🚫 CORS headers:`, {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
        });
        
        return { success: response.ok, status: response.status };
    } catch (error) {
        console.log(`   ❌ CORS test failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testDetailedHealth() {
    console.log('\n4️⃣ Testing Detailed Health Endpoint...');
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/health/detailed`);
        console.log(`   📡 Detailed health status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('   ✅ Detailed health data:', {
                status: data.status,
                uptime: data.uptime,
                environment: data.environment,
                memory: data.memory ? 'Available' : 'Not available'
            });
            return { success: true, data };
        } else {
            const text = await response.text();
            console.log(`   ❌ Detailed health error: ${text}`);
            return { success: false, status: response.status, error: text };
        }
    } catch (error) {
        console.log(`   ❌ Detailed health failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testConnectionEndpoint() {
    console.log('\n5️⃣ Testing Connection Endpoint...');
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/health/connection`);
        console.log(`   📡 Connection endpoint status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('   ✅ Connection test successful:', {
                status: data.status,
                origin: data.origin,
                ip: data.ip
            });
            return { success: true, data };
        } else {
            const text = await response.text();
            console.log(`   ❌ Connection test error: ${text}`);
            return { success: false, status: response.status, error: text };
        }
    } catch (error) {
        console.log(`   ❌ Connection test failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testResponseTime() {
    console.log('\n6️⃣ Testing Response Time...');
    
    const startTime = Date.now();
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/health`);
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log(`   ⏱️ Response time: ${responseTime}ms`);
        
        if (responseTime < 1000) {
            console.log('   ✅ Fast response time (< 1s)');
        } else if (responseTime < 5000) {
            console.log('   ⚠️ Moderate response time (1-5s)');
        } else {
            console.log('   ❌ Slow response time (> 5s)');
        }
        
        return { success: true, responseTime };
    } catch (error) {
        console.log(`   ❌ Response time test failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Main test runner
async function runAllTests() {
    const results = {
        basicConnectivity: await testBasicConnectivity(),
        healthEndpoint: await testHealthEndpoint(),
        corsHeaders: await testCorsHeaders(),
        detailedHealth: await testDetailedHealth(),
        connectionEndpoint: await testConnectionEndpoint(),
        responseTime: await testResponseTime()
    };
    
    console.log('\n📊 Test Summary');
    console.log('==============');
    
    const passedTests = Object.values(results).filter(r => r.success).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Server is healthy and accessible.');
    } else {
        console.log('⚠️ Some tests failed. Check the details above.');
        
        // Provide troubleshooting tips
        console.log('\n🔧 Troubleshooting Tips:');
        console.log('1. Check if the server is running on Render');
        console.log('2. Verify the backend URL is correct');
        console.log('3. Check CORS configuration in server.js');
        console.log('4. Ensure environment variables are set correctly');
        console.log('5. Check Render logs for any errors');
    }
    
    return results;
}

// Run the tests
runAllTests().catch(console.error); 