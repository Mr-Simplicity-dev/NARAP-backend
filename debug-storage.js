const fetch = require('node-fetch');

const BACKEND_URL = 'https://narap-backend.onrender.com';

async function debugStorage() {
  console.log('🔍 Debugging Cloud Storage System');
  console.log('📍 Backend URL:', BACKEND_URL);
  
  try {
    // Test 1: Health check
    console.log('\n🔍 Test 1: Backend health check...');
    const healthResponse = await fetch(`${BACKEND_URL}/api/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Backend is healthy:', healthData);
    } else {
      console.log('❌ Health check failed:', healthResponse.status);
      return;
    }
    
    // Test 2: Storage info
    console.log('\n🔍 Test 2: Storage information...');
    const storageResponse = await fetch(`${BACKEND_URL}/api/uploads/debug/files`);
    if (storageResponse.ok) {
      const storageData = await storageResponse.json();
      console.log('✅ Storage info retrieved');
      console.log('📊 Storage details:', storageData.storage);
      console.log('📁 Files in storage:');
      console.log(`   - Passports: ${storageData.passports.length} files`);
      console.log(`   - Signatures: ${storageData.signatures.length} files`);
      console.log(`   - Total: ${storageData.total} files`);
      
      if (storageData.passports.length > 0) {
        console.log('📸 Available passport files:');
        storageData.passports.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file}`);
        });
      }
      
      if (storageData.signatures.length > 0) {
        console.log('✍️ Available signature files:');
        storageData.signatures.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file}`);
        });
      }
    } else {
      console.log('❌ Storage info failed:', storageResponse.status);
      const errorData = await storageResponse.json().catch(() => ({}));
      console.log('❌ Error details:', errorData);
    }
    
    // Test 3: Test specific file access
    console.log('\n🔍 Test 3: Testing specific file access...');
    const testFiles = [
      'passportPhoto-1753978486107-561885398.png',
      'passportPhoto-1753967495277-248906542.png'
    ];
    
    for (const filename of testFiles) {
      console.log(`\n🔍 Testing file: ${filename}`);
      const photoUrl = `${BACKEND_URL}/api/uploads/passports/${filename}`;
      
      try {
        const photoResponse = await fetch(photoUrl);
        if (photoResponse.ok) {
          console.log('✅ File is accessible!');
          console.log(`📊 Content-Type: ${photoResponse.headers.get('content-type')}`);
          console.log(`📊 Content-Length: ${photoResponse.headers.get('content-length')}`);
        } else {
          const errorData = await photoResponse.json().catch(() => ({}));
          console.log('❌ File not accessible:', photoResponse.status);
          console.log('❌ Error details:', errorData);
        }
      } catch (error) {
        console.log('❌ File access error:', error.message);
      }
    }
    
    // Test 4: Test member verification
    console.log('\n🔍 Test 4: Testing member verification...');
    try {
      const verifyResponse = await fetch(`${BACKEND_URL}/api/users/members/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: 'CLOUD001' })
      });
      
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        console.log('✅ Member verification successful');
        console.log('📋 Member data:', {
          name: verifyData.member.name,
          code: verifyData.member.code,
          passportPhoto: verifyData.member.passportPhoto
        });
      } else {
        const errorData = await verifyResponse.json().catch(() => ({}));
        console.log('❌ Member verification failed:', verifyResponse.status);
        console.log('❌ Error details:', errorData);
      }
    } catch (error) {
      console.log('❌ Verification error:', error.message);
    }
    
    console.log('\n🎉 Debug completed!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugStorage(); 