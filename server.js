const express = require('express');
const mongoose = require('mongoose');
const serverless = require('serverless-http');
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS configuration...
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://narapdb.com.ng',
  'https://www.narapdb.com.ng',
  /\.vercel\.app$/,
  /\.onrender\.com$/,
];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    return isAllowed
      ? callback(null, true)
      : callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- STATIC FILES SECTION FOR RENDER ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ✅ FIXED Database Connection - Aggressive timeouts for serverless
// ✅ FIXED Database Connection - Updated for Mongoose 6+
const connectDB = async () => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB already connected');
      return mongoose.connection;
    }
    
    // Don't wait for pending connections, create new one
    if (mongoose.connection.readyState === 2) {
      console.log('⚠️ Closing pending connection...');
      await mongoose.connection.close();
    }
    
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGO_URI environment variable is not defined');
    }
    
    console.log('🔄 Connecting to MongoDB...');
    
    // Updated connection options (remove unsupported bufferMaxEntries)
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      socketTimeoutMS: 3000,
      maxPoolSize: 1,
      bufferCommands: false  // Keep this, but remove bufferMaxEntries
    });
    
    // Optional: Add event listeners for debugging
    mongoose.connection.on('connecting', () => console.log('Connecting to MongoDB...'));
    mongoose.connection.on('connected', () => console.log('MongoDB connected!'));
    mongoose.connection.on('error', (err) => console.error('MongoDB error:', err));
    
    console.log('✅ MongoDB connected successfully');
    return mongoose.connection;
    
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    return null;
  }
};

// Database Models (keep your existing schemas)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  position: {
    type: String,
    required: true,
    enum: [
      'PRESIDENT', 'DEPUTY PRESIDENT', 'WELFARE', 'PUBLIC RELATION OFFICER',
      'STATE WELFARE COORDINATOR', 'MEMBER', 'TASK FORCE', 'PROVOST MARSHAL 1',
      'PROVOST MARSHAL 2', 'VICE PRESIDENT (South West)', 'VICE PRESIDENT (South East)',
      'VICE PRESIDENT (South South)', 'VICE PRESIDENT (North West)', 'VICE PRESIDENT (North Central)',
      'VICE PRESIDENT (North East)', 'PUBLIC RELATION OFFICE', 'FINANCIAL SECRETARY',
      'SECRETARY', 'ASSISTANT SECRETARY', 'TREASURER', 'COORDINATOR', 'ASSISTANT FINANCIAL SECRETARY'
    ],
    default: 'MEMBER'
  },
  state: { type: String, required: true },
  zone: { type: String, required: true },
  passportPhoto: { type: String },
  signature: { type: String },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  cardGenerated: { type: Boolean, default: false },
  dateAdded: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.index({ state: 1 });
userSchema.index({ position: 1 });

const certificateSchema = new mongoose.Schema({
  number: { type: String, required: [true, 'Certificate number is required'], unique: true, uppercase: true, trim: true },
  recipient: { type: String, required: [true, 'Recipient name is required'], trim: true },
  email: { type: String, required: [true, 'Email is required'], lowercase: true, trim: true,
    validate: { validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: 'Please enter a valid email address' }
  },
  title: { type: String, required: [true, 'Certificate title is required'], trim: true },
  type: { type: String, required: true, enum: { values: ['membership', 'training', 'achievement', 'recognition', 'service'], message: 'Invalid certificate type' }, default: 'membership' },
  description: { type: String, trim: true },
  issueDate: { type: Date, required: [true, 'Issue date is required'], default: Date.now },
  validUntil: { type: Date, validate: { validator: function(v) { return !v || v > this.issueDate; }, message: 'Valid until date must be after issue date'}},
  status: { type: String, enum: { values: ['active', 'revoked', 'expired'], message: 'Invalid certificate status' }, default: 'active' },
  revokedAt: { type: Date },
  revokedBy: { type: String },
  revokedReason: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issuedBy: { type: String, default: 'NARAP Admin System' },
  serialNumber: { type: String, unique: true }
}, { timestamps: true });

