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

async function testDeleteUpdateCloudinary() {
  console.log('🚀 Testing Delete and Update Operations with Cloudinary');
  console.log('📍 Backend URL:', BACKEND_URL);
  
  let testUser = null;
  
  try {
    // Step 1: Create test image
    console.log('\n🔍 Step 1: Creating test image...');
    createTestImage();
    
    // Step 2: Upload initial test member
    console.log('\n🔍 Step 2: Uploading initial test member...');
    const formData = new FormData();
    formData.append('name', 'Delete Update Test User');
    formData.append('password', 'testpass123');
    formData.append('code', 'DELETEUPDATE001');
    formData.append('state', 'Test State');
    formData.append('zone', 'Test Zone');
    formData.append('passportPhoto', fs.createReadStream(TEST_IMAGE_PATH));
    
    const uploadResponse = await fetch(`${BACKEND_URL}/api/users/addUser`, {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}));
      console.log('❌ Initial upload failed:', errorData);
      return;
    }
    
    const uploadData = await uploadResponse.json();
    testUser = uploadData.data;
    console.log('✅ Initial upload successful:', {
      name: testUser.name,
      code: testUser.code,
      passportPhoto: testUser.passportPhoto
    });
    
    // Step 3: Test photo accessibility after upload
    console.log('\n🔍 Step 3: Testing photo accessibility after upload...');
    const photoUrl = `${BACKEND_URL}/api/uploads/passports/${testUser.passportPhoto}`;
    const photoResponse = await fetch(photoUrl);
    
    if (photoResponse.ok) {
      console.log('✅ Photo accessible after upload');
    } else {
      console.log('❌ Photo not accessible after upload:', photoResponse.status);
    }
    
    // Step 4: Test member update with new photo
    console.log('\n🔍 Step 4: Testing member update with new photo...');
    const updateFormData = new FormData();
    updateFormData.append('name', 'Updated Test User');
    updateFormData.append('state', 'Updated State');
    updateFormData.append('zone', 'Updated Zone');
    updateFormData.append('passportPhoto', fs.createReadStream(TEST_IMAGE_PATH));
    
    const updateResponse = await fetch(`${BACKEND_URL}/api/users/updateUser/${testUser._id}`, {
      method: 'PUT',
      body: updateFormData
    });
    
    if (updateResponse.ok) {
      const updateData = await updateResponse.json();
      console.log('✅ Member update successful:', {
        name: updateData.data.name,
        passportPhoto: updateData.data.passportPhoto
      });
      
      // Test if old photo is no longer accessible
      const oldPhotoResponse = await fetch(photoUrl);
      if (oldPhotoResponse.ok) {
        console.log('⚠️ Old photo still accessible (might be cached)');
      } else {
        console.log('✅ Old photo no longer accessible (deleted)');
      }
      
      // Test if new photo is accessible
      const newPhotoUrl = `${BACKEND_URL}/api/uploads/passports/${updateData.data.passportPhoto}`;
      const newPhotoResponse = await fetch(newPhotoUrl);
      if (newPhotoResponse.ok) {
        console.log('✅ New photo accessible after update');
      } else {
        console.log('❌ New photo not accessible after update');
      }
      
      testUser = updateData.data; // Update test user with new data
    } else {
      const errorData = await updateResponse.json().catch(() => ({}));
      console.log('❌ Member update failed:', errorData);
    }
    
    // Step 5: Test member photo update by code
    console.log('\n🔍 Step 5: Testing member photo update by code...');
    const photoUpdateFormData = new FormData();
    photoUpdateFormData.append('passportPhoto', fs.createReadStream(TEST_IMAGE_PATH));
    
    const photoUpdateResponse = await fetch(`${BACKEND_URL}/api/users/updateMemberPhoto/${testUser.code}`, {
      method: 'PUT',
      body: photoUpdateFormData
    });
    
    if (photoUpdateResponse.ok) {
      const photoUpdateData = await photoUpdateResponse.json();
      console.log('✅ Member photo update successful:', {
        name: photoUpdateData.data.name,
        passportPhoto: photoUpdateData.data.passportPhoto
      });
      
      testUser = photoUpdateData.data; // Update test user with new data
    } else {
      const errorData = await photoUpdateResponse.json().catch(() => ({}));
      console.log('❌ Member photo update failed:', errorData);
    }
    
    // Step 6: Test member verification after updates
    console.log('\n🔍 Step 6: Testing member verification after updates...');
    const verifyResponse = await fetch(`${BACKEND_URL}/api/users/members/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: testUser.code })
    });
    
    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      console.log('✅ Member verification successful after updates');
      console.log('📋 Final member data:', {
        name: verifyData.member.name,
        code: verifyData.member.code,
        passportPhoto: verifyData.member.passportPhoto
      });
    } else {
      const errorData = await verifyResponse.json().catch(() => ({}));
      console.log('❌ Member verification failed after updates:', errorData);
    }
    
    // Step 7: Test member deletion
    console.log('\n🔍 Step 7: Testing member deletion...');
    const deleteResponse = await fetch(`${BACKEND_URL}/api/users/deleteUser/${testUser._id}`, {
      method: 'DELETE'
    });
    
    if (deleteResponse.ok) {
      const deleteData = await deleteResponse.json();
      console.log('✅ Member deletion successful:', deleteData.message);
      
      // Test if photo is no longer accessible after deletion
      const finalPhotoUrl = `${BACKEND_URL}/api/uploads/passports/${testUser.passportPhoto}`;
      const finalPhotoResponse = await fetch(finalPhotoUrl);
      if (finalPhotoResponse.ok) {
        console.log('⚠️ Photo still accessible after deletion (might be cached)');
      } else {
        console.log('✅ Photo no longer accessible after deletion');
      }
      
      // Test if member verification fails after deletion
      const finalVerifyResponse = await fetch(`${BACKEND_URL}/api/users/members/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: testUser.code })
      });
      
      if (finalVerifyResponse.ok) {
        console.log('⚠️ Member still verifiable after deletion (unexpected)');
      } else {
        console.log('✅ Member verification fails after deletion (expected)');
      }
    } else {
      const errorData = await deleteResponse.json().catch(() => ({}));
      console.log('❌ Member deletion failed:', errorData);
    }
    
    // Step 8: Test bulk operations
    console.log('\n🔍 Step 8: Testing bulk operations...');
    
    // Create multiple test users for bulk delete
    const testUsers = [];
    for (let i = 1; i <= 3; i++) {
      const bulkFormData = new FormData();
      bulkFormData.append('name', `Bulk Test User ${i}`);
      bulkFormData.append('password', 'testpass123');
      bulkFormData.append('code', `BULK${i}001`);
      bulkFormData.append('state', 'Bulk State');
      bulkFormData.append('zone', 'Bulk Zone');
      bulkFormData.append('passportPhoto', fs.createReadStream(TEST_IMAGE_PATH));
      
      const bulkUploadResponse = await fetch(`${BACKEND_URL}/api/users/addUser`, {
        method: 'POST',
        body: bulkFormData
      });
      
      if (bulkUploadResponse.ok) {
        const bulkUploadData = await bulkUploadResponse.json();
        testUsers.push(bulkUploadData.data);
        console.log(`✅ Created bulk test user ${i}:`, bulkUploadData.data.code);
      }
    }
    
    if (testUsers.length > 0) {
      // Test bulk delete
      const bulkDeleteResponse = await fetch(`${BACKEND_URL}/api/users/users/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userIds: testUsers.map(user => user._id) 
        })
      });
      
      if (bulkDeleteResponse.ok) {
        const bulkDeleteData = await bulkDeleteResponse.json();
        console.log('✅ Bulk delete successful:', bulkDeleteData.message);
      } else {
        const errorData = await bulkDeleteResponse.json().catch(() => ({}));
        console.log('❌ Bulk delete failed:', errorData);
      }
    }
    
    console.log('\n🎉 Delete and Update Cloudinary test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDeleteUpdateCloudinary(); 