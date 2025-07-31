const fetch = require('node-fetch');

const BACKEND_URL = 'https://narap-backend.onrender.com';

async function quickTest() {
  console.log('🚀 Quick Cloud Deployment Test');
  console.log('📍 Backend URL:', BACKEND_URL);
  
  try {
    // Test 1: Health check
    console.log('\n🔍 Test 1: Health check...');
    const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Backend is healthy:', healthData);
    } else {
      console.log('❌ Health check failed:', healthResponse.status);
      return;
    }
    
    // Test 2: Storage info
    console.log('\n🔍 Test 2: Storage info...');
    const storageResponse = await fetch(`${BACKEND_URL}/api/uploads/debug/files`);
    if (storageResponse.ok) {
      const storageData = await storageResponse.json();
      console.log('✅ Storage info:', storageData.storage);
      console.log('📊 Files:', {
        passports: storageData.passports.length,
        signatures: storageData.signatures.length,
        total: storageData.total
      });
    } else {
      console.log('❌ Storage info failed:', storageResponse.status);
    }
    
    // Test 3: Test photo URL
    console.log('\n🔍 Test 3: Test photo URL...');
    const testPhotoUrl = `${BACKEND_URL}/api/uploads/passports/passportPhoto-1753977598677-802644850.jpg`;
    console.log('🔗 Testing URL:', testPhotoUrl);
    
    const photoResponse = await fetch(testPhotoUrl);
    if (photoResponse.ok) {
      console.log('✅ Photo is accessible!');
      console.log('📊 Content-Type:', photoResponse.headers.get('content-type'));
      console.log('📊 Content-Length:', photoResponse.headers.get('content-length'));
    } else {
      const errorData = await photoResponse.json().catch(() => ({}));
      console.log('❌ Photo not accessible:', photoResponse.status);
      console.log('❌ Error details:', errorData);
    }
    
    console.log('\n🎉 Quick test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

quickTest(); 