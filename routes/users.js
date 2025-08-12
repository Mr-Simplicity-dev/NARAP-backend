const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const cloudStorage = require('../cloud-storage');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
const passportsDir = path.join(uploadsDir, 'passports');
const signaturesDir = path.join(uploadsDir, 'signatures');

// Ensure all directories exist with proper error handling
[uploadsDir, passportsDir, signaturesDir].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  } catch (error) {
    console.error(`❌ Error creating directory ${dir}:`, error);
  }
});

// Configure Multer for file uploads (memory storage for cloud compatibility)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Serve uploaded files
router.get('/uploads/passports/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads/passports', filename);
    res.sendFile(filePath);
});

// Database wrapper for consistent error handling
const withDB = (handler) => {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        message: 'Database error',
        error: error.message
      });
    }
  };
};

// Error handling middleware for Multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.'
      });
    }
    return res.status(400).json({
      success: false,
      message: 'File upload error.'
    });
  }
  
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed!'
    });
  }
  
  next(error);
};

// Get all users
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ dateAdded: -1 });
    
    const formattedUsers = users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      code: user.code,
      position: user.position,
      state: user.state,
      zone: user.zone,
      passportPhoto: user.passportPhoto || user.passport,
      signature: user.signature,
      dateAdded: user.dateAdded || user.createdAt,
      isActive: user.isActive,
      cardGenerated: user.cardGenerated,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
    
    res.json(formattedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
};

