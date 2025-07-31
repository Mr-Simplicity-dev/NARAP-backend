const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const passportsDir = path.join(uploadsDir, 'passports');
const signaturesDir = path.join(uploadsDir, 'signatures');

// Create directories if they don't exist
[uploadsDir, passportsDir, signaturesDir].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created uploads directory: ${dir}`);
    }
  } catch (error) {
    console.error(`❌ Error creating uploads directory ${dir}:`, error);
  }
});

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
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.log('❌ File not found:', filePath);
        return res.status(404).json({ 
            error: 'File not found',
            filename: filename,
            path: filePath,
            availableFiles: fs.existsSync(passportsDir) ? fs.readdirSync(passportsDir) : []
        });
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
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.log('❌ File not found:', filePath);
        return res.status(404).json({ 
            error: 'File not found',
            filename: filename,
            path: filePath,
            availableFiles: fs.existsSync(signaturesDir) ? fs.readdirSync(signaturesDir) : []
        });
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
    try {
        let passportFiles = [];
        let signatureFiles = [];
        
        if (fs.existsSync(passportsDir)) {
            passportFiles = fs.readdirSync(passportsDir);
        }
        
        if (fs.existsSync(signaturesDir)) {
            signatureFiles = fs.readdirSync(signaturesDir);
        }
        
        res.json({
            success: true,
            directories: {
                uploads: fs.existsSync(uploadsDir),
                passports: fs.existsSync(passportsDir),
                signatures: fs.existsSync(signaturesDir)
            },
            passports: passportFiles,
            signatures: signatureFiles,
            totalPassports: passportFiles.length,
            totalSignatures: signatureFiles.length,
            paths: {
                uploads: uploadsDir,
                passports: passportsDir,
                signatures: signaturesDir
            }
        });
    } catch (error) {
        console.error('Error in debug/files:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router; 