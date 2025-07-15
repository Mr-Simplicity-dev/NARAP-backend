const express = require('express');
const mongoose = require('mongoose');
const serverless = require('serverless-http');
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
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

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- STATIC FILES SECTION ---
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads/passports');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for passport uploads
const passportStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/passports');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'passport-' + uniqueSuffix + ext);
    }
});

const uploadPassport = multer({ 
    storage: passportStorage,
    limits: { 
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});


// ✅ Database Connection
const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB already connected');
      return mongoose.connection;
    }
    
    if (mongoose.connection.readyState === 2) {
      console.log('⚠️ Closing pending connection...');
      await mongoose.connection.close();
    }
    
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGO_URI environment variable is not defined');
    }
    
    console.log('🔄 Connecting to MongoDB...');
    
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      socketTimeoutMS: 3000,
      maxPoolSize: 1,
      bufferCommands: false
    });
    
    console.log('✅ MongoDB connected successfully');
    return mongoose.connection;
    
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    return null;
  }
};

// Database Models
// Update the user schema to make email optional
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: false }, // Changed from required: true
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
  passport: { type: String },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  cardGenerated: { type: Boolean, default: false },
  dateAdded: { type: Date, default: Date.now }
}, { timestamps: true });

// Update certificate schema to make email optional
const certificateSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, uppercase: true, trim: true },
  recipient: { type: String, required: true, trim: true },
  email: { type: String, required: false, lowercase: true, trim: true }, // Changed from required: true
  title: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: ['membership', 'training', 'achievement', 'recognition', 'service'], default: 'membership' },
  description: { type: String, trim: true },
  issueDate: { type: Date, required: true, default: Date.now },
  validUntil: { type: Date },
  status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active' },
  revokedAt: { type: Date },
  revokedBy: { type: String },
  revokedReason: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  issuedBy: { type: String, default: 'NARAP Admin System' },
  serialNumber: { type: String, unique: true }
}, { timestamps: true });

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
  passport: { type: String },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  cardGenerated: { type: Boolean, default: false },
  dateAdded: { type: Date, default: Date.now }


const certificateSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, uppercase: true, trim: true },
  recipient: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: ['membership', 'training', 'achievement', 'recognition', 'service'], default: 'membership' },
  description: { type: String, trim: true },
  issueDate: { type: Date, required: true, default: Date.now },
  validUntil: { type: Date },
  status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active' },
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

const User = mongoose.model('User', userSchema);
const Certificate = mongoose.model('Certificate', certificateSchema);

// Database wrapper
const withDB = (handler) => {
  return async (req, res) => {
    try {
      const connection = await connectDB();
      if (!connection) {
        console.error('Database connection failed');
        return res.status(503).json({
          success: false,
          message: 'Database connection failed'
        });
      }
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      return await Promise.race([
        handler(req, res),
        timeoutPromise
      ]);
      
    } catch (error) {
      console.error('Database error:', error);
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message: 'Database error',
          error: error.message
        });
      }
    }
  };
};

// ==================== API ROUTES (MUST COME BEFORE CATCH-ALL) ====================

// Health check endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Server is running'
  });
});