// Get all members (public)
const getMembers = async (req, res) => {
  try {
    const members = await User.find({ isActive: { $ne: false } })
      .select('-password')
      .sort({ dateAdded: -1 });
    
    const formattedMembers = members.map(member => ({
      _id: member._id,
      name: member.name,
      email: member.email,
      code: member.code,
      position: member.position,
      state: member.state,
      zone: member.zone,
      passportPhoto: member.passportPhoto || member.passport,
      signature: member.signature,
      dateAdded: member.dateAdded || member.createdAt,
      isActive: member.isActive,
      cardGenerated: member.cardGenerated,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt
    }));
    
    res.json({ success: true, members: formattedMembers });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get member by ID
const getMemberById = async (req, res) => {
  try {
    const member = await User.findById(req.params.id).select('-password');
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    res.json({ success: true, member });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Add user
const addUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      code,
      position = 'MEMBER',
      state,
      zone
    } = req.body;
    
    // Validation
    if (!name || !password || !code || !state || !zone) {
      return res.status(400).json({
        message: 'Name, password, code, state, and zone are required'
      });
    }
    
    // Check if code already exists
    const existingCode = await User.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      return res.status(400).json({ message: 'Code already exists' });
    }
    
    // Check if email already exists (if provided)
    if (email && email.trim()) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userData = {
      name: name.trim(),
      password: hashedPassword,
      code: code.toUpperCase().trim(),
      position,
      state: state.trim(),
      zone: zone.trim(),
      dateAdded: new Date(),
      cardGenerated: false
    };
    
    // Add email only if provided
    if (email && email.trim()) {
      userData.email = email.toLowerCase().trim();
    }
    
    // Add images if provided
    if (req.files && req.files.passportPhoto) {
      try {
        const passportFile = req.files.passportPhoto[0];
        console.log('📤 Saving passport photo:', passportFile.originalname);
        const passportResult = await cloudStorage.saveFile(passportFile, 'passportPhoto');
        userData.passportPhoto = passportResult.filename;
        userData.passport = passportResult.filename;
        userData.cardGenerated = true;
        console.log('✅ Passport photo saved:', passportResult.filename);
      } catch (error) {
        console.error('❌ Error saving passport photo:', error);
        // Don't throw error, just log it and continue without the photo
        console.log('⚠️ Continuing without passport photo due to save error');
      }
    }
    
    if (req.files && req.files.signature) {
      try {
        const signatureFile = req.files.signature[0];
        console.log('📤 Saving signature:', signatureFile.originalname);
        const signatureResult = await cloudStorage.saveFile(signatureFile, 'signature');
        userData.signature = signatureResult.filename;
        userData.cardGenerated = true;
        console.log('✅ Signature saved:', signatureResult.filename);
      } catch (error) {
        console.error('❌ Error saving signature:', error);
        // Don't throw error, just log it and continue without the signature
        console.log('⚠️ Continuing without signature due to save error');
      }
    }
    
    const user = new User(userData);
    await user.save();
    
    console.log('✅ User added successfully:', {
      name: user.name,
      code: user.code,
      passportPhoto: user.passportPhoto,
      signature: user.signature
    });
    
    res.json({ 
      message: 'User added successfully',
      data: {
        _id: user._id,
        name: user.name,
        code: user.code,
        passportPhoto: user.passportPhoto,
        signature: user.signature
      }
    });
  } catch (error) {
    console.error('Add user error:', error);
    if (error.code === 11000) {
      if (error.keyPattern.email) {
        res.status(400).json({ message: 'Email already exists' });
      } else if (error.keyPattern.code) {
        res.status(400).json({ message: 'Code already exists' });
      } else {
        res.status(400).json({ message: 'Duplicate entry found' });
      }
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: messages.join(', ') });
    } else {
      res.status(500).json({ message: 'Server error while adding user' });
    }
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('🔄 Update user request:', { id, updateData });
    console.log('📁 Files received:', req.files);
    
    // Get existing user to handle file cleanup
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Remove sensitive fields
    delete updateData.password;
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    // If code is being updated, make sure it's uppercase and unique
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase().trim();
      const existingCode = await User.findOne({
        code: updateData.code,
        _id: { $ne: id }
      });
      if (existingCode) {
        return res.status(400).json({ message: 'Code already exists' });
      }
    }
    
    // Handle passport photo update
    if (req.files && req.files.passportPhoto) {
      try {
        // Delete old passport photo if it exists
        if (existingUser.passportPhoto) {
          await cloudStorage.deleteFile(existingUser.passportPhoto, 'passportPhoto');
          console.log('🗑️ Deleted old passport photo:', existingUser.passportPhoto);
        }
        
        // Save new passport photo
        const passportFile = req.files.passportPhoto[0];
        const passportResult = await cloudStorage.saveFile(passportFile, 'passportPhoto');
        updateData.passportPhoto = passportResult.filename;
        updateData.passport = passportResult.filename;
        console.log('✅ New passport photo saved:', passportResult.filename);
      } catch (error) {
        console.error('❌ Error updating passport photo:', error);
        throw new Error('Failed to update passport photo');
      }
    }
    
    // Handle signature update
    if (req.files && req.files.signature) {
      try {
        // Delete old signature if it exists
        if (existingUser.signature) {
          await cloudStorage.deleteFile(existingUser.signature, 'signature');
          console.log('🗑️ Deleted old signature:', existingUser.signature);
        }
        
        // Save new signature
        const signatureFile = req.files.signature[0];
        const signatureResult = await cloudStorage.saveFile(signatureFile, 'signature');
        updateData.signature = signatureResult.filename;
        console.log('✅ New signature saved:', signatureResult.filename);
      } catch (error) {
        console.error('❌ Error updating signature:', error);
        throw new Error('Failed to update signature');
      }
    }
    
    // Update cardGenerated status if both images are provided
    if (req.files && req.files.passportPhoto && req.files.signature) {
      updateData.cardGenerated = true;
      console.log('✅ Both passport and signature provided, setting cardGenerated to true');
    }
    
    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('✅ User updated successfully:', {
      name: user.name,
      code: user.code,
      passportPhoto: user.passportPhoto,
      signature: user.signature
    });
    
    const responseData = { 
      message: 'User updated successfully', 
      user,
      data: {
        _id: user._id,
        name: user.name,
        code: user.code,
        passportPhoto: user.passportPhoto,
        signature: user.signature
      }
    };
    
    console.log('📤 Sending response:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Duplicate entry found' });
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: messages.join(', ') });
    } else {
      res.status(500).json({ message: 'Server error while updating user' });
    }
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user before deletion to handle file cleanup
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Delete associated files from storage
    try {
      if (user.passportPhoto) {
        await cloudStorage.deleteFile(user.passportPhoto, 'passportPhoto');
        console.log('🗑️ Deleted passport photo:', user.passportPhoto);
      }
      
      if (user.signature) {
        await cloudStorage.deleteFile(user.signature, 'signature');
        console.log('🗑️ Deleted signature:', user.signature);
      }
    } catch (fileError) {
      console.error('⚠️ Warning: Error deleting files:', fileError);
      // Continue with user deletion even if file deletion fails
    }
    
    // Delete user from database
    await User.findByIdAndDelete(id);
    
    console.log('✅ User deleted successfully:', {
      name: user.name,
      code: user.code,
      passportPhoto: user.passportPhoto,
      signature: user.signature
    });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error while deleting user' });
  }
};

