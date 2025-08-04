#!/usr/bin/env node

/**
 * Error Handling Test Script
 * Tests various scenarios that could cause unhandled promise rejections
 */

const cloudStorage = require('./cloud-storage');

console.log('🧪 Testing Error Handling and Promise Rejection Prevention');
console.log('==========================================================');
console.log('');

// Test 1: Cloudinary upload with invalid credentials
async function testCloudinaryUploadError() {
    console.log('1️⃣ Testing Cloudinary upload error handling...');
    
    try {
        // Create a mock file object
        const mockFile = {
            originalname: 'test.jpg',
            fieldname: 'passportPhoto',
            buffer: Buffer.from('fake image data'),
            mimetype: 'image/jpeg'
        };
        
        // This should trigger an error but not cause an unhandled rejection
        const result = await cloudStorage.saveFile(mockFile, 'passportPhoto');
        console.log('   ✅ Upload completed (may have fallen back to local storage)');
        console.log('   📊 Result:', result);
        
    } catch (error) {
        console.log('   ❌ Upload failed as expected:', error.message);
    }
}

// Test 2: Cloudinary delete with invalid filename
async function testCloudinaryDeleteError() {
    console.log('\n2️⃣ Testing Cloudinary delete error handling...');
    
    try {
        const result = await cloudStorage.deleteFile('invalid-filename.jpg', 'passportPhoto');
        console.log('   ✅ Delete operation completed');
        console.log('   📊 Result:', result);
        
    } catch (error) {
        console.log('   ❌ Delete failed as expected:', error.message);
    }
}

// Test 3: File retrieval with non-existent file
async function testFileRetrievalError() {
    console.log('\n3️⃣ Testing file retrieval error handling...');
    
    try {
        const result = await cloudStorage.getFile('non-existent-file.jpg', 'passportPhoto');
        console.log('   ✅ File retrieval completed');
        console.log('   📊 Result:', result);
        
    } catch (error) {
        console.log('   ❌ File retrieval failed as expected:', error.message);
    }
}

// Test 4: List files operation
async function testListFiles() {
    console.log('\n4️⃣ Testing list files operation...');
    
    try {
        const result = await cloudStorage.listFiles();
        console.log('   ✅ List files completed');
        console.log('   📊 Result:', {
            passports: result.passports.length,
            signatures: result.signatures.length,
            total: result.total
        });
        
    } catch (error) {
        console.log('   ❌ List files failed:', error.message);
    }
}

// Test 5: Storage info
function testStorageInfo() {
    console.log('\n5️⃣ Testing storage info...');
    
    try {
        const info = cloudStorage.getStorageInfo();
        console.log('   ✅ Storage info retrieved');
        console.log('   📊 Info:', info);
        
    } catch (error) {
        console.log('   ❌ Storage info failed:', error.message);
    }
}

// Test 6: Simulate unhandled promise rejection
function testUnhandledRejection() {
    console.log('\n6️⃣ Testing unhandled rejection handling...');
    
    // This should be caught by the global handler
    const promise = new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error('Test unhandled rejection'));
        }, 100);
    });
    
    // Don't await or catch this promise - it should be handled by the global handler
    console.log('   ⚠️ Created promise that will reject (should be handled by global handler)');
    
    // Wait a bit for the rejection to be handled
    setTimeout(() => {
        console.log('   ✅ Unhandled rejection test completed');
    }, 200);
}

// Test 7: Test timeout handling
async function testTimeoutHandling() {
    console.log('\n7️⃣ Testing timeout handling...');
    
    try {
        // Create a promise that takes too long
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => resolve('delayed result'), 5000);
        });
        
        // This should timeout
        const result = await Promise.race([
            timeoutPromise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 100)
            )
        ]);
        
        console.log('   ✅ Timeout test completed');
        
    } catch (error) {
        console.log('   ⏰ Timeout occurred as expected:', error.message);
    }
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting error handling tests...\n');
    
    try {
        await testCloudinaryUploadError();
        await testCloudinaryDeleteError();
        await testFileRetrievalError();
        await testListFiles();
        testStorageInfo();
        testUnhandledRejection();
        await testTimeoutHandling();
        
        console.log('\n📊 Test Summary');
        console.log('==============');
        console.log('✅ All error handling tests completed');
        console.log('✅ No unhandled promise rejections should occur');
        console.log('✅ Server should remain stable during errors');
        
    } catch (error) {
        console.log('\n❌ Test suite failed:', error.message);
        console.log('Stack trace:', error.stack);
    }
}

// Set up global error handlers for testing
process.on('unhandledRejection', (reason, promise) => {
    console.log('\n🔍 Global handler caught unhandled rejection:');
    console.log('   Reason:', reason);
    console.log('   Promise:', promise);
});

process.on('uncaughtException', (error) => {
    console.log('\n🔍 Global handler caught uncaught exception:');
    console.log('   Error:', error.message);
    console.log('   Stack:', error.stack);
});

// Run the tests
runAllTests().then(() => {
    console.log('\n🎉 Error handling test suite completed successfully!');
    process.exit(0);
}).catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
}); 