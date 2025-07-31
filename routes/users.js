const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const User = require('../models/User');
const bcrypt = require('bcrypt');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
const passportsDir = path.join(uploadsDir, 'passports');
const signaturesDir = path.join(uploadsDir, 'signatures');

[uploadsDir, passportsDir, signaturesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'passportPhoto') {
      cb(null, passportsDir);
    } else if (file.fieldname === 'signature') {
      cb(null, signaturesDir);
    } else {
      cb(null, uploadsDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
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
    res.json({ success: true, members });
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
    
    // Add email if provided
    if (email && email.trim()) {
      userData.email = email.toLowerCase().trim();
    }
    
    // Add images if provided
    if (req.files && req.files.passportPhoto) {
      const passportPath = req.files.passportPhoto[0].path.replace(/\\/g, '/'); // Convert Windows path to Unix
      const passportFilename = passportPath.split('/').pop(); // Extract just the filename
      userData.passportPhoto = passportFilename;
      userData.passport = passportFilename;
      userData.cardGenerated = true;
    }
    
    if (req.files && req.files.signature) {
      const signaturePath = req.files.signature[0].path.replace(/\\/g, '/'); // Convert Windows path to Unix
      const signatureFilename = signaturePath.split('/').pop(); // Extract just the filename
      userData.signature = signatureFilename;
      userData.cardGenerated = true;
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
    
    // Update cardGenerated status if images are provided
    if (req.files && req.files.passportPhoto && req.files.signature) {
      updateData.cardGenerated = true;
    }
    
    if (req.files && req.files.passportPhoto) {
      const passportPath = req.files.passportPhoto[0].path.replace(/\\/g, '/'); // Convert Windows path to Unix
      const passportFilename = passportPath.split('/').pop(); // Extract just the filename
      updateData.passportPhoto = passportFilename;
      updateData.passport = passportFilename;
    }
    
    if (req.files && req.files.signature) {
      const signaturePath = req.files.signature[0].path.replace(/\\/g, '/'); // Convert Windows path to Unix
      const signatureFilename = signaturePath.split('/').pop(); // Extract just the filename
      updateData.signature = signatureFilename;
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
    
    res.json({ 
      message: 'User updated successfully', 
      user,
      data: {
        _id: user._id,
        name: user.name,
        code: user.code,
        passportPhoto: user.passportPhoto,
        signature: user.signature
      }
    });
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
    
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
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
    
    const result = await User.deleteMany({
      _id: { $in: userIds }
    });
    
    res.json({
      message: `Successfully deleted ${result.deletedCount} users`,
      deletedCount: result.deletedCount
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
    
    // Build proper URLs for photos
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://narap-backend.onrender.com' 
      : `${req.protocol}://${req.get('host')}`;
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
    
    // Build proper URLs for photos
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://narap-backend.onrender.com' 
      : `${req.protocol}://${req.get('host')}`;
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
    
    // Update passport photo
    const passportPath = req.file.path.replace(/\\/g, '/');
    const passportFilename = passportPath.split('/').pop();
    
    member.passportPhoto = passportFilename;
    member.passport = passportFilename;
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
  } catch (error) {
    console.error('Update member photo error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating member photo' 
    });
  }
}));

module.exports = router; 