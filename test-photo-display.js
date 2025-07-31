const fetch = require('node-fetch');

const BACKEND_URL = 'https://narap-backend.onrender.com';

async function testPhotoDisplay() {
  console.log('🔍 Testing Photo Display for Member NARAP/ABJ/0001');
  console.log('📍 Backend URL:', BACKEND_URL);
  
  try {
    // Test 1: Get member data
    console.log('\n🔍 Test 1: Getting member data...');
    const memberResponse = await fetch(`${BACKEND_URL}/api/users/members/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: 'NARAP/ABJ/0001' })
    });
    
    if (memberResponse.ok) {
      const memberData = await memberResponse.json();
      console.log('✅ Member found:', memberData.member.name);
      console.log('📸 Photo URL:', memberData.member.passportPhoto);
      console.log('✍️ Signature URL:', memberData.member.signature);
      
      // Test 2: Check photo accessibility
      console.log('\n🔍 Test 2: Testing photo accessibility...');
      const photoUrl = memberData.member.passportPhoto;
      
      const photoResponse = await fetch(photoUrl);
      console.log('📊 Photo response status:', photoResponse.status);
      console.log('📊 Content-Type:', photoResponse.headers.get('content-type'));
      console.log('📊 Content-Length:', photoResponse.headers.get('content-length'));
      console.log('📊 CORS headers:', {
        'Access-Control-Allow-Origin': photoResponse.headers.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': photoResponse.headers.get('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': photoResponse.headers.get('Access-Control-Allow-Headers')
      });
      
      if (photoResponse.ok) {
        console.log('✅ Photo is accessible!');
        
        // Test 3: Check if photo can be loaded as image
        console.log('\n🔍 Test 3: Testing image loading...');
        const imageBuffer = await photoResponse.buffer();
        console.log('📊 Image buffer size:', imageBuffer.length, 'bytes');
        console.log('📊 Image buffer starts with:', imageBuffer.slice(0, 10));
        
        // Check if it's a valid image by looking at the first few bytes
        const isJPEG = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8;
        const isPNG = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50;
        
        if (isJPEG) {
          console.log('✅ Valid JPEG image detected');
        } else if (isPNG) {
          console.log('✅ Valid PNG image detected');
        } else {
          console.log('⚠️ Unknown image format');
        }
        
      } else {
        console.log('❌ Photo not accessible:', photoResponse.status);
        const errorText = await photoResponse.text();
        console.log('❌ Error response:', errorText);
      }
      
      // Test 4: Test signature accessibility
      console.log('\n🔍 Test 4: Testing signature accessibility...');
      const signatureUrl = memberData.member.signature;
      
      const signatureResponse = await fetch(signatureUrl);
      console.log('📊 Signature response status:', signatureResponse.status);
      console.log('📊 Content-Type:', signatureResponse.headers.get('content-type'));
      
      if (signatureResponse.ok) {
        console.log('✅ Signature is accessible!');
      } else {
        console.log('❌ Signature not accessible:', signatureResponse.status);
      }
      
      // Test 5: Check storage info
      console.log('\n🔍 Test 5: Checking storage info...');
      const storageResponse = await fetch(`${BACKEND_URL}/api/uploads/debug/files`);
      if (storageResponse.ok) {
        const storageData = await storageResponse.json();
        console.log('✅ Storage info:', storageData.storage);
        console.log('📊 Available files:', {
          passports: storageData.passports,
          signatures: storageData.signatures
        });
      }
      
    } else {
      console.log('❌ Member not found:', memberResponse.status);
    }
    
    console.log('\n🎉 Photo display test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPhotoDisplay(); 