app.get('/api/db-health', async (req, res) => {
  try {
    const conn = await connectDB();
    if (!conn) {
      return res.status(503).json({ 
        status: 'down', 
        message: 'Database connection failed' 
      });
    }
    
    const userCount = await User.countDocuments();
    
    res.json({
      status: 'healthy',
      userCount,
      readyState: mongoose.connection.readyState,
      dbName: mongoose.connection.name
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Update the login endpoint to ensure proper response
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
        },
        // Add this flag to trigger member loading
        shouldLoadMembers: true
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


// User management endpoints
app.get('/api/getUsers', withDB(async (req, res) => {
  try {
    console.log('📊 Fetching users from database...');
    
    const users = await User.find().select('-password').sort({ dateAdded: -1 }).lean();
    
    console.log(`✅ Found ${users.length} users`);
    
    const formattedUsers = users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      code: user.code,
      position: user.position,
      state: user.state,
      zone: user.zone,
      passportPhoto: user.passportPhoto || user.passport,
      passport: user.passport || user.passportPhoto,
      signature: user.signature,
      dateAdded: user.dateAdded || user.createdAt,
      isActive: user.isActive,
      cardGenerated: user.cardGenerated,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
    
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(formattedUsers);
    
  } catch (error) {
    console.error('❌ Get users error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        message: 'Server error while fetching users',
        error: error.message 
      });
    }
  }
}));

// Add this endpoint to handle /api/members calls
app.get('/api/members', withDB(async (req, res) => {
  try {
    console.log('📊 Fetching members from /api/members endpoint...');
    
    const users = await User.find().select('-password').sort({ dateAdded: -1 }).lean();
    
    console.log(`✅ Found ${users.length} members`);
    
    const formattedUsers = users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      code: user.code,
      position: user.position,
      state: user.state,
      zone: user.zone,
      passportPhoto: user.passportPhoto || user.passport,
      passport: user.passport || user.passportPhoto,
      signature: user.signature,
      dateAdded: user.dateAdded || user.createdAt,
      isActive: user.isActive !== false,
      cardGenerated: user.cardGenerated,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));
    
    // Return same format as /api/getUsers
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(formattedUsers);
    
  } catch (error) {
    console.error('❌ Get members error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        message: 'Server error while fetching members',
        error: error.message 
      });
    }
  }
}));


// Update the addUser endpoint to handle optional email and fix passport handling
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
    
    // Updated validation - email is now optional
    if (!name || !password || !code || !state || !zone) {
      return res.status(400).json({
        success: false,
        message: 'Name, password, code, state, and zone are required'
      });
    }
    
    const existingCode = await User.findOne({ code: code.toUpperCase() });
    if (existingCode) {
      return res.status(400).json({ 
        success: false,
        message: 'Code already exists' 
      });
    }
    
    // Only check email uniqueness if email is provided
    if (email && email.trim()) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return res.status(400).json({ 
          success: false,
          message: 'Email already exists' 
        });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userData = {
      name: name.trim(),
      password: hashedPassword,
      code: code.toUpperCase().trim(),
      position,
      state: state.trim(),
      zone: zone.trim(),
      dateAdded: new Date(),
      cardGenerated: !!(passportPhoto && signature)
    };
    
    // Only add email if provided
    if (email && email.trim()) {
      userData.email = email.toLowerCase().trim();
    }
    
    // Fix passport photo handling - ensure both fields are set
    if (passportPhoto) {
      userData.passportPhoto = passportPhoto;
      userData.passport = passportPhoto; // Ensure both fields have the same value
    }
    
    if (signature) {
      userData.signature = signature;
    }
    
    const user = new User(userData);
    await user.save();
    
    res.status(201).json({ 
      success: true,
      message: 'User added successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        code: user.code,
        position: user.position,
        state: user.state,
        zone: user.zone,
        passportPhoto: user.passportPhoto,
        passport: user.passport,
        signature: user.signature,
        dateAdded: user.dateAdded,
        isActive: user.isActive,
        cardGenerated: user.cardGenerated
      }
    });
  } catch (error) {
    console.error('Add user error:', error);
    if (error.code === 11000) {
      if (error.keyPattern.email) {
        res.status(400).json({ 
          success: false,
          message: 'Email already exists' 
        });
      } else if (error.keyPattern.code) {
        res.status(400).json({ 
          success: false,
          message: 'Code already exists' 
        });
      } else {
        res.status(400).json({ 
          success: false,
          message: 'Duplicate entry found' 
        });
      }
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ 
        success: false,
        message: messages.join(', ') 
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Server error while adding user' 
      });
    }
  }
}));

// Update certificate creation endpoint
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
    
    // Updated validation - email is now optional
    if (!number || !recipient || !title) {
      return res.status(400).json({
        success: false,
        message: 'Certificate number, recipient, and title are required'
      });
    }
    
    const existingCert = await Certificate.findOne({ 
      number: number.toUpperCase() 
    });
    if (existingCert) {
      return res.status(400).json({ 
        success: false,
        message: 'Certificate number already exists' 
      });
    }
    
    const certificateData = {
      number: number.toUpperCase().trim(),
      recipient: recipient.trim(),
      title: title.trim(),
      type,
      description: description?.trim(),
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      userId: userId || null
    };
    
    // Only add email if provided
    if (email && email.trim()) {
      certificateData.email = email.toLowerCase().trim();
    }
    
    const certificate = new Certificate(certificateData);
    await certificate.save();
    
    res.status(201).json({
      success: true,
      message: 'Certificate issued successfully',
      certificate
    });
  } catch (error) {
    console.error('Issue certificate error:', error);
    if (error.code === 11000) {
      res.status(400).json({ 
        success: false,
        message: 'Certificate number already exists' 
      });
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ 
        success: false,
        message: messages.join(', ') 
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Server error while issuing certificate' 
      });
    }
  }
}));

