const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Test configuration
const BACKEND_URL = 'https://narap-backend.onrender.com';
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.png');

// Create a simple test image if it doesn't exist
function createTestImage() {
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    console.log('📸 Creating test image...');
    // Create a minimal PNG file (1x1 pixel)
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xF8, 0xCF, 0xCF, 0x00,
      0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB0, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    fs.writeFileSync(TEST_IMAGE_PATH, pngData);
    console.log('✅ Test image created');
  }
}

async function testCloudinaryIntegration() {
  console.log('🚀 Testing Cloudinary Integration');
  console.log('📍 Backend URL:', BACKEND_URL);
  
  try {
    // Step 1: Check current storage state
    console.log('\n🔍 Step 1: Checking current storage state...');
    const storageResponse = await fetch(`${BACKEND_URL}/api/uploads/debug/files`);
    if (storageResponse.ok) {
      const storageData = await storageResponse.json();
      console.log('✅ Storage info retrieved');
      console.log('📊 Storage details:', storageData.storage);
      console.log('📁 Current files:', {
        passports: storageData.passports.length,
        signatures: storageData.signatures.length,
        total: storageData.total
      });
    } else {
      console.log('❌ Storage info failed:', storageResponse.status);
    }
    
    // Step 2: Create test image
    console.log('\n🔍 Step 2: Creating test image...');
    createTestImage();
    
    // Step 3: Upload new member with photo to Cloudinary
    console.log('\n🔍 Step 3: Uploading new member with photo to Cloudinary...');
    const formData = new FormData();
    formData.append('name', 'Cloudinary Test User');
    formData.append('password', 'testpass123');
    formData.append('code', 'CLOUDINARY001');
    formData.append('state', 'Cloudinary State');
    formData.append('zone', 'Cloudinary Zone');
    formData.append('passportPhoto', fs.createReadStream(TEST_IMAGE_PATH));
    
    console.log('📤 Sending upload request to Cloudinary...');
    const uploadResponse = await fetch(`${BACKEND_URL}/api/users/addUser`, {
      method: 'POST',
      body: formData
    });
    
    console.log('📥 Upload response status:', uploadResponse.status);
    
    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      console.log('✅ Upload successful!');
      console.log('📋 Member data:', {
        name: uploadData.data.name,
        code: uploadData.data.code,
        passportPhoto: uploadData.data.passportPhoto
      });
      
      // Step 4: Test photo accessibility
      console.log('\n🔍 Step 4: Testing photo accessibility...');
      const photoUrl = `${BACKEND_URL}/api/uploads/passports/${uploadData.data.passportPhoto}`;
      console.log('🔗 Photo URL:', photoUrl);
      
      const photoResponse = await fetch(photoUrl);
      if (photoResponse.ok) {
        console.log('✅ Photo is accessible!');
        console.log(`📊 Content-Type: ${photoResponse.headers.get('content-type')}`);
        console.log(`📊 Content-Length: ${photoResponse.headers.get('content-length')}`);
        
        // Check if it's a redirect to Cloudinary
        if (photoResponse.redirected) {
          console.log('✅ Photo redirected to Cloudinary successfully!');
        }
      } else {
        const errorData = await photoResponse.json().catch(() => ({}));
        console.log('❌ Photo not accessible:', photoResponse.status);
        console.log('❌ Error details:', errorData);
      }
      
      // Step 5: Test member verification
      console.log('\n🔍 Step 5: Testing member verification...');
      const verifyResponse = await fetch(`${BACKEND_URL}/api/users/members/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: uploadData.data.code })
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
      
      // Step 6: Check final storage state
      console.log('\n🔍 Step 6: Checking final storage state...');
      const finalStorageResponse = await fetch(`${BACKEND_URL}/api/uploads/debug/files`);
      if (finalStorageResponse.ok) {
        const finalStorageData = await finalStorageResponse.json();
        console.log('✅ Final storage info retrieved');
        console.log('📊 Final files:', {
          passports: finalStorageData.passports.length,
          signatures: finalStorageData.signatures.length,
          total: finalStorageData.total
        });
        
        if (finalStorageData.passports.includes(uploadData.data.passportPhoto)) {
          console.log('✅ Uploaded file found in storage!');
        } else {
          console.log('❌ Uploaded file NOT found in storage!');
        }
      }
      
    } else {
      const errorData = await uploadResponse.json().catch(() => ({}));
      console.log('❌ Upload failed:', errorData);
    }
    
    console.log('\n🎉 Cloudinary integration test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCloudinaryIntegration(); 