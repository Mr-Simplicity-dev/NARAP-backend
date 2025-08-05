const fetch = require('node-fetch');

async function testPhotoEndpoints() {
    console.log('🔍 Testing Photo Endpoints...\n');
    
    const backendUrl = 'https://narap-backend.onrender.com';
    
    try {
        // Test 1: Check members endpoint
        console.log('📋 Test 1: Members Endpoint');
        const membersResponse = await fetch(`${backendUrl}/api/users/members`);
        console.log('Members endpoint status:', membersResponse.status);
        
        if (membersResponse.ok) {
            const membersData = await membersResponse.json();
            console.log('Members found:', membersData.members?.length || membersData.data?.length || 0);
            
            // Check first member with photo
            const members = membersData.members || membersData.data || [];
            const memberWithPhoto = members.find(m => m.passportPhoto || m.passport);
            
            if (memberWithPhoto) {
                console.log('Sample member with photo:');
                console.log('  Name:', memberWithPhoto.name);
                console.log('  Code:', memberWithPhoto.code);
                console.log('  Passport Photo:', memberWithPhoto.passportPhoto || 'None');
                console.log('  Passport:', memberWithPhoto.passport || 'None');
                
                // Test photo URL
                const photoUrl = memberWithPhoto.passportPhoto || memberWithPhoto.passport;
                if (photoUrl) {
                    console.log('\n📋 Test 2: Photo URL Test');
                    console.log('Photo URL from member:', photoUrl);
                    
                    // Test different URL constructions
                    const testUrls = [
                        `${backendUrl}/api/uploads/passports/${photoUrl}`,
                        `${backendUrl}/api/uploads/signatures/${photoUrl}`,
                        `https://res.cloudinary.com/dh5wjtvlf/image/upload/v1/NARAP/passportPhoto/${photoUrl}`,
                        `https://res.cloudinary.com/dh5wjtvlf/image/upload/NARAP/passportPhoto/${photoUrl}`
                    ];
                    
                    for (let i = 0; i < testUrls.length; i++) {
                        const url = testUrls[i];
                        console.log(`\nTesting URL ${i + 1}: ${url}`);
                        
                        try {
                            const photoResponse = await fetch(url);
                            console.log(`  Status: ${photoResponse.status}`);
                            console.log(`  Content-Type: ${photoResponse.headers.get('content-type')}`);
                            
                            if (photoResponse.ok) {
                                console.log('  ✅ Photo accessible');
                            } else {
                                console.log('  ❌ Photo not accessible');
                            }
                        } catch (error) {
                            console.log(`  ❌ Error: ${error.message}`);
                        }
                    }
                }
            } else {
                console.log('No members with photos found');
            }
        } else {
            console.log('❌ Members endpoint failed');
        }
        
        // Test 3: Test member verification
        console.log('\n📋 Test 3: Member Verification');
        const testMemberCode = 'N/045/ANA/05';
        
        try {
            const verifyResponse = await fetch(`${backendUrl}/api/users/members/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: testMemberCode })
            });
            
            console.log('Verification endpoint status:', verifyResponse.status);
            
            if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json();
                console.log('Verification response:', JSON.stringify(verifyData, null, 2));
                
                if (verifyData.success && verifyData.member) {
                    const photoUrl = verifyData.member.passportPhoto || verifyData.member.passport;
                    console.log('Photo URL from verification:', photoUrl);
                }
            } else {
                console.log('❌ Verification endpoint failed');
            }
        } catch (error) {
            console.log('❌ Verification test failed:', error.message);
        }
        
        console.log('\n✅ Photo endpoint tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testPhotoEndpoints().then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 