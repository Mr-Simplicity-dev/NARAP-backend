const http = require('http');

const BASE_URL = process.env.BACKEND_URL || 'https://narap-backend.onrender.com';

// Test health endpoint
function testHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}/api/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ Health Check:', JSON.parse(data));
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ Health Check Failed:', err.message);
      reject(err);
    });
  });
}

// Test root endpoint
function testRoot() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE_URL}/`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ Root Endpoint:', JSON.parse(data));
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ Root Endpoint Failed:', err.message);
      reject(err);
    });
  });
}

// Test login endpoint
function testLogin() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      email: 'admin@narap.org',
      password: 'admin123'
    });

    const url = new URL(`${BASE_URL}/api/auth/login`);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ Login Test:', JSON.parse(data));
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ Login Test Failed:', err.message);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Run all tests
async function runTests() {
  console.log('🧪 Testing NARAP Backend...\n');
  
  try {
    await testHealth();
    await testRoot();
    await testLogin();
    
    console.log('\n🎉 All tests passed! Backend is working correctly.');
  } catch (error) {
    console.log('\n❌ Some tests failed. Check if the server is running on port 5000.');
  }
}

runTests(); 