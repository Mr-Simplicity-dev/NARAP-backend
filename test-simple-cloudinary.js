const cloudinary = require('cloudinary').v2;

console.log('🚀 Testing Cloudinary Configuration');
console.log('==================================');

// Configure Cloudinary with correct credentials
const CLOUDINARY_CLOUD_NAME = 'dh5wjtvlf';
const CLOUDINARY_API_KEY = '219556848713984';
const CLOUDINARY_API_SECRET = '243__4G0WJVVPXmUULxAcZdjPJg';

console.log('📋 Configuration:');
console.log(`   Cloud Name: ${CLOUDINARY_CLOUD_NAME}`);
console.log(`   API Key: ${CLOUDINARY_API_KEY}`);
console.log(`   API Secret: ${CLOUDINARY_API_SECRET.substring(0, 10)}...`);

try {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });
  
  console.log('✅ Cloudinary configured successfully');
  
  // Test the configuration by listing resources
  console.log('\n🧪 Testing API connection...');
  
  cloudinary.api.resources({
    type: 'upload',
    max_results: 1
  }).then(result => {
    console.log('✅ API connection successful!');
    console.log(`📊 Found ${result.resources.length} resources in account`);
    console.log('\n🎉 Cloudinary configuration is working correctly!');
  }).catch(error => {
    console.log('❌ API connection failed:', error.message);
    console.log('🔍 Error details:', error);
  });
  
} catch (error) {
  console.log('❌ Configuration failed:', error.message);
} 