// Fix the member verification to ensure passport photo is returned correctly
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
    
    member.lastVerification = new Date();
    await member.save();
    
    // Ensure passport photo is properly returned
    const passportPhoto = member.passportPhoto || member.passport;
    
    res.json({
      success: true,
      message: 'Member found successfully',
      member: {
        _id: member._id,
        name: member.name,
        email: member.email || '', // Handle optional email
        code: member.code,
        position: member.position || 'MEMBER',
        state: member.state,
        zone: member.zone,
        passportPhoto: passportPhoto,
        passport: passportPhoto,
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

// Update searchUser endpoint similarly
app.post('/api/searchUser', withDB(async (req, res) => {
  try {
    const { code } = req.body;
    
    console.log('🔍 Legacy searchUser request for code:', code);
    
    if (!code) {
      return res.status(400).json({ 
        success: false,
        message: 'Code is required' 
      });
    }
    
    const user = await User.findOne({ 
      code: { $regex: new RegExp(`^${code}$`, 'i') },
      isActive: { $ne: false }
    }).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Ensure passport photo is properly returned
    const passportPhoto = user.passportPhoto || user.passport;
    
    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email || '', // Handle optional email
        code: user.code,
        position: user.position || 'MEMBER',
        state: user.state,
        zone: user.zone,
        passportPhoto: passportPhoto,
        passport: passportPhoto,
        signature: user.signature,
        dateAdded: user.dateAdded || user.createdAt,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Legacy searchUser error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
}));


app.delete('/api/deleteUser/:id', withDB(async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid user ID format' 
      });
    }
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Delete passport file if it exists
    if (user.passport && 
        user.passport !== 'images/default-avatar.png' &&
        !user.passport.startsWith('data:') &&
        !user.passport.startsWith('http')) {
        
        const filePath = path.join(__dirname, user.passport);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`Deleted passport file: ${filePath}`);
            } catch (fileError) {
                console.error('Error deleting passport file:', fileError);
            }
        }
    }
    
    await User.findByIdAndDelete(id);
    
    res.json({ 
        success: true,
        message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting user' 
    });
  }
}));

