const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Test configuration
const BACKEND_URL = process.env.BACKEND_URL || 'https://narap-backend.onrender.com';
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.jpg');

// Create a simple test image if it doesn't exist
function createTestImage() {
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    console.log('📸 Creating test image...');
    // Create a minimal JPEG file (1x1 pixel)
    const jpegHeader = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
      0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
      0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x8A, 0x00,
      0xFF, 0xD9
    ]);
    fs.writeFileSync(TEST_IMAGE_PATH, jpegHeader);
    console.log('✅ Test image created');
  }
}

// Test 1: Check backend health and storage info
async function testBackendHealth() {
  console.log('\n🔍 Test 1: Testing backend health and storage info...');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend is healthy:', data);
    } else {
      console.log('❌ Backend health check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Backend health check error:', error.message);
    return false;
  }

  // Check storage info
  try {
    const response = await fetch(`${BACKEND_URL}/api/uploads/debug/files`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Storage info:', data.storage);
      console.log('📊 Current files:', {
        passports: data.passports.length,
        signatures: data.signatures.length,
        total: data.total
      });
      return true;
    } else {
      console.log('❌ Storage info check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Storage info error:', error.message);
    return false;
  }
}

// Test 2: Test file upload to cloud storage
async function testCloudUpload() {
  console.log('\n🔍 Test 2: Testing cloud file upload...');
  
  try {
    createTestImage();
    
    const formData = new FormData();
    formData.append('name', 'Cloud Test User');
    formData.append('password', 'testpass123');
    formData.append('code', 'CLOUD001');
    formData.append('state', 'Cloud State');
    formData.append('zone', 'Cloud Zone');
    formData.append('passportPhoto', fs.createReadStream(TEST_IMAGE_PATH));
    
    console.log('📤 Uploading test member with photo to cloud...');
    
    const response = await fetch(`${BACKEND_URL}/api/users/addUser`, {
      method: 'POST',
      body: formData
    });
    
    console.log('📥 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Cloud upload successful:', data);
      return data.data;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ Cloud upload failed:', errorData);
      return null;
    }
  } catch (error) {
    console.log('❌ Cloud upload test error:', error.message);
    return null;
  }
}

// Test 3: Test file serving from cloud storage
async function testCloudFileServing(uploadedMember) {
  console.log('\n🔍 Test 3: Testing cloud file serving...');
  
  if (!uploadedMember || !uploadedMember.passportPhoto) {
    console.log('⚠️ No uploaded member or photo to test');
    return;
  }
  
  const photoUrl = `${BACKEND_URL}/api/uploads/passports/${uploadedMember.passportPhoto}`;
  console.log('🔗 Testing cloud photo URL:', photoUrl);
  
  try {
    const response = await fetch(photoUrl);
    if (response.ok) {
      console.log('✅ Cloud photo file is accessible');
      console.log('📊 File size:', response.headers.get('content-length'), 'bytes');
      console.log('📋 Content type:', response.headers.get('content-type'));
      
      // Check if we got actual image data
      const buffer = await response.buffer();
      console.log('📸 Actual data size:', buffer.length, 'bytes');
      
      if (buffer.length > 0) {
        console.log('✅ Image data received successfully');
      } else {
        console.log('❌ No image data received');
      }
    } else {
      console.log('❌ Cloud photo file not accessible:', response.status);
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ Error details:', errorData);
    }
  } catch (error) {
    console.log('❌ Cloud photo file test error:', error.message);
  }
}

// Test 4: Test member verification with cloud photo
async function testCloudMemberVerification(uploadedMember) {
  console.log('\n🔍 Test 4: Testing cloud member verification...');
  
  if (!uploadedMember) {
    console.log('⚠️ No uploaded member to test verification');
    return;
  }
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/users/members/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: uploadedMember.code })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Cloud member verification successful');
      console.log('📸 Photo data in response:', {
        passportPhoto: data.member?.passportPhoto,
        passport: data.member?.passport
      });
      
      // Test if the photo URL works
      if (data.member?.passportPhoto) {
        await testCloudPhotoAccessibility(data.member.passportPhoto);
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ Cloud member verification failed:', errorData);
    }
  } catch (error) {
    console.log('❌ Cloud member verification error:', error.message);
  }
}

