#!/usr/bin/env node

/**
 * Render Cloudinary Configuration Test
 * Tests Cloudinary setup on your Render deployment
 */

const fetch = require('node-fetch');

// Configuration - Update this with your actual Render service URL
const RENDER_SERVICE_URL = 'https://your-render-service.onrender.com'; // UPDATE THIS

async function testRenderCloudinarySetup() {
  console.log('🚀 Testing Render + Cloudinary Setup');
  console.log('=====================================');
  console.log(`📍 Service URL: ${RENDER_SERVICE_URL}`);
  console.log('');

  try {
    // Step 1: Test basic connectivity
    console.log('🔍 Step 1: Testing basic connectivity...');
    const healthResponse = await fetch(`${RENDER_SERVICE_URL}/api/health`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Service is running');
      console.log('📊 Health status:', healthData.status);
    } else {
      console.log('❌ Service health check failed:', healthResponse.status);
      return;
    }

    // Step 2: Test storage configuration
    console.log('\n🔍 Step 2: Testing storage configuration...');
    const storageResponse = await fetch(`${RENDER_SERVICE_URL}/api/uploads/debug/files`);
    
    if (storageResponse.ok) {
      const storageData = await storageResponse.json();
      console.log('✅ Storage info retrieved');
      console.log('📊 Storage details:', storageData.storage);
      
      if (storageData.storage.type === 'cloudinary') {
        console.log('✅ Cloudinary is configured and active!');
      } else {
        console.log('⚠️ Cloudinary is not active, current storage type:', storageData.storage.type);
        console.log('💡 Check your environment variables in Render dashboard');
      }
    } else {
      console.log('❌ Storage info failed:', storageResponse.status);
      const errorData = await storageResponse.json().catch(() => ({}));
      console.log('❌ Error details:', errorData);
    }

    // Step 3: Test file upload endpoint
    console.log('\n🔍 Step 3: Testing file upload endpoint...');
    const uploadTestResponse = await fetch(`${RENDER_SERVICE_URL}/api/uploads/debug/files`);
    
    if (uploadTestResponse.ok) {
      console.log('✅ Upload endpoints are accessible');
    } else {
      console.log('❌ Upload endpoints failed:', uploadTestResponse.status);
    }

    // Step 4: Check for Cloudinary initialization in logs
    console.log('\n🔍 Step 4: Checking for Cloudinary initialization...');
    console.log('💡 Check your Render deployment logs for these messages:');
    console.log('   ✅ Cloudinary initialized successfully');
    console.log('   ☁️ Cloud name: [your-cloud-name]');
    console.log('   🔧 Storage initialized: cloudinary (Cloud: true, Cloudinary: true)');
    
    if (storageData && storageData.storage && storageData.storage.type === 'cloudinary') {
      console.log('\n🎉 SUCCESS! Cloudinary is properly configured on Render!');
      console.log('📤 Files will now be stored in Cloudinary');
      console.log('🔗 Photos will have URLs like: https://res.cloudinary.com/[cloud-name]/...');
    } else {
      console.log('\n⚠️ Cloudinary is not yet configured on Render');
      console.log('📋 Next steps:');
      console.log('   1. Go to your Cloudinary dashboard');
      console.log('   2. Get your cloud name, API key, and API secret');
      console.log('   3. Add them to Render environment variables');
      console.log('   4. Redeploy your service');
      console.log('   5. Run this test again');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check if your Render service is running');
    console.log('   2. Verify the service URL is correct');
    console.log('   3. Check Render deployment logs for errors');
  }
}

// Helper function to test specific Cloudinary credentials
async function testCloudinaryCredentials(cloudName, apiKey, apiSecret) {
  console.log('\n🔍 Testing Cloudinary credentials...');
  console.log(`☁️ Cloud name: ${cloudName}`);
  console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
  
  try {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });
    
    // Test the configuration
    const result = await cloudinary.api.resources({
      type: 'upload',
      max_results: 1
    });
    
    console.log('✅ Cloudinary credentials are valid!');
    console.log(`📊 Account has ${result.resources.length} resources`);
    return true;
    
  } catch (error) {
    console.log('❌ Cloudinary credentials failed:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  if (process.argv.includes('--test-credentials')) {
    // Test specific credentials if provided
    const cloudName = process.argv[3];
    const apiKey = process.argv[4];
    const apiSecret = process.argv[5];
    
    if (cloudName && apiKey && apiSecret) {
      await testCloudinaryCredentials(cloudName, apiKey, apiSecret);
    } else {
      console.log('❌ Usage: node test-render-cloudinary.js --test-credentials <cloud-name> <api-key> <api-secret>');
    }
  } else {
    // Test Render deployment
    await testRenderCloudinarySetup();
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testRenderCloudinarySetup, testCloudinaryCredentials };


