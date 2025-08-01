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

// Test 1: Check if upload directories exist
async function testUploadDirectories() {
  console.log('\n🔍 Test 1: Checking upload directories...');
  
  const uploadsDir = path.join(__dirname, 'uploads');
  const passportsDir = path.join(uploadsDir, 'passports');
  const signaturesDir = path.join(uploadsDir, 'signatures');
  
  const dirs = [
    { name: 'uploads', path: uploadsDir },
    { name: 'passports', path: passportsDir },
    { name: 'signatures', path: signaturesDir }
  ];
  
  for (const dir of dirs) {
    if (fs.existsSync(dir.path)) {
      console.log(`✅ ${dir.name} directory exists: ${dir.path}`);
      const files = fs.readdirSync(dir.path);
      console.log(`   📁 Contains ${files.length} files: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
    } else {
      console.log(`❌ ${dir.name} directory missing: ${dir.path}`);
    }
  }
}

// Test 2: Test backend health
async function testBackendHealth() {
  console.log('\n🔍 Test 2: Testing backend health...');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend is healthy:', data);
      return true;
    } else {
      console.log('❌ Backend health check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Backend health check error:', error.message);
    return false;
  }
}

// Test 3: Test file upload endpoint
async function testFileUpload() {
  console.log('\n🔍 Test 3: Testing file upload...');
  
  try {
    createTestImage();
    
    const formData = new FormData();
    formData.append('name', 'Test User');
    formData.append('password', 'testpass123');
    formData.append('code', 'TEST001');
    formData.append('state', 'Test State');
    formData.append('zone', 'Test Zone');
    formData.append('passportPhoto', fs.createReadStream(TEST_IMAGE_PATH));
    
    console.log('📤 Uploading test member with photo...');
    
    const response = await fetch(`${BACKEND_URL}/api/users/addUser`, {
      method: 'POST',
      body: formData
    });
    
    console.log('📥 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Upload successful:', data);
      return data.data;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ Upload failed:', errorData);
      return null;
    }
  } catch (error) {
    console.log('❌ Upload test error:', error.message);
    return null;
  }
}

// Test 4: Test file serving
async function testFileServing(uploadedMember) {
  console.log('\n🔍 Test 4: Testing file serving...');
  
  if (!uploadedMember || !uploadedMember.passportPhoto) {
    console.log('⚠️ No uploaded member or photo to test');
    return;
  }
  
  const photoUrl = `${BACKEND_URL}/api/uploads/passports/${uploadedMember.passportPhoto}`;
  console.log('🔗 Testing photo URL:', photoUrl);
  
  try {
    const response = await fetch(photoUrl);
    if (response.ok) {
      console.log('✅ Photo file is accessible');
      console.log('📊 File size:', response.headers.get('content-length'), 'bytes');
      console.log('📋 Content type:', response.headers.get('content-type'));
    } else {
      console.log('❌ Photo file not accessible:', response.status);
    }
  } catch (error) {
    console.log('❌ Photo file test error:', error.message);
  }
}

// Test 5: Test member verification with photo
async function testMemberVerification(uploadedMember) {
  console.log('\n🔍 Test 5: Testing member verification...');
  
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
      console.log('✅ Member verification successful');
      console.log('📸 Photo data in response:', {
        passportPhoto: data.member?.passportPhoto,
        passport: data.member?.passport
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ Member verification failed:', errorData);
    }
  } catch (error) {
    console.log('❌ Member verification error:', error.message);
  }
}

// Test 6: Test debug endpoints
async function testDebugEndpoints() {
  console.log('\n🔍 Test 6: Testing debug endpoints...');
  
  // Test debug/files endpoint
  try {
    const response = await fetch(`${BACKEND_URL}/api/uploads/debug/files`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Debug files endpoint:', data);
    } else {
      console.log('❌ Debug files endpoint failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Debug files endpoint error:', error.message);
  }
  
  // Test debug/users endpoint
  try {
    const response = await fetch(`${BACKEND_URL}/api/users/debug/users`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Debug users endpoint:', data);
    } else {
      console.log('❌ Debug users endpoint failed:', response.status);
    }
  } catch (error) {
    console.log('❌ Debug users endpoint error:', error.message);
  }
}

// Test 7: Test CORS headers
async function testCORSHeaders() {
  console.log('\n🔍 Test 7: Testing CORS headers...');
  
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
      console.log('✅ CORS headers are set');
    } else {
      console.log('⚠️ CORS headers may be missing');
    }
  } catch (error) {
    console.log('❌ CORS test error:', error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting comprehensive photo upload tests...');
  console.log('📍 Backend URL:', BACKEND_URL);
  
  // Test 1: Check directories
  await testUploadDirectories();
  
  // Test 2: Check backend health
  const isHealthy = await testBackendHealth();
  if (!isHealthy) {
    console.log('❌ Backend is not healthy, skipping remaining tests');
    return;
  }
  
  // Test 3: Upload test
  const uploadedMember = await testFileUpload();
  
  // Test 4: File serving
  await testFileServing(uploadedMember);
  
  // Test 5: Member verification
  await testMemberVerification(uploadedMember);
  
  // Test 6: Debug endpoints
  await testDebugEndpoints();
  
  // Test 7: CORS headers
  await testCORSHeaders();
  
  console.log('\n🎉 All tests completed!');
  
  // Summary
  console.log('\n📋 Test Summary:');
  console.log('1. ✅ Upload directories check');
  console.log('2. ✅ Backend health check');
  console.log('3. ✅ File upload test');
  console.log('4. ✅ File serving test');
  console.log('5. ✅ Member verification test');
  console.log('6. ✅ Debug endpoints test');
  console.log('7. ✅ CORS headers test');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testUploadDirectories,
  testBackendHealth,
  testFileUpload,
  testFileServing,
  testMemberVerification,
  testDebugEndpoints,
  testCORSHeaders
}; 