const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const backendUrl = 'https://narap-backend.onrender.com';

console.log('🔍 NARAP Photo Debug Test');
console.log('📍 Backend URL:', backendUrl);
console.log('');

async function testPhotoIssues() {
  try {
    // Test 1: Check backend health and environment
    console.log('🔍 Test 1: Backend Health Check');
    const healthResponse = await fetch(`${backendUrl}/api/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Backend Status:', healthData.status);
    console.log('🌍 Environment:', healthData.environment);
    console.log('⏰ Uptime:', healthData.uptime);
    console.log('');

    // Test 2: Check storage configuration
    console.log('🔍 Test 2: Storage Configuration');
    try {
      const storageResponse = await fetch(`${backendUrl}/api/uploads/debug/files`);
      if (storageResponse.ok) {
        const storageData = await storageResponse.json();
        console.log('✅ Storage Info:', storageData.storage);
        console.log('📁 Passport Photos:', storageData.passports?.length || 0);
        console.log('✍️ Signatures:', storageData.signatures?.length || 0);
      } else {
        console.log('❌ Storage endpoint failed:', storageResponse.status);
        const errorText = await storageResponse.text();
        console.log('Error details:', errorText);
      }
    } catch (error) {
      console.log('❌ Storage test failed:', error.message);
    }
    console.log('');

    // Test 3: Check if any members have photos
    console.log('🔍 Test 3: Member Photo Data');
    try {
      const membersResponse = await fetch(`${backendUrl}/api/users/getUsers`);
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        const members = membersData.data || membersData;
        
        console.log(`📊 Total Members: ${members.length}`);
        
        const membersWithPhotos = members.filter(m => m.passportPhoto || m.passport);
        console.log(`📸 Members with photos: ${membersWithPhotos.length}`);
        
        if (membersWithPhotos.length > 0) {
          console.log('🔍 Sample member photo data:');
          const sampleMember = membersWithPhotos[0];
          console.log('  - Member:', sampleMember.name || sampleMember.fullName);
          console.log('  - Photo field:', sampleMember.passportPhoto || sampleMember.passport);
          console.log('  - Photo URL:', `${backendUrl}/api/uploads/passports/${sampleMember.passportPhoto || sampleMember.passport}`);
        } else {
          console.log('⚠️ No members have photos uploaded');
        }
      } else {
        console.log('❌ Members endpoint failed:', membersResponse.status);
      }
    } catch (error) {
      console.log('❌ Members test failed:', error.message);
    }
    console.log('');

    // Test 4: Test photo URL accessibility
    console.log('🔍 Test 4: Photo URL Accessibility');
    try {
      const membersResponse = await fetch(`${backendUrl}/api/users`);
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        const members = membersData.data || membersData;
        
        const membersWithPhotos = members.filter(m => m.passportPhoto || m.passport).slice(0, 3);
        
        for (const member of membersWithPhotos) {
          const photoFilename = member.passportPhoto || member.passport;
          const photoUrl = `${backendUrl}/api/uploads/passports/${photoFilename}`;
          
          console.log(`🔗 Testing photo URL: ${photoUrl}`);
          
          try {
            const photoResponse = await fetch(photoUrl);
            if (photoResponse.ok) {
              console.log(`✅ Photo accessible: ${photoFilename}`);
              console.log(`📊 Content-Type: ${photoResponse.headers.get('content-type')}`);
              console.log(`📏 Content-Length: ${photoResponse.headers.get('content-length')}`);
            } else {
              console.log(`❌ Photo not accessible: ${photoFilename} (${photoResponse.status})`);
              
              // Try to get error details
              try {
                const errorData = await photoResponse.json();
                console.log(`📋 Error details:`, errorData);
              } catch (e) {
                console.log(`📋 Error text: ${await photoResponse.text()}`);
              }
            }
          } catch (error) {
            console.log(`❌ Photo fetch failed: ${photoFilename} - ${error.message}`);
          }
          console.log('');
        }
      }
    } catch (error) {
      console.log('❌ Photo URL test failed:', error.message);
    }

    // Test 5: Check Cloudinary configuration
    console.log('🔍 Test 5: Cloudinary Configuration');
    try {
      const cloudinaryTestResponse = await fetch(`${backendUrl}/api/uploads/debug/files`);
      if (cloudinaryTestResponse.ok) {
        const cloudinaryData = await cloudinaryTestResponse.json();
        console.log('☁️ Cloudinary Status:', cloudinaryData.storage?.useCloudinary ? 'Enabled' : 'Disabled');
        console.log('🌐 Storage Type:', cloudinaryData.storage?.type);
        console.log('☁️ Cloud Deployment:', cloudinaryData.storage?.isCloudDeployment ? 'Yes' : 'No');
      }
    } catch (error) {
      console.log('❌ Cloudinary test failed:', error.message);
    }
    console.log('');

    // Test 6: Test photo upload (if possible)
    console.log('🔍 Test 6: Photo Upload Test');
    console.log('⚠️ This would require a test image file');
    console.log('💡 To test upload, use the admin panel or run a separate upload test');
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPhotoIssues().then(() => {
  console.log('🎯 Photo Debug Test Complete');
  console.log('');
  console.log('📋 Summary of Issues Found:');
  console.log('1. Check if environment variables are set correctly on Render');
  console.log('2. Verify Cloudinary credentials are configured');
  console.log('3. Ensure photo files are being uploaded to the correct storage');
  console.log('4. Check if photo URLs are being constructed correctly');
  console.log('5. Verify CORS settings for photo serving');
}); 