app.delete('/api/deleteAllUsers', withDB(async (req, res) => {
  try {
    const users = await User.find({});
    
    // Delete all passport files
    users.forEach(user => {
        if (user.passport && 
            user.passport !== 'images/default-avatar.png' &&
            !user.passport.startsWith('data:') &&
            !user.passport.startsWith('http')) {
            
            const filePath = path.join(__dirname, user.passport);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted passport file: ${filePath}`);
                } catch (fileError) {
                    console.error('Error deleting passport file:', fileError);
                }
            }
        }
    });
    
    const result = await User.deleteMany({});
    
    res.json({ 
      success: true,
      message: `All users deleted successfully. ${result.deletedCount} users removed.`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete all users error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting all users' 
    });
  }
}));

app.put('/api/updateUser/:id', withDB(async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid user ID format' 
      });
    }
    
    // Remove sensitive fields
    delete updateData.password;
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase().trim();
      const existingCode = await User.findOne({
        code: updateData.code,
        _id: { $ne: id }
      });
      if (existingCode) {
        return res.status(400).json({ 
          success: false,
          message: 'Code already exists' 
        });
      }
    }
    
    if (updateData.passportPhoto && updateData.signature) {
      updateData.cardGenerated = true;
    }
    
    if (updateData.passportPhoto) {
        updateData.passport = updateData.passportPhoto;
    }
    
    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'User updated successfully', 
      user 
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === 11000) {
      res.status(400).json({ 
        success: false,
        message: 'Duplicate entry found' 
      });
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ 
        success: false,
        message: messages.join(', ') 
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Server error while updating user' 
      });
    }
  }
}));

// File upload endpoints
app.post('/api/upload-passport', uploadPassport.single('passport'), withDB(async (req, res) => {
    try {
        const { memberId } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'No file uploaded' 
            });
        }
        
        if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
            // Delete uploaded file if invalid member ID
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
                success: false, 
                message: 'Valid member ID is required' 
            });
        }
        
        const passportPath = `uploads/passports/${req.file.filename}`;
        
        const currentMember = await User.findById(memberId);
        
        if (!currentMember) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ 
                success: false, 
                message: 'Member not found' 
            });
        }
        
        // Delete old passport file if it exists
        if (currentMember.passport && 
            currentMember.passport !== 'images/default-avatar.png' &&
            !currentMember.passport.startsWith('data:') &&
            !currentMember.passport.startsWith('http')) {
            const oldFilePath = path.join(__dirname, currentMember.passport);
            if (fs.existsSync(oldFilePath)) {
                try {
                    fs.unlinkSync(oldFilePath);
                    console.log(`Deleted old passport: ${oldFilePath}`);
                } catch (fileError) {
                    console.error('Error deleting old passport:', fileError);
                }
            }
        }
        
        const updatedUser = await User.findByIdAndUpdate(
            memberId,
            { 
                passport: passportPath,
                passportPhoto: passportPath,
                updatedAt: new Date(),
                cardGenerated: true
            },
            { new: true }
        );
        
        res.json({ 
            success: true, 
            message: 'Passport uploaded successfully',
            passportPath: passportPath,
            user: updatedUser
        });
        
    } catch (error) {
        console.error('Passport upload error:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Error cleaning up uploaded file:', cleanupError);
            }
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload passport: ' + error.message 
        });
    }
}));

app.delete('/api/delete-passport/:memberId', withDB(async (req, res) => {
    try {
        const { memberId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(memberId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid member ID' 
            });
        }
        
        const member = await User.findById(memberId);
        
        if (!member) {
            return res.status(404).json({ 
                success: false, 
                message: 'Member not found' 
            });
        }
        
        if (member.passport && 
            member.passport !== 'images/default-avatar.png' &&
            !member.passport.startsWith('data:') &&
            !member.passport.startsWith('http')) {
            const filePath = path.join(__dirname, member.passport);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted passport file: ${filePath}`);
                } catch (fileError) {
                    console.error('Error deleting passport file:', fileError);
                }
            }
        }
        
        await User.findByIdAndUpdate(
            memberId,
            { 
                $unset: { passport: "", passportPhoto: "" },
                $set: { updatedAt: new Date(), cardGenerated: false }
            }
        );
        
        res.json({ 
            success: true, 
            message: 'Passport deleted successfully' 
        });
        
    } catch (error) {
        console.error('Delete passport error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete passport: ' + error.message 
        });
    }
}));

// Member verification endpoints
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
        passportPhoto: member.passportPhoto || member.passport,
        passport: member.passport || member.passportPhoto,
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

app.post('/api/searchUser', withDB(async (req, res) => {
  try {
    const { code } = req.body;
    
    console.log('🔍 Legacy searchUser request for code:', code);
    
    if (!code) {
      return res.status(400).json({ 
        success: false,
        message: 'Code is required' 
      });
    }
    
    const user = await User.findOne({ 
      code: { $regex: new RegExp(`^${code}$`, 'i') },
      isActive: { $ne: false }
    }).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        code: user.code,
        position: user.position || 'MEMBER',
        state: user.state,
        zone: user.zone,
        passportPhoto: user.passportPhoto || user.passport,
        passport: user.passport || user.passportPhoto,
        signature: user.signature,
        dateAdded: user.dateAdded || user.createdAt,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Legacy searchUser error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
}));

// Certificate endpoints
app.get('/api/certificates', withDB(async (req, res) => {
  try {
    const certificates = await Certificate.find()
      .populate('userId', 'name email code')
      .sort({ createdAt: -1 });
    
    res.json(certificates);
  } catch (error) {
    console.error('Get certificates error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching certificates' 
    });
  }
}));

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
    
    if (!number || !recipient || !email || !title) {
      return res.status(400).json({
        success: false,
        message: 'Certificate number, recipient, email, and title are required'
      });
    }
    
    const existingCert = await Certificate.findOne({ 
      number: number.toUpperCase() 
    });
    if (existingCert) {
      return res.status(400).json({ 
        success: false,
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
      issueDate: issueDate ? new Date(issueDate) :      new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      userId: userId || null
    };
    
    const certificate = new Certificate(certificateData);
    await certificate.save();
    
    res.status(201).json({
      success: true,
      message: 'Certificate issued successfully',
      certificate
    });
  } catch (error) {
    console.error('Issue certificate error:', error);
    if (error.code === 11000) {
      res.status(400).json({ 
        success: false,
        message: 'Certificate number already exists' 
      });
    } else if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ 
        success: false,
        message: messages.join(', ') 
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Server error while issuing certificate' 
      });
    }
  }
}));

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