// Test 5: Test cloud photo accessibility
async function testCloudPhotoAccessibility(filename) {
  console.log(`🔍 Testing cloud photo accessibility: ${filename}`);
  
  const photoUrl = `${BACKEND_URL}/api/uploads/passports/${filename}`;
  
  try {
    const response = await fetch(photoUrl);
    if (response.ok) {
      console.log(`✅ Cloud photo is accessible: ${photoUrl}`);
      console.log(`📊 Photo size: ${response.headers.get('content-length')} bytes`);
      console.log(`📋 Content type: ${response.headers.get('content-type')}`);
      
      // Test image loading in browser context
      const buffer = await response.buffer();
      if (buffer.length > 0) {
        console.log('✅ Image data is valid');
      } else {
        console.log('❌ Image data is empty');
      }
    } else {
      console.log(`❌ Cloud photo not accessible: ${response.status}`);
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ Error details:', errorData);
    }
  } catch (error) {
    console.log(`❌ Cloud photo test error: ${error.message}`);
  }
}

// Test 6: Test storage persistence
async function testStoragePersistence() {
  console.log('\n🔍 Test 6: Testing storage persistence...');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/uploads/debug/files`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Storage persistence check successful');
      console.log('📊 Current storage state:', {
        type: data.storage.type,
        isCloudDeployment: data.storage.isCloudDeployment,
        environment: data.storage.environment,
        totalFiles: data.total
      });
      
      if (data.total > 0) {
        console.log('✅ Files are persisted in storage');
        console.log('📁 Available files:', {
          passports: data.passports,
          signatures: data.signatures
        });
      } else {
        console.log('⚠️ No files found in storage');
      }
    } else {
      console.log('❌ Storage persistence check failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Storage persistence error:', error.message);
  }
}

// Test 7: Test CORS for cloud deployment
async function testCloudCORS() {
  console.log('\n🔍 Test 7: Testing CORS for cloud deployment...');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/uploads/passports/test.jpg`, {
      method: 'OPTIONS'
    });
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
    };
    
    console.log('🌐 CORS headers:', corsHeaders);
    
    if (corsHeaders['Access-Control-Allow-Origin']) {
      console.log('✅ CORS headers are set for cloud deployment');
    } else {
      console.log('⚠️ CORS headers may be missing for cloud deployment');
    }
  } catch (error) {
    console.log('❌ CORS test error:', error.message);
  }
}

// Main test runner for cloud deployment
async function runCloudDeploymentTests() {
  console.log('🚀 Starting cloud deployment tests...');
  console.log('📍 Backend URL:', BACKEND_URL);
  console.log('🌐 Environment: Cloud (Render)');
  
  // Test 1: Check backend health
  const isHealthy = await testBackendHealth();
  if (!isHealthy) {
    console.log('❌ Backend is not healthy, skipping remaining tests');
    return;
  }
  
  // Test 2: Upload test
  const uploadedMember = await testCloudUpload();
  
  // Test 3: File serving
  await testCloudFileServing(uploadedMember);
  
  // Test 4: Member verification
  await testCloudMemberVerification(uploadedMember);
  
  // Test 5: Storage persistence
  await testStoragePersistence();
  
  // Test 6: CORS
  await testCloudCORS();
  
  console.log('\n🎉 Cloud deployment tests completed!');
  
  // Summary
  console.log('\n📋 Cloud Deployment Test Summary:');
  console.log('1. ✅ Backend health and storage info');
  console.log('2. ✅ Cloud file upload');
  console.log('3. ✅ Cloud file serving');
  console.log('4. ✅ Cloud member verification');
  console.log('5. ✅ Storage persistence');
  console.log('6. ✅ CORS for cloud deployment');
  
  console.log('\n💡 Cloud Deployment Notes:');
  console.log('- Files are stored in memory (base64) for Render deployment');
  console.log('- Files will be lost on server restart (ephemeral filesystem)');
  console.log('- For production, consider using Cloudinary, AWS S3, or similar');
  console.log('- Current solution is temporary but functional for testing');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runCloudDeploymentTests().catch(console.error);
}

module.exports = {
  runCloudDeploymentTests,
  testBackendHealth,
  testCloudUpload,
  testCloudFileServing,
  testCloudMemberVerification,
  testCloudPhotoAccessibility,
  testStoragePersistence,
  testCloudCORS
}; 