certificateSchema.pre('save', function(next) {
  if (!this.serialNumber) {
    this.serialNumber = `NARAP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
  next();
});

certificateSchema.index({ email: 1 });
certificateSchema.index({ status: 1 });
certificateSchema.index({ recipient: 1 });

const User = mongoose.model('User', userSchema);
const Certificate = mongoose.model('Certificate', certificateSchema);

// ✅ Add this helper function instead:
const withDB = (handler) => {
  return async (req, res) => {
    try {
      const connection = await connectDB();
      if (!connection) {
        return res.status(503).json({
          success: false,
          message: 'Database connection failed'
        });
      }
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

// Request logging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// ==================== ROUTES ====================

// HTML Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'css', 'admin.css'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'js', 'admin.js'));
});

// ==================== AUTHENTICATION ENDPOINTS - FIXED ====================

// ✅ Wrap login with database connection
app.post('/api/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt received');
    
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ 
        success: false,
        message: "Email and password are required" 
      });
    }

    // Hardcoded admin login (no DB needed)
    if (email.toLowerCase().trim() === "admin@gmail.com" && password === "Password") {
      console.log('✅ Admin login successful');
      
      const token = jwt.sign(
        { userId: 'admin', email: email.toLowerCase().trim(), role: 'admin' },
        process.env.JWT_SECRET || 'fallback-secret-key',
        { expiresIn: '24h' }
      );
      
      return res.status(200).json({ 
        success: true,
        message: "Login successful",
        token,
        user: {
          email: email.toLowerCase().trim(),
          role: 'admin'
        }
      });
    }
    
    console.log('❌ Invalid credentials for:', email);
    return res.status(401).json({ 
      success: false,
      message: "Invalid credentials" 
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false,
      message: "Server error during login",
      error: error.message
    });
  }
});

// Health check endpoint - Add this for debugging
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Server is running'
  });
});

// Authentication Middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.userId === 'admin') {
      req.user = { _id: 'admin', email: decoded.email, role: 'admin' };
    } else {
      req.user = await User.findById(decoded.userId).select('-password');
    }
    
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ==================== KEEP ALL YOUR EXISTING ENDPOINTS ====================


// ✅ Use wrapper for database-dependent routes
app.get('/api/getUsers', withDB(async (req, res) => {
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
      passportPhoto: user.passportPhoto,
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
}));

// Add user (admin panel expects this endpoint)
app.post('/api/addUser', withDB(async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      code,
      position = 'MEMBER',
      state,
      zone,
      passportPhoto,
      signature
    } = req.body;
    
    // Validation
    if (!name || !email || !password || !code || !state || !zone) {
      return res.status(400).json({
        message: 'All required fields must be provided'
      });
    }
    
    // Check if code already exists
    const existingCode = await User.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      return res.status(400).json({ message: 'Code already exists' });
    }
    
    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      code: code.toUpperCase().trim(),
      position,
      state: state.trim(),
      zone: zone.trim(),
      dateAdded: new Date(),
      cardGenerated: !!(passportPhoto && signature)
    };
    
    // Add images if provided
    if (passportPhoto) {
      userData.passportPhoto = passportPhoto;
    }
    
    if (signature) {
      userData.signature = signature;
    }
    
    const user = new User(userData);
    await user.save();
    
    res.json({ message: 'User added successfully' });
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
}));

// Delete single user (admin panel expects this endpoint)
app.delete('/api/deleteUser/:id', withDB(async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error while deleting user' });
  }
}));

// Delete all users (admin panel expects this endpoint)
app.delete('/api/deleteAllUsers', withDB(async (req, res) => {
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
}));

// Update user (admin panel expects this endpoint)
app.put('/api/updateUser/:id', withDB(async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }
    
    // Remove sensitive fields that shouldn't be updated directly
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
    if (updateData.passportPhoto && updateData.signature) {
      updateData.cardGenerated = true;
    }
    
    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User updated successfully', user });
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
}));

// ==================== FRONTEND VERIFICATION ENDPOINTS ====================

// Member verification endpoint for public frontend
app.post('/api/members/verify', withDB(async (req, res) => {
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
        passportPhoto: member.passportPhoto,
        signature: member.signature,
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
}));

// Certificate verification endpoint for public frontend
app.post('/api/certificates/verify', withDB(async (req, res) => {
  try {
    const { certificateNumber } = req.body;
    
    console.log('🔍 Frontend certificate verification request for:', certificateNumber);
    
    if (!certificateNumber) {
      return res.status(400).json({ 
        success: false,
        message: 'Certificate number is required' 
      });
    }
    
    // Search for certificate by number (case insensitive)
    const certificate = await Certificate.findOne({ 
      number: { $regex: new RegExp(`^${certificateNumber}$`, 'i') }
    }).populate('userId', 'name email code');
    
    if (!certificate) {
      console.log('❌ Certificate not found for number:', certificateNumber);
      return res.status(404).json({ 
        success: false,
        message: 'Certificate not found with this number. Please verify the certificate number and try again.' 
      });
    }
    
    // Check if certificate is expired
    let status = certificate.status;
    if (certificate.validUntil && new Date() > certificate.validUntil && status === 'active') {
      status = 'expired';
      certificate.status = 'expired';
      await certificate.save();
    }
    
    console.log('✅ Certificate found:', certificate.number, status);
    
    res.json({
      success: true,
      message: 'Certificate verified successfully',
      certificate: {
        _id: certificate._id,
        certificateNumber: certificate.number,
        recipientName: certificate.recipient,
        title: certificate.title,
        type: certificate.type,
        description: certificate.description,
        dateIssued: certificate.issueDate || certificate.createdAt,
        validUntil: certificate.validUntil,
        status: status,
        issuedBy: certificate.issuedBy || 'NARAP Authority',
        revokedAt: certificate.revokedAt,
        revokedReason: certificate.revokedReason
      }
    });
  } catch (error) {
    console.error('❌ Certificate verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while verifying certificate' 
    });
  }
}));

// Legacy searchUser endpoint for backward compatibility
app.post('/api/searchUser', withDB(async (req, res) => {
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
    
    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        code: user.code,
        position: user.position || 'MEMBER',
        state: user.state,
        zone: user.zone,
        passportPhoto: user.passportPhoto || user.passport,
        signature: user.signature,
        dateAdded: user.dateAdded || user.createdAt,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Legacy searchUser error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}));

// ==================== CERTIFICATE MANAGEMENT ENDPOINTS ====================

// Get all certificates
app.get('/api/certificates', withDB(async (req, res) => {
  try {
    const certificates = await Certificate.find()
      .populate('userId', 'name email code')
      .sort({ createdAt: -1 });
    
    res.json(certificates);
  } catch (error) {
    console.error('Get certificates error:', error);
    res.status(500).json({ message: 'Server error while fetching certificates' });
  }
}));

// Issue new certificate
app.post('/api/certificates', withDB(async (req, res) => {
  try {
    const {
      number,
      recipient,
      email,
      title,
      type = 'membership',
      description,
      issueDate,
      validUntil,
      userId
    } = req.body;
    
    // Validation
    if (!number || !recipient || !email || !title) {
      return res.status(400).json({
        message: 'Certificate number, recipient, email, and title are required'
      });
    }
    
    // Check if certificate number already exists
    const existingCert = await Certificate.findOne({ 
      number: number.toUpperCase() 
    });
    if (existingCert) {
      return res.status(400).json({ 
        message: 'Certificate number already exists' 
      });
    }
    
    const certificateData = {
      number: number.toUpperCase().trim(),
      recipient: recipient.trim(),
      email: email.toLowerCase().trim(),
      title: title.trim(),
      type,
      description: description?.trim(),
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      userId: userId || null
    };
    
    const certificate = new Certificate(certificateData);
    await certificate.save();
    
    res.status(201).json({
      message: 'Certificate issued successfully',
      certificate
    });
  } catch (error) {
    console.error('Issue certificate error:', error);
    if (error.code === 11000) {
      res.status(400).json({ message: 'Certificate number already exists' });
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ message: messages.join(', ') });
    } else {
      res.status(500).json({ message: 'Server error while issuing certificate' });
    }
  }
}));

// Revoke certificate endpoint
app.put('/api/certificates/:id/revoke', withDB(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, revokedBy = 'Admin' } = req.body;
    
    console.log(`🚫 Revoking certificate ${id} with reason: ${reason}`);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid certificate ID format' });
    }
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ message: 'Revocation reason is required' });
    }
    
    const certificate = await Certificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    if (certificate.status === 'revoked') {
      return res.status(400).json({ message: 'Certificate is already revoked' });
    }
    
    const updatedCertificate = await Certificate.findByIdAndUpdate(
      id,
      {
        status: 'revoked',
        revokedAt: new Date(),
        revokedBy: revokedBy.trim(),
        revokedReason: reason.trim()
      },
      { new: true, runValidators: true }
    );
    
    console.log('✅ Certificate revoked successfully:', updatedCertificate.number);
    
    res.json({
      success: true,
      message: 'Certificate revoked successfully',
      certificate: updatedCertificate
    });
  } catch (error) {
    console.error('❌ Revoke certificate error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while revoking certificate' 
    });
  }
}));

// Delete certificate endpoint
app.delete('/api/certificates/:id', withDB(async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Deleting certificate ${id}`);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid certificate ID format' });
    }
    
    const certificate = await Certificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    // Store certificate info before deletion for logging
    const certificateInfo = {
      number: certificate.number,
      recipient: certificate.recipient,
      title: certificate.title
    };
    
    await Certificate.findByIdAndDelete(id);
    
    console.log('✅ Certificate deleted successfully:', certificateInfo.number);
    
    res.json({ 
      success: true,
      message: 'Certificate deleted successfully',
      deletedCertificate: certificateInfo
    });
  } catch (error) {
    console.error('❌ Delete certificate error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting certificate' 
    });
  }
}));

