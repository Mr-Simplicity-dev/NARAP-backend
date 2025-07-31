const express = require('express');
const router = express.Router();
const path = require('path');

// Handle OPTIONS requests for CORS preflight
router.options('*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send();
});

// Serve uploaded files
router.get('/passports/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads/passports', filename);
    console.log('🔍 Serving passport file:', { filename, filePath });
    console.log('🔍 Request headers:', req.headers);
    console.log('🔍 Request origin:', req.headers.origin);
    
    // Check if file exists
    if (!require('fs').existsSync(filePath)) {
        console.log('❌ File not found:', filePath);
        return res.status(404).json({ error: 'File not found' });
    }
    
    // Set CORS headers for image serving
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    console.log('✅ Sending passport file:', filename);
    res.sendFile(filePath);
});

router.get('/signatures/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads/signatures', filename);
    console.log('🔍 Serving signature file:', { filename, filePath });
    console.log('🔍 Request headers:', req.headers);
    console.log('🔍 Request origin:', req.headers.origin);
    
    // Check if file exists
    if (!require('fs').existsSync(filePath)) {
        console.log('❌ File not found:', filePath);
        return res.status(404).json({ error: 'File not found' });
    }
    
    // Set CORS headers for image serving
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    console.log('✅ Sending signature file:', filename);
    res.sendFile(filePath);
});

module.exports = router; 