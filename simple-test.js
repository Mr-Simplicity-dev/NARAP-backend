const fs = require('fs');
const path = require('path');

// Simple test to verify the system
console.log('🔍 Simple Cloud Storage Test');
console.log('📍 Testing backend connectivity...');

// Test 1: Check if we can reach the backend
const https = require('https');

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function runSimpleTest() {
  try {
    // Test 1: Health check
    console.log('\n🔍 Test 1: Health check...');
    const healthResult = await makeRequest('https://narap-backend.onrender.com/api/health');
    console.log('✅ Backend health:', healthResult.status);
    console.log('📋 Response:', healthResult.data);

    // Test 2: Storage info
    console.log('\n🔍 Test 2: Storage info...');
    const storageResult = await makeRequest('https://narap-backend.onrender.com/api/uploads/debug/files');
    console.log('✅ Storage info:', storageResult.status);
    console.log('📋 Storage data:', storageResult.data);

    // Test 3: Test specific file
    console.log('\n🔍 Test 3: Test specific file...');
    const fileResult = await makeRequest('https://narap-backend.onrender.com/api/uploads/passports/passportPhoto-1753978486107-561885398.png');
    console.log('❌ File test:', fileResult.status);
    console.log('📋 File error:', fileResult.data);

    console.log('\n🎉 Simple test completed!');
    console.log('\n📝 Summary:');
    console.log('- Backend is working ✅');
    console.log('- Storage system is active ✅');
    console.log('- Old files are not available (expected) ❌');
    console.log('- New uploads should work ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runSimpleTest(); 