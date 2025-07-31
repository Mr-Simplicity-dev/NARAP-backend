const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'https://narap-backend.onrender.com';

async function testNewUpload() {
  console.log('🚀 Testing New Photo Upload with Cloud Storage');
  console.log('📍 Backend URL:', BACKEND_URL);
  
  try {
    // Test 1: Check current storage state
    console.log('\n🔍 Test 1: Current storage state...');
    const storageResponse = await fetch(`${BACKEND_URL}/api/uploads/debug/files`);
    if (storageResponse.ok) {
      const storageData = await storageResponse.json();
      console.log('✅ Current storage info:', storageData.storage);
      console.log('📊 Current files:', {
        passports: storageData.passports.length,
        signatures: storageData.signatures.length,
        total: storageData.total
      });
    }
    
    // Test 2: Create a test image (if we can't find one)
    console.log('\n🔍 Test 2: Creating test image...');
    const testImagePath = path.join(__dirname, 'test-image.png');
    
    // Create a simple 1x1 pixel PNG image if it doesn't exist
    if (!fs.existsSync(testImagePath)) {
      const pngData = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, // width: 1
        0x00, 0x00, 0x00, 0x01, // height: 1
        0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
        0x90, 0x77, 0x53, 0xDE, // CRC
        0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
        0x49, 0x44, 0x41, 0x54, // IDAT
        0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // compressed data
        0xE2, 0x21, 0xBC, 0x33, // CRC
        0x00, 0x00, 0x00, 0x00, // IEND chunk length
        0x49, 0x45, 0x4E, 0x44, // IEND
        0xAE, 0x42, 0x60, 0x82  // CRC
      ]);
      fs.writeFileSync(testImagePath, pngData);
      console.log('✅ Created test image:', testImagePath);
    } else {
      console.log('✅ Test image already exists:', testImagePath);
    }
    
    // Test 3: Upload the test image
    console.log('\n🔍 Test 3: Uploading test image...');
    const formData = new FormData();
    formData.append('name', 'Test User Cloud Storage');
    formData.append('email', 'test-cloud@example.com');
    formData.append('password', 'testpass123');
    formData.append('code', 'CLOUD001');
    formData.append('state', 'Test State');
    formData.append('zone', 'Test Zone');
    
    // Add the test image
    const imageStream = fs.createReadStream(testImagePath);
    formData.append('passportPhoto', imageStream, {
      filename: 'test-image.png',
      contentType: 'image/png'
    });
    
    const uploadResponse = await fetch(`${BACKEND_URL}/api/users/addUser`, {
      method: 'POST',
      body: formData
    });
    
    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      console.log('✅ Upload successful!');
      console.log('📋 Member data:', {
        name: uploadData.data.name,
        code: uploadData.data.code,
        passportPhoto: uploadData.data.passportPhoto
      });
      
      // Test 4: Verify the uploaded file is accessible
      console.log('\n🔍 Test 4: Verifying uploaded file...');
      const photoUrl = `${BACKEND_URL}/api/uploads/passports/${uploadData.data.passportPhoto}`;
      console.log('🔗 Photo URL:', photoUrl);
      
      const photoResponse = await fetch(photoUrl);
      if (photoResponse.ok) {
        console.log('✅ Photo is accessible!');
        console.log('📊 Content-Type:', photoResponse.headers.get('content-type'));
        console.log('📊 Content-Length:', photoResponse.headers.get('content-length'));
        
        // Test 5: Check storage state after upload
        console.log('\n🔍 Test 5: Storage state after upload...');
        const finalStorageResponse = await fetch(`${BACKEND_URL}/api/uploads/debug/files`);
        if (finalStorageResponse.ok) {
          const finalStorageData = await finalStorageResponse.json();
          console.log('✅ Final storage info:', finalStorageData.storage);
          console.log('📊 Final files:', {
            passports: finalStorageData.passports.length,
            signatures: finalStorageData.signatures.length,
            total: finalStorageData.total
          });
        }
        
        console.log('\n🎉 Cloud storage test completed successfully!');
        console.log('✅ The cloud storage system is working correctly.');
        console.log('✅ New uploads will be stored in memory and accessible.');
        
      } else {
        const errorData = await photoResponse.json().catch(() => ({}));
        console.log('❌ Photo not accessible:', photoResponse.status);
        console.log('❌ Error details:', errorData);
      }
      
    } else {
      const errorData = await uploadResponse.json().catch(() => ({}));
      console.log('❌ Upload failed:', uploadResponse.status);
      console.log('❌ Error details:', errorData);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testNewUpload(); 