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

// Debug route to list available files
router.get('/debug/files', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    const passportsDir = path.join(__dirname, '../uploads/passports');
    const signaturesDir = path.join(__dirname, '../uploads/signatures');
    
    let passportFiles = [];
    let signatureFiles = [];
    
    try {
        if (fs.existsSync(passportsDir)) {
            passportFiles = fs.readdirSync(passportsDir);
        }
    } catch (error) {
        console.log('Error reading passports directory:', error);
    }
    
    try {
        if (fs.existsSync(signaturesDir)) {
            signatureFiles = fs.readdirSync(signaturesDir);
        }
    } catch (error) {
        console.log('Error reading signatures directory:', error);
    }
    
    res.json({
        success: true,
        passports: passportFiles,
        signatures: signatureFiles,
        totalPassports: passportFiles.length,
        totalSignatures: signatureFiles.length
    });
});

module.exports = router; 