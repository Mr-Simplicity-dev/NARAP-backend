const fetch = require('node-fetch');

// Test configuration
const BACKEND_URL = 'https://narap-backend.onrender.com';

async function testClearEndpoints() {
  console.log('🧪 Testing Clear Data and Clear Certificates Endpoints');
  console.log('📍 Backend URL:', BACKEND_URL);
  
  try {
    // Test 1: Check if endpoints are accessible
    console.log('\n🔍 Test 1: Checking endpoint accessibility...');
    
    // Test clear database endpoint
    try {
      const clearDbResponse = await fetch(`${BACKEND_URL}/api/clear-database`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Clear database endpoint accessible:', clearDbResponse.status);
      if (clearDbResponse.ok) {
        const result = await clearDbResponse.json();
        console.log('📋 Response:', result);
      }
    } catch (error) {
      console.log('❌ Clear database endpoint error:', error.message);
    }
    
    // Test clear certificates endpoint
    try {
      const clearCertResponse = await fetch(`${BACKEND_URL}/api/clear-certificates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Clear certificates endpoint accessible:', clearCertResponse.status);
      if (clearCertResponse.ok) {
        const result = await clearCertResponse.json();
        console.log('📋 Response:', result);
      }
    } catch (error) {
      console.log('❌ Clear certificates endpoint error:', error.message);
    }
    
    // Test 2: Check backend health
    console.log('\n🔍 Test 2: Checking backend health...');
    
    try {
      const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        console.log('✅ Backend is healthy:', health.status);
      } else {
        console.log('❌ Backend health check failed:', healthResponse.status);
      }
    } catch (error) {
      console.log('❌ Backend health check error:', error.message);
    }
    
    console.log('\n🎉 Clear endpoints test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testClearEndpoints(); 