const cloudStorage = require('./cloud-storage');
const User = require('./models/User');

async function testPhotoStorage() {
    console.log('🔍 Testing Photo Storage System...\n');
    
    try {
        // Test 1: Check storage configuration
        console.log('📋 Test 1: Storage Configuration');
        const storageInfo = cloudStorage.getStorageInfo();
        console.log('Storage Type:', storageInfo.storageType);
        console.log('Is Cloud Deployment:', storageInfo.isCloudDeployment);
        console.log('Use Cloudinary:', storageInfo.useCloudinary);
        console.log('Cloudinary Cloud Name:', storageInfo.cloudinaryCloudName);
        console.log('');
        
        // Test 2: Check member photos in database
        console.log('📋 Test 2: Member Photos in Database');
        const members = await User.find({}).select('name code passportPhoto passport signature');
        console.log(`Found ${members.length} members in database`);
        
        const membersWithPhotos = members.filter(m => m.passportPhoto || m.passport);
        console.log(`Members with photos: ${membersWithPhotos.length}`);
        
        if (membersWithPhotos.length > 0) {
            console.log('\nSample members with photos:');
            membersWithPhotos.slice(0, 3).forEach((member, index) => {
                console.log(`${index + 1}. ${member.name} (${member.code})`);
                console.log(`   Passport Photo: ${member.passportPhoto || 'None'}`);
                console.log(`   Passport: ${member.passport || 'None'}`);
                console.log(`   Signature: ${member.signature || 'None'}`);
                console.log('');
            });
        }
        
        // Test 3: Test URL construction
        console.log('📋 Test 3: URL Construction Test');
        const testFilenames = [
            'passportPhoto-1754305054377-936666238.png',
            'signature-1754305054378-123456789.png'
        ];
        
        const baseUrl = process.env.BACKEND_URL || 'https://narap-backend.onrender.com';
        const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dh5wjtvlf';
        
        testFilenames.forEach(filename => {
            console.log(`\nTesting filename: ${filename}`);
            
            // Backend URLs
            const backendPassportUrl = `${baseUrl}/api/uploads/passports/${filename}`;
            const backendSignatureUrl = `${baseUrl}/api/uploads/signatures/${filename}`;
            
            // Cloudinary URLs
            const cloudinaryPassportUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/v1/NARAP/passportPhoto/${filename}`;
            const cloudinarySignatureUrl = `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/v1/NARAP/signature/${filename}`;
            
            console.log('Backend Passport URL:', backendPassportUrl);
            console.log('Backend Signature URL:', backendSignatureUrl);
            console.log('Cloudinary Passport URL:', cloudinaryPassportUrl);
            console.log('Cloudinary Signature URL:', cloudinarySignatureUrl);
        });
        
        // Test 4: Test file existence
        console.log('\n📋 Test 4: File Existence Test');
        if (membersWithPhotos.length > 0) {
            const testMember = membersWithPhotos[0];
            const photoFilename = testMember.passportPhoto || testMember.passport;
            
            if (photoFilename) {
                console.log(`Testing file existence for: ${photoFilename}`);
                
                try {
                    const fileInfo = await cloudStorage.getFile(photoFilename, 'passportPhoto');
                    console.log('✅ File found in storage:', fileInfo);
                } catch (error) {
                    console.log('❌ File not found in storage:', error.message);
                }
            }
        }
        
        // Test 5: List files in storage
        console.log('\n📋 Test 5: List Files in Storage');
        try {
            const passportFiles = await cloudStorage.listFiles('passportPhoto');
            const signatureFiles = await cloudStorage.listFiles('signature');
            
            console.log(`Passport files in storage: ${passportFiles.length}`);
            console.log(`Signature files in storage: ${signatureFiles.length}`);
            
            if (passportFiles.length > 0) {
                console.log('Sample passport files:', passportFiles.slice(0, 3));
            }
            
            if (signatureFiles.length > 0) {
                console.log('Sample signature files:', signatureFiles.slice(0, 3));
            }
        } catch (error) {
            console.log('❌ Error listing files:', error.message);
        }
        
        console.log('\n✅ Photo storage test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testPhotoStorage().then(() => {
        console.log('\n🏁 Test completed');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}

module.exports = { testPhotoStorage }; 