app.put('/api/certificates/:id/revoke', withDB(async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, revokedBy = 'Admin' } = req.body;
    
    console.log(`🚫 Revoking certificate ${id} with reason: ${reason}`);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid certificate ID format' 
      });
    }
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ 
        success: false,
        message: 'Revocation reason is required' 
      });
    }
    
    const certificate = await Certificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ 
        success: false,
        message: 'Certificate not found' 
      });
    }
    
    if (certificate.status === 'revoked') {
      return res.status(400).json({ 
        success: false,
        message: 'Certificate is already revoked' 
      });
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

app.delete('/api/certificates/:id', withDB(async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Deleting certificate ${id}`);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid certificate ID format' 
      });
    }
    
    const certificate = await Certificate.findById(id);
    if (!certificate) {
      return res.status(404).json({ 
        success: false,
        message: 'Certificate not found' 
      });
    }
    
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

// Analytics endpoint
app.get('/api/analytics/dashboard', withDB(async (req, res) => {
  try {
    const totalMembers = await User.countDocuments();
    const totalCertificates = await Certificate.countDocuments();
    const activeCertificates = await Certificate.countDocuments({ status: 'active' });
    const revokedCertificates = await Certificate.countDocuments({ status: 'revoked' });
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const newThisMonth = await User.countDocuments({
      createdAt: { $gte: thisMonth }
    });
    
    const membersByState = await User.aggregate([
      { $group: { _id: '$state', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    const membersByPosition = await User.aggregate([
      { $group: { _id: '$position', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
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
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching analytics' 
    });
  }
}));

// Bulk operations
app.post('/api/users/bulk-delete', withDB(async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'User IDs array is required' 
      });
    }
    
    const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid user IDs: ${invalidIds.join(', ')}` 
      });
    }
    
    const users = await User.find({ _id: { $in: userIds } });
    
    users.forEach(user => {
        if (user.passport && 
            user.passport !== 'images/default-avatar.png' &&
            !user.passport.startsWith('data:') &&
            !user.passport.startsWith('http')) {
            
            const filePath = path.join(__dirname, user.passport);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted passport file: ${filePath}`);
                } catch (fileError) {
                    console.error('Error deleting passport file:', fileError);
                }
            }
        }
    });
    
    const result = await User.deleteMany({
      _id: { $in: userIds }
    });
    
    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} users`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting users' 
    });
  }
}));