// Delete all users
const deleteAllUsers = async (req, res) => {
  try {
    const result = await User.deleteMany({});
    
    res.json({ 
      message: `All users deleted successfully. ${result.deletedCount} users removed.`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete all users error:', error);
    res.status(500).json({ message: 'Server error while deleting all users' });
  }
};

// Bulk delete users
const bulkDeleteUsers = async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }
    
    // Get users before deletion to handle file cleanup
    const users = await User.find({ _id: { $in: userIds } });
    
    // Delete associated files from storage
    let deletedFiles = 0;
    for (const user of users) {
      try {
        if (user.passportPhoto) {
          await cloudStorage.deleteFile(user.passportPhoto, 'passportPhoto');
          deletedFiles++;
        }
        
        if (user.signature) {
          await cloudStorage.deleteFile(user.signature, 'signature');
          deletedFiles++;
        }
      } catch (fileError) {
        console.error(`⚠️ Warning: Error deleting files for user ${user._id}:`, fileError);
        // Continue with other files even if some fail
      }
    }
    
    // Delete users from database
    const result = await User.deleteMany({
      _id: { $in: userIds }
    });
    
    console.log(`✅ Bulk delete completed: ${result.deletedCount} users, ${deletedFiles} files`);
    
    res.json({
      message: `Successfully deleted ${result.deletedCount} users and ${deletedFiles} files`,
      deletedCount: result.deletedCount,
      deletedFiles: deletedFiles
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ message: 'Server error while deleting users' });
  }
};

// Search users
const searchUsers = async (req, res) => {
  try {
    const { query, filters = {} } = req.body;
    
    let searchCriteria = {};
    
    // Text search across multiple fields
    if (query && query.trim()) {
      const searchRegex = new RegExp(query.trim(), 'i');
      searchCriteria.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { code: searchRegex },
        { state: searchRegex },
        { zone: searchRegex }
      ];
    }
    
    // Apply filters
    if (filters.state) {
      searchCriteria.state = new RegExp(filters.state, 'i');
    }
    
    if (filters.position) {
      searchCriteria.position = filters.position;
    }
    
    if (filters.zone) {
      searchCriteria.zone = new RegExp(filters.zone, 'i');
    }
    
    if (filters.isActive !== undefined) {
      searchCriteria.isActive = filters.isActive;
    }
    
    const users = await User.find(searchCriteria)
      .select('-password')
      .sort({ dateAdded: -1 })
      .limit(100);
    
    res.json({
      users,
      count: users.length,
      query,
      filters
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ message: 'Server error while searching users' });
  }
};

// Export users
const exportUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ dateAdded: -1 });
    
    // Convert to CSV format
    const csvHeader = 'Name,Email,Code,Position,State,Zone,Date Added,Active,Card Generated\n';
    const csvData = users.map(user => {
      return [
        user.name,
        user.email,
        user.code,
        user.position,
        user.state,
        user.zone,
        user.dateAdded ? user.dateAdded.toISOString().split('T')[0] : '',
        user.isActive ? 'Yes' : 'No',
        user.cardGenerated ? 'Yes' : 'No'
      ].join(',');
    }).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=narap_users.csv');
    res.send(csvHeader + csvData);
  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({ message: 'Server error while exporting users' });
  }
};

// Verify member (public)
const verifyMember = async (req, res) => {
  try {
    const { code } = req.body;
    
    console.log('🔍 Frontend verification request for code:', code);
    
    if (!code) {
      return res.status(400).json({ 
        success: false,
        message: 'Code is required' 
      });
    }
    
    // Search for member by code (case insensitive)
    const member = await User.findOne({ 
      code: { $regex: new RegExp(`^${code}$`, 'i') },
      isActive: { $ne: false }
    }).select('-password');
    
    if (!member) {
      console.log('❌ Member not found for code:', code);
      return res.status(404).json({ 
        success: false,
        message: 'Member not found with this code. Please verify the code and try again.' 
      });
    }
    
    console.log('✅ Member found:', member.name, member.code);
    
    // Update last verification time
    member.lastVerification = new Date();
    await member.save();
    
    // Build proper URLs for photos - use environment variable or construct from request
    const baseUrl = process.env.BACKEND_URL || 
      `${req.protocol}://${req.get('host')}` || 
      'https://narap-backend.onrender.com';
    const passportPhotoUrl = member.passportPhoto || member.passport ? 
      `${baseUrl}/api/uploads/passports/${member.passportPhoto || member.passport}` : null;
    const signatureUrl = member.signature ? 
      `${baseUrl}/api/uploads/signatures/${member.signature}` : null;
    
    console.log('🔍 Photo URL construction debug:');
    console.log('  - Base URL:', baseUrl);
    console.log('  - Member passportPhoto field:', member.passportPhoto);
    console.log('  - Member passport field:', member.passport);
    console.log('  - Final passportPhotoUrl:', passportPhotoUrl);
    console.log('  - Member signature field:', member.signature);
    console.log('  - Final signatureUrl:', signatureUrl);

    res.json({
      success: true,
      message: 'Member found successfully',
      member: {
        _id: member._id,
        name: member.name,
        email: member.email,
        code: member.code,
        position: member.position || 'MEMBER',
        state: member.state,
        zone: member.zone,
        passportPhoto: passportPhotoUrl,
        signature: signatureUrl,
        dateAdded: member.dateAdded || member.createdAt,
        isActive: member.isActive !== false
      }
    });
  } catch (error) {
    console.error('❌ Member verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while verifying member' 
    });
  }
};

