const cloudinary = require('cloudinary').v2;

// Test different possible cloud names
const possibleCloudNames = [
  'dh5wjtvlf',  // Correct cloud name
  'narap-images',
  'narapimages', 
  'narap',
  'narapdb',
  'narap-db',
  'narapdb-ng',
  'narap-ng'
];

const API_KEY = '219556848713984';
const API_SECRET = '243__4G0WJVVPXmUULxAcZdjPJg';

async function testCloudinaryConfig() {
  console.log('🔍 Testing Cloudinary configuration...');
  console.log('📋 API Key:', API_KEY);
  console.log('🔐 API Secret:', API_SECRET.substring(0, 10) + '...');
  
  for (const cloudName of possibleCloudNames) {
    console.log(`\n🧪 Testing cloud name: ${cloudName}`);
    
    try {
      // Configure Cloudinary
      cloudinary.config({
        cloud_name: cloudName,
        api_key: API_KEY,
        api_secret: API_SECRET
      });
      
      // Test the configuration by trying to list resources
      const result = await cloudinary.api.resources({
        type: 'upload',
        max_results: 1
      });
      
      console.log(`✅ SUCCESS! Cloud name "${cloudName}" is valid`);
      console.log(`📊 Account info: ${result.resources.length} resources found`);
      
      // Test upload capability
      try {
        const uploadResult = await cloudinary.uploader.upload(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          {
            folder: 'NARAP/test',
            public_id: 'test-config',
            overwrite: true
          }
        );
        console.log(`✅ Upload test successful: ${uploadResult.secure_url}`);
        
        // Clean up test upload
        await cloudinary.uploader.destroy(uploadResult.public_id);
        console.log(`🗑️ Test upload cleaned up`);
        
        return cloudName; // Return the working cloud name
      } catch (uploadError) {
        console.log(`⚠️ Upload test failed: ${uploadError.message}`);
      }
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
  
  console.log('\n❌ No valid cloud name found. Please check your Cloudinary credentials.');
  return null;
}

// Also test with the current configuration
async function testCurrentConfig() {
  console.log('\n🔍 Testing current configuration...');
  
  try {
    cloudinary.config({
      cloud_name: 'dh5wjtvlf',
      api_key: API_KEY,
      api_secret: API_SECRET
    });
    
    const result = await cloudinary.api.resources({
      type: 'upload',
      max_results: 1
    });
    
    console.log('✅ Current configuration works!');
    return true;
  } catch (error) {
    console.log(`❌ Current configuration failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Cloudinary Configuration Test');
  console.log('================================');
  
  // Test current config first
  const currentWorks = await testCurrentConfig();
  
  if (!currentWorks) {
    // Test possible cloud names
    const workingCloudName = await testCloudinaryConfig();
    
    if (workingCloudName) {
      console.log(`\n🎯 RECOMMENDATION: Use cloud name "${workingCloudName}"`);
      console.log('\n📝 Update your environment variables:');
      console.log(`CLOUDINARY_CLOUD_NAME=${workingCloudName}`);
      console.log(`CLOUDINARY_API_KEY=${API_KEY}`);
      console.log(`CLOUDINARY_API_SECRET=${API_SECRET}`);
    }
  } else {
    console.log('\n✅ Current configuration is working!');
  }
}

main().catch(console.error); 