app.post('/api/certificates/bulk-delete', withDB(async (req, res) => {
  try {
    const { certificateIds } = req.body;
    
    if (!Array.isArray(certificateIds) || certificateIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Certificate IDs array is required' 
      });
    }
    
    const invalidIds = certificateIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: `Invalid certificate IDs: ${invalidIds.join(', ')}` 
      });
    }
    
    const result = await Certificate.deleteMany({
      _id: { $in: certificateIds }
    });
    
    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} certificates`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete certificates error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting certificates' 
    });
  }
}));

// Search endpoints
app.post('/api/users/search', withDB(async (req, res) => {
  try {
    const { query, filters = {} } = req.body;
    
    let searchCriteria = {};
    
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
      success: true,
      users,
      count: users.length,
      query,
      filters
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while searching users' 
    });
  }
}));

app.post('/api/certificates/search', withDB(async (req, res) => {
  try {
    const { query, filters = {} } = req.body;
    
    let searchCriteria = {};
    
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
      .limit(100);
    
    res.json({
      success: true,
      certificates,
      count: certificates.length,
      query,
      filters
    });
  } catch (error) {
    console.error('Certificate search error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while searching certificates' 
    });
  }
}));

// Export endpoints
app.get('/api/users/export', withDB(async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ dateAdded: -1 });
    
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
    res.status(500).json({ 
      success: false,
      message: 'Server error while exporting users' 
    });
  }
}));

app.get('/api/certificates/export', withDB(async (req, res) => {
  try {
    const certificates = await Certificate.find()
      .populate('userId', 'name email code')
      .sort({ createdAt: -1 });
    
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
    res.status(500).json({ 
      success: false,
      message: 'Server error while exporting certificates' 
    });
  }
}));

// Image upload endpoint
app.post('/api/upload/image', async (req, res) => {
  try {
    const { imageData, type } = req.body;
    
    if (!imageData || !type) {
      return res.status(400).json({ 
        success: false,
        message: 'Image data and type are required' 
      });
    }
    
    if (!['passport', 'signature'].includes(type)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid image type' 
      });
    }
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageData
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while uploading image' 
    });
  }
});

// Debug endpoint
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

// ==================== STATIC ROUTES (AFTER API ROUTES) ====================

// Serve admin.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'admin.html'));
});

// Serve admin.html for /admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicPath, 'admin.html'));
});

// ==================== ERROR HANDLING ====================

// Multer error handling
app.use((error, req, res, next) => {
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
    }
    
    if (error.message === 'Only image files are allowed!') {
        return res.status(400).json({
            success: false,
            message: 'Only image files are allowed!'
        });
    }
    
    console.error('Unhandled error:', error);
    next(error);
});

// API 404 handler - MUST come before catch-all
app.use('/api/*', (req, res) => {
  console.log(`❌ API endpoint not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false,
    message: `API endpoint ${req.method} ${req.originalUrl} not found` 
  });
});

// Catch-all route for SPA - MUST be last
app.get('*', (req, res) => {
  console.log(`📄 Serving admin.html for: ${req.originalUrl}`);
  res.sendFile(path.join(publicPath, 'admin.html'));
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  if (res.headersSent) {
    return next(error);
  }
  
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({ 
      success: false,
      message: messages.join(', ') 
    });
  }
  
  if (error.code === 11000) {
    return res.status(400).json({ 
      success: false,
      message: 'Duplicate entry found' 
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({ 
      success: false,
      message: 'Invalid ID format' 
    });
  }
  
  res.status(500).json({ 
    success: false,
    message: 'Internal server error' 
  });
});

// ==================== UTILITY FUNCTIONS ====================

// Cleanup orphaned passport files
async function cleanupOrphanedPassports() {
    try {
        const uploadsDir = path.join(__dirname, 'uploads/passports');
        if (!fs.existsSync(uploadsDir)) return;
        
        const files = fs.readdirSync(uploadsDir);
        const users = await User.find({}).select('passport passportPhoto');
        
        const usedPassports = users
            .filter(user => {
                const passport = user.passport || user.passportPhoto;
                return passport && passport.startsWith('uploads/passports/');
            })
            .map(user => {
                const passport = user.passport || user.passportPhoto;
                return path.basename(passport);
            });
        
        files.forEach(file => {
            if (!usedPassports.includes(file)) {
                const filePath = path.join(uploadsDir, file);
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Cleaned up orphaned passport: ${file}`);
                } catch (error) {
                    console.error(`Error deleting orphaned file ${file}:`, error);
                }
            }
        });
        
    } catch (error) {
        console.error('Error cleaning up orphaned passports:', error);
    }
}

// Run cleanup periodically - every 24 hours
setInterval(cleanupOrphanedPassports, 24 * 60 * 60 * 1000);

// ==================== SERVER STARTUP ====================

const startServer = async () => {
  try {
    const conn = await connectDB();
    if (!conn) throw new Error('❌ Database connection failed');
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📁 Uploads directory: ${uploadsDir}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 API endpoints available at: /api/*`);
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