// ==================== ANALYTICS ENDPOINTS ====================

// Get dashboard statistics
app.get('/api/analytics/dashboard', withDB(async (req, res) => {
  try {
    const totalMembers = await User.countDocuments();
    const totalCertificates = await Certificate.countDocuments();
    const activeCertificates = await Certificate.countDocuments({ status: 'active' });
        const revokedCertificates = await Certificate.countDocuments({ status: 'revoked' });
    
    // Members added this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const newThisMonth = await User.countDocuments({
      createdAt: { $gte: thisMonth }
    });
    
    // Members by state
    const membersByState = await User.aggregate([
      { $group: { _id: '$state', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Members by position
    const membersByPosition = await User.aggregate([
      { $group: { _id: '$position', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      totalMembers,
      totalCertificates,
      activeCertificates,
      revokedCertificates,
      newThisMonth,
      membersByState,
      membersByPosition
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Server error while fetching analytics' });
  }
}));

// ==================== BULK OPERATIONS ====================

// Bulk delete users
app.post('/api/users/bulk-delete', withDB(async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }
    
    // Validate all IDs
    const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ 
        message: `Invalid user IDs: ${invalidIds.join(', ')}` 
      });
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
}));

// Bulk delete certificates
app.post('/api/certificates/bulk-delete', withDB(async (req, res) => {
  try {
    const { certificateIds } = req.body;
    
    if (!Array.isArray(certificateIds) || certificateIds.length === 0) {
      return res.status(400).json({ message: 'Certificate IDs array is required' });
    }
    
    // Validate all IDs
    const invalidIds = certificateIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ 
        message: `Invalid certificate IDs: ${invalidIds.join(', ')}` 
      });
    }
    
    const result = await Certificate.deleteMany({
      _id: { $in: certificateIds }
    });
    
    res.json({
      message: `Successfully deleted ${result.deletedCount} certificates`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete certificates error:', error);
    res.status(500).json({ message: 'Server error while deleting certificates' });
  }
}));

// ==================== FILE UPLOAD ENDPOINTS ====================

// Handle image uploads (for passport photos and signatures)
app.post('/api/upload/image', async (req, res) => {
  try {
    const { imageData, type } = req.body;
    
    if (!imageData || !type) {
      return res.status(400).json({ message: 'Image data and type are required' });
    }
    
    // Validate image type
    if (!['passport', 'signature'].includes(type)) {
      return res.status(400).json({ message: 'Invalid image type' });
    }
    
    // Here you could add image processing, validation, etc.
    // For now, we'll just return the data as-is
    
    res.json({
      message: 'Image uploaded successfully',
      imageUrl: imageData // In production, you'd save to cloud storage and return URL
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ message: 'Server error while uploading image' });
  }
});

// ==================== SEARCH AND FILTER ENDPOINTS ====================

// Advanced search for users
app.post('/api/users/search', withDB(async (req, res) => {
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
      .limit(100); // Limit results
    
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
}));

// Advanced search for certificates
app.post('/api/certificates/search', withDB(async (req, res) => {
  try {
    const { query, filters = {} } = req.body;
    
    let searchCriteria = {};
    
    // Text search across multiple fields
    if (query && query.trim()) {
      const searchRegex = new RegExp(query.trim(), 'i');
      searchCriteria.$or = [
        { number: searchRegex },
        { recipient: searchRegex },
        { email: searchRegex },
        { title: searchRegex },
        { description: searchRegex }
      ];
    }
    
    // Apply filters
    if (filters.status) {
      searchCriteria.status = filters.status;
    }
    
    if (filters.type) {
      searchCriteria.type = filters.type;
    }
    
    if (filters.dateFrom) {
      searchCriteria.issueDate = { $gte: new Date(filters.dateFrom) };
    }
    
    if (filters.dateTo) {
      if (searchCriteria.issueDate) {
        searchCriteria.issueDate.$lte = new Date(filters.dateTo);
      } else {
        searchCriteria.issueDate = { $lte: new Date(filters.dateTo) };
      }
    }
    
    const certificates = await Certificate.find(searchCriteria)
      .populate('userId', 'name email code')
      .sort({ createdAt: -1 })
      .limit(100); // Limit results
    
    res.json({
      certificates,
      count: certificates.length,
      query,
      filters
    });
  } catch (error) {
    console.error('Certificate search error:', error);
    res.status(500).json({ message: 'Server error while searching certificates' });
  }
}));

// ==================== EXPORT ENDPOINTS ====================

// Export users to CSV format
app.get('/api/users/export', withDB(async (req, res) => {
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
}));

// Export certificates to CSV format
app.get('/api/certificates/export', withDB(async (req, res) => {
  try {
    const certificates = await Certificate.find()
      .populate('userId', 'name email code')
      .sort({ createdAt: -1 });
    
    // Convert to CSV format
    const csvHeader = 'Certificate Number,Recipient,Email,Title,Type,Status,Issue Date,Valid Until,Issued By\n';
    const csvData = certificates.map(cert => {
      return [
        cert.number,
        cert.recipient,
        cert.email,
        cert.title,
        cert.type,
        cert.status,
        cert.issueDate ? cert.issueDate.toISOString().split('T')[0] : '',
        cert.validUntil ? cert.validUntil.toISOString().split('T')[0] : '',
        cert.issuedBy
      ].join(',');
    }).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=narap_certificates.csv');
    res.send(csvHeader + csvData);
  } catch (error) {
    console.error('Export certificates error:', error);
    res.status(500).json({ message: 'Server error while exporting certificates' });
  }
}));

// ==================== DEBUG ENDPOINT ====================

// Add this temporary debug endpoint
app.get('/api/debug', async (req, res) => {
  const start = Date.now();
  try {
    console.log('Debug: Starting connection test...');
    const connection = await connectDB();
    const duration = Date.now() - start;
    
    res.json({
      success: !!connection,
      duration: `${duration}ms`,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const duration = Date.now() - start;
    res.json({
      success: false,
      error: error.message,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error Handling
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: `API endpoint ${req.method} ${req.originalUrl} not found` });
});

app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({ message: messages.join(', ') });
  }
  if (error.code === 11000) {
    return res.status(400).json({ message: 'Duplicate entry found' });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format' });
  }
  res.status(500).json({ message: 'Internal server error' });
});

// Local development server
// ... existing code above ...

// ==================== START SERVER LOGIC ====================

// Unified server startup for Render/local environments
const startServer = async () => {
  try {
    const conn = await connectDB();
    if (!conn) throw new Error('❌ Database connection failed');
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('🔥 Failed to start server:', err.message);
    process.exit(1);
  }
};

// Start server for Render/local environments
if (process.env.RENDER || !process.env.VERCEL) {
  startServer();
}

// Serverless export for Vercel
if (process.env.VERCEL) {
  const handler = serverless(app);
  module.exports = handler;
} else {
  module.exports = app;
}