// Search user (legacy)
const searchUser = async (req, res) => {
  try {
    const { code } = req.body;
    
    console.log('🔍 Legacy searchUser request for code:', code);
    
    if (!code) {
      return res.status(400).json({ message: 'Code is required' });
    }
    
    const user = await User.findOne({ 
      code: { $regex: new RegExp(`^${code}$`, 'i') },
      isActive: { $ne: false }
    }).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Build proper URLs for photos - use environment variable or construct from request
    const baseUrl = process.env.BACKEND_URL || 
      `${req.protocol}://${req.get('host')}` || 
      'https://narap-backend.onrender.com';
    const passportPhotoUrl = user.passportPhoto || user.passport ? 
      `${baseUrl}/api/uploads/passports/${user.passportPhoto || user.passport}` : null;
    const signatureUrl = user.signature ? 
      `${baseUrl}/api/uploads/signatures/${user.signature}` : null;
    
    console.log('🔍 Legacy searchUser Photo URL construction debug:');
    console.log('  - Base URL:', baseUrl);
    console.log('  - User passportPhoto field:', user.passportPhoto);
    console.log('  - User passport field:', user.passport);
    console.log('  - Final passportPhotoUrl:', passportPhotoUrl);
    console.log('  - User signature field:', user.signature);
    console.log('  - Final signatureUrl:', signatureUrl);

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        code: user.code,
        position: user.position || 'MEMBER',
        state: user.state,
        zone: user.zone,
        passportPhoto: passportPhotoUrl,
        signature: signatureUrl,
        dateAdded: user.dateAdded || user.createdAt,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Legacy searchUser error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Routes
router.get('/getUsers', withDB(getUsers));
router.get('/members', withDB(getMembers));
router.get('/members/:id', withDB(getMemberById));
router.post('/addUser', upload.fields([{ name: 'passportPhoto', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), handleMulterError, withDB(addUser));
router.put('/updateUser/:id', upload.fields([{ name: 'passportPhoto', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), handleMulterError, withDB(updateUser));
router.delete('/deleteUser/:id', withDB(deleteUser));
router.delete('/deleteAllUsers', withDB(deleteAllUsers));
router.post('/users/bulk-delete', withDB(bulkDeleteUsers));
router.post('/users/search', withDB(searchUsers));
router.get('/users/export', withDB(exportUsers));
router.post('/users/import', upload.single('file'), withDB(importMembers));

// Minimal CSV parser (no commas inside fields support)
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return { headers: [], rows: [] };

  // Strip BOM and normalize headers
  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

  const rows = lines.slice(1).map((line, idx) => {
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = (cols[i] || '').trim());
    obj.__line = idx + 2; // for error reporting
    return obj;
  });

  return { headers, rows };
}

// Map common/expected header names to model fields (case-insensitive)
const headerMap = {
  name: ['name', 'full name', 'member name'],
  email: ['email', 'e-mail'],
  code: ['code', 'member code', 'narap code'],
  state: ['state'],
  position: ['position', 'position'],
  address: ['address'],
  zone: ['zone', 'zone'],
  passportUrl: ['passport url', 'passport', 'photo', 'passport_photo', 'passportphoto', 'passporturl']
};

function pickField(row, headers, key) {
  const candidates = headerMap[key] || [key];
  const found = candidates.find(alias => headers.includes(alias));
  return found ? row[found] || '' : '';
}

async function importMembers(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: "No CSV file uploaded. Use field name 'file'." });
    }

    const csvText = req.file.buffer.toString('utf8');
    const { headers, rows } = parseCSV(csvText);

    if (!headers.length) {
      return res.status(400).json({ success: false, message: 'Empty or invalid CSV content.' });
    }

    // Normalize headers to lowercase once
    const normalizedHeaders = headers.map(h => h.toLowerCase());

    const results = {
      processed: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const row of rows) {
      try {
        const name = pickField(row, normalizedHeaders, 'name');
        const emailRaw = pickField(row, normalizedHeaders, 'email');
        const code = pickField(row, normalizedHeaders, 'code');
        const state = pickField(row, normalizedHeaders, 'state');
        const position = pickField(row, normalizedHeaders, 'position');
        const address = pickField(row, normalizedHeaders, 'address');
        const zone = pickField(row, normalizedHeaders, 'zone');
        const passportUrl = pickField(row, normalizedHeaders, 'passportUrl');

        // Basic validation: need at least name + (state or code)
        if (!name || (!emailRaw && !code)) {
          results.skipped++;
          results.errors.push({
            line: row.__line,
            reason: 'Missing required identifier (need name + state or code)'
          });
          continue;
        }

        const email = emailRaw ? emailRaw.toLowerCase() : '';

        // Build filter for upsert
        let filter = null;
        if (email) filter = { email };
        else if (code) filter = { code };
        else {
          results.skipped++;
          results.errors.push({ line: row.__line, reason: 'No unique key (email/code) provided' });
          continue;
        }

        // Build update payload
        const update = {
          ...(name && { name }),
          ...(email && { email }),
          ...(code && { code }),
          ...(state && { state }),
          ...(position && { position }),
          ...(zone && { zone }),
          ...(passportUrl && { passportUrl }),
          lastUpdated: new Date()
        };

        const options = { upsert: true, new: true, setDefaultsOnInsert: true };

        // Find existing first to count imported vs updated
        const existing = await User.findOne(filter).select('_id');

        await User.findOneAndUpdate(filter, { $set: update }, options);

        if (existing) results.updated++;
        else results.imported++;

        results.processed++;
      } catch (err) {
        results.errors.push({
          line: row.__line,
          reason: err.message
        });
      }
    }

    return res.json({
      success: true,
      message: `Import complete. ${results.imported} new, ${results.updated} updated, ${results.skipped} skipped.`,
      summary: results.errors.length
        ? { errorCount: results.errors.length, sample: results.errors.slice(0, 5) }
        : undefined
    });
  } catch (error) {
    console.error('❌ Import members error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while importing members',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}


// Public routes (no authentication required)
router.post('/members/verify', withDB(verifyMember));
router.post('/searchUser', withDB(searchUser));

// Debug route to check what's in the database
router.get('/debug/users', withDB(async (req, res) => {
  try {
    const users = await User.find().select('name code passportPhoto passport signature');
    res.json({
      success: true,
      users: users.map(user => ({
        name: user.name,
        code: user.code,
        passportPhoto: user.passportPhoto,
        passport: user.passport,
        signature: user.signature
      }))
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ success: false, message: 'Debug error' });
  }
}));

// Route to update member passport photo by code
router.put('/updateMemberPhoto/:code', upload.single('passportPhoto'), handleMulterError, withDB(async (req, res) => {
  try {
    const { code } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No passport photo file provided' 
      });
    }
    
    // Find member by code
    const member = await User.findOne({ 
      code: { $regex: new RegExp(`^${code}$`, 'i') }
    });
    
    if (!member) {
      return res.status(404).json({ 
        success: false,
        message: 'Member not found with this code' 
      });
    }
    
    // Delete old passport photo if it exists
    if (member.passportPhoto) {
      try {
        await cloudStorage.deleteFile(member.passportPhoto, 'passportPhoto');
        console.log('🗑️ Deleted old passport photo:', member.passportPhoto);
      } catch (fileError) {
        console.error('⚠️ Warning: Error deleting old passport photo:', fileError);
        // Continue with new photo upload even if old photo deletion fails
      }
    }
    
    // Save new passport photo using Cloudinary
    try {
      const passportResult = await cloudStorage.saveFile(req.file, 'passportPhoto');
      member.passportPhoto = passportResult.filename;
      member.passport = passportResult.filename;
      member.cardGenerated = true;
      
      await member.save();
      
      console.log('✅ Member passport photo updated:', {
        name: member.name,
        code: member.code,
        passportPhoto: member.passportPhoto
      });
      
      res.json({
        success: true,
        message: 'Member passport photo updated successfully',
        data: {
          name: member.name,
          code: member.code,
          passportPhoto: member.passportPhoto
        }
      });
    } catch (fileError) {
      console.error('❌ Error saving new passport photo:', fileError);
      throw new Error('Failed to save passport photo');
    }
  } catch (error) {
    console.error('Update member photo error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating member photo' 
    });
  }
}));

module.exports = router; 
