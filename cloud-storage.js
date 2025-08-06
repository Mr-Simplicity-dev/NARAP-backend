const fs = require('fs');
const path = require('path');

// Cloud storage configuration
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local'; // 'local', 'cloudinary', 'aws-s3'
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dh5wjtvlf';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '219556848713984';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '243__4G0WJVVPXmUULxAcZdjPJg';

// Initialize Cloudinary if credentials are available
let cloudinary = null;
if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  try {
    cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET
    });
    console.log('✅ Cloudinary initialized successfully');
  } catch (error) {
    console.error('❌ Cloudinary initialization failed:', error.message);
  }
}

// Base64 storage for cloud deployments (fallback)
const base64Storage = new Map();

class CloudStorage {
  constructor() {
    this.storageType = STORAGE_TYPE;
    
    // Improved cloud deployment detection
    this.isCloudDeployment = process.env.NODE_ENV === 'production' || 
                            process.env.RENDER || 
                            process.env.VERCEL ||
                            process.env.HEROKU ||
                            process.env.PORT || // Render sets PORT
                            process.env.RAILWAY_STATIC_URL || // Railway sets this
                            process.env.VERCEL_URL; // Vercel sets this
    
    // Force Cloudinary usage if credentials are available and we're in production
    this.useCloudinary = cloudinary !== null && (this.isCloudDeployment || process.env.NODE_ENV === 'production');
    
    // If Cloudinary is available, prefer it over local storage
    if (cloudinary !== null && this.storageType === 'local') {
      this.storageType = 'cloudinary';
    }
    
    console.log(`🔧 Storage initialized: ${this.storageType} (Cloud: ${this.isCloudDeployment}, Cloudinary: ${this.useCloudinary})`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Platform: ${process.env.RENDER ? 'Render' : process.env.VERCEL ? 'Vercel' : process.env.HEROKU ? 'Heroku' : 'Local'}`);
  }

  // Save file to appropriate storage
  async saveFile(file, fieldName) {
    try {
      // Prioritize Cloudinary if available
      if (this.useCloudinary && cloudinary !== null) {
        console.log('📤 Using Cloudinary for file upload');
        return await this.saveToCloudinary(file, fieldName);
      } else if (this.isCloudDeployment) {
        console.log('📤 Using cloud storage (base64) for file upload');
        return await this.saveToCloud(file, fieldName);
      } else {
        console.log('📤 Using local storage for file upload');
        return await this.saveToLocal(file, fieldName);
      }
    } catch (error) {
      console.error('❌ File save error:', error);
      
      // If Cloudinary fails, try fallback to cloud storage
      if (this.useCloudinary && this.isCloudDeployment) {
        console.log('🔄 Cloudinary failed, falling back to cloud storage...');
        try {
          return await this.saveToCloud(file, fieldName);
        } catch (fallbackError) {
          console.error('❌ Cloud storage fallback also failed:', fallbackError);
        }
      }
      
      throw error;
    }
  }

  // Save file locally (development)
  async saveToLocal(file, fieldName) {
    const uploadsDir = path.join(__dirname, 'uploads');
    const passportsDir = path.join(uploadsDir, 'passports');
    const signaturesDir = path.join(uploadsDir, 'signatures');

    // Ensure directories exist
    [uploadsDir, passportsDir, signaturesDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = file.fieldname + '-' + uniqueSuffix + ext;

    let targetDir;
    if (fieldName === 'passportPhoto') {
      targetDir = passportsDir;
    } else if (fieldName === 'signature') {
      targetDir = signaturesDir;
    } else {
      targetDir = uploadsDir;
    }

    const filePath = path.join(targetDir, filename);
    
    // Save file
    fs.writeFileSync(filePath, file.buffer);
    
    console.log(`✅ File saved locally: ${filePath}`);
    return {
      filename: filename,
      path: filePath,
      url: `/api/uploads/${fieldName === 'passportPhoto' ? 'passports' : 'signatures'}/${filename}`,
      storageType: 'local'
    };
  }

  // Save file to cloud storage (production)
  async saveToCloud(file, fieldName) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = file.fieldname + '-' + uniqueSuffix + ext;

    console.log(`📤 Saving file to cloud storage: ${filename} (${fieldName})`);
    console.log(`📊 File size: ${file.buffer.length} bytes`);
    console.log(`📋 MIME type: ${file.mimetype}`);

    // For now, use base64 storage as a temporary solution
    // In production, you should use Cloudinary, AWS S3, or similar
    const base64Data = file.buffer.toString('base64');
    const mimeType = file.mimetype;
    
    // Store in memory (temporary solution for Render)
    base64Storage.set(filename, {
      data: base64Data,
      mimeType: mimeType,
      fieldName: fieldName
    });

    console.log(`✅ File saved to cloud storage: ${filename}`);
    console.log(`📊 Total files in cloud storage: ${base64Storage.size}`);
    
    return {
      filename: filename,
      path: null,
      url: `/api/uploads/${fieldName === 'passportPhoto' ? 'passports' : 'signatures'}/${filename}`,
      storageType: 'cloud',
      base64Data: base64Data
    };
  }

  // Save file to Cloudinary
  async saveToCloudinary(file, fieldName) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = file.fieldname + '-' + uniqueSuffix + ext;

    console.log(`📤 Saving file to Cloudinary: ${filename} (${fieldName})`);
    console.log(`📊 File size: ${file.buffer.length} bytes`);
    console.log(`📋 MIME type: ${file.mimetype}`);
    console.log(`☁️ Cloud name: ${CLOUDINARY_CLOUD_NAME}`);

    try {
      const result = await new Promise((resolve, reject) => {
        // Add timeout to prevent hanging uploads
        const timeout = setTimeout(() => {
          reject(new Error('Cloudinary upload timeout after 30 seconds'));
        }, 30000);

        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `NARAP/${fieldName}`,
            public_id: filename,
            resource_type: 'auto',
            overwrite: true,
            use_filename: true,
            unique_filename: false,
            transformation: [{ width: 500, height: 500, crop: 'fill' }],
          },
          (error, result) => {
            clearTimeout(timeout);
            if (error) {
              console.error('❌ Cloudinary upload error:', error);
              reject(error);
            } else {
              console.log(`✅ File uploaded to Cloudinary: ${result.secure_url}`);
              resolve(result);
            }
          }
        );

        // Handle upload stream errors
        uploadStream.on('error', (error) => {
          clearTimeout(timeout);
          console.error('❌ Upload stream error:', error);
          reject(error);
        });

        uploadStream.end(file.buffer);
      });

      return {
        filename: filename,
        path: result.secure_url,
        url: result.secure_url,
        storageType: 'cloudinary',
        cloudinaryId: result.public_id
      };
    } catch (error) {
      console.error('❌ Cloudinary upload failed:', error);
      
      // If Cloudinary fails, fall back to local storage
      console.log('🔄 Falling back to local storage...');
      try {
        return await this.saveToLocal(file, fieldName);
      } catch (fallbackError) {
        console.error('❌ Fallback to local storage also failed:', fallbackError);
        throw new Error(`File upload failed: ${error.message}`);
      }
    }
  }

  // Get file from storage
  async getFile(filename, fieldName) {
    try {
      // Prioritize Cloudinary if available
      if (this.useCloudinary && cloudinary !== null) {
        console.log('🔍 Looking for file in Cloudinary');
        return await this.getFromCloudinary(filename, fieldName);
      } else if (this.isCloudDeployment) {
        console.log('🔍 Looking for file in cloud storage (base64)');
        return await this.getFromCloud(filename, fieldName);
      } else {
        console.log('🔍 Looking for file in local storage');
        return await this.getFromLocal(filename, fieldName);
      }
    } catch (error) {
      console.error('❌ File get error:', error);
      
      // If Cloudinary fails, try fallback to cloud storage
      if (this.useCloudinary && this.isCloudDeployment) {
        console.log('🔄 Cloudinary get failed, trying cloud storage fallback...');
        try {
          return await this.getFromCloud(filename, fieldName);
        } catch (fallbackError) {
          console.error('❌ Cloud storage fallback also failed:', fallbackError);
        }
      }
      
      throw error;
    }
  }

  // Get file from local storage
  async getFromLocal(filename, fieldName) {
    const uploadsDir = path.join(__dirname, 'uploads');
    let targetDir;
    
    if (fieldName === 'passportPhoto') {
      targetDir = path.join(uploadsDir, 'passports');
    } else if (fieldName === 'signature') {
      targetDir = path.join(uploadsDir, 'signatures');
    } else {
      targetDir = uploadsDir;
    }

    const filePath = path.join(targetDir, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);
    
    return {
      buffer: buffer,
      size: stats.size,
      path: filePath,
      storageType: 'local'
    };
  }

  // Get file from cloud storage
  async getFromCloud(filename, fieldName) {
    console.log(`🔍 Looking for file in cloud storage: ${filename} (${fieldName})`);
    console.log(`📊 Current cloud storage size: ${base64Storage.size} files`);
    
    const fileData = base64Storage.get(filename);
    
    if (!fileData) {
      // Log available files for debugging
      const availableFiles = [];
      for (const [key, value] of base64Storage.entries()) {
        if (value.fieldName === fieldName) {
          availableFiles.push(key);
        }
      }
      
      console.log(`❌ File not found in cloud storage: ${filename}`);
      console.log(`📋 Available ${fieldName} files:`, availableFiles);
      
      throw new Error(`File not found in cloud storage: ${filename}. Available ${fieldName} files: ${availableFiles.join(', ')}`);
    }

    console.log(`✅ File found in cloud storage: ${filename}`);
    const buffer = Buffer.from(fileData.data, 'base64');
    
    return {
      buffer: buffer,
      size: buffer.length,
      path: null,
      storageType: 'cloud',
      mimeType: fileData.mimeType
    };
  }

  // Get file from Cloudinary
  async getFromCloudinary(filename, fieldName) {
    console.log(`🔍 Looking for file in Cloudinary: ${filename} (${fieldName})`);
    try {
      // Try to get the resource directly by public_id
      const publicId = `NARAP/${fieldName}/${filename}`;
      const result = await cloudinary.api.resource(publicId, {
        resource_type: 'image'
      });

      console.log(`✅ File found in Cloudinary: ${result.secure_url}`);

      // For serving files, we return the URL directly since Cloudinary serves files
      return {
        buffer: null, // Cloudinary serves files directly
        size: result.bytes,
        path: result.secure_url,
        url: result.secure_url,
        storageType: 'cloudinary',
        mimeType: result.format
      };
    } catch (error) {
      console.error('❌ Cloudinary get failed:', error);
      throw new Error(`File not found in Cloudinary: ${filename}`);
    }
  }

  // Delete file from storage
  async deleteFile(filename, fieldName) {
    try {
      if (this.useCloudinary) {
        return await this.deleteFromCloudinary(filename);
      } else if (this.isCloudDeployment) {
        return await this.deleteFromCloud(filename);
      } else {
        return await this.deleteFromLocal(filename, fieldName);
      }
    } catch (error) {
      console.error('❌ File delete error:', error);
      throw error;
    }
  }

  // Delete file from local storage
  async deleteFromLocal(filename, fieldName) {
    const uploadsDir = path.join(__dirname, 'uploads');
    let targetDir;
    
    if (fieldName === 'passportPhoto') {
      targetDir = path.join(uploadsDir, 'passports');
    } else if (fieldName === 'signature') {
      targetDir = path.join(uploadsDir, 'signatures');
    } else {
      targetDir = uploadsDir;
    }

    const filePath = path.join(targetDir, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ File deleted locally: ${filePath}`);
      return true;
    }
    
    return false;
  }

  // Delete file from cloud storage
  async deleteFromCloud(filename) {
    const deleted = base64Storage.delete(filename);
    if (deleted) {
      console.log(`✅ File deleted from cloud storage: ${filename}`);
    }
    return deleted;
  }

  // Delete file from Cloudinary
  async deleteFromCloudinary(filename) {
    console.log(`🗑️ Deleting file from Cloudinary: ${filename}`);
    try {
      const result = await new Promise((resolve, reject) => {
        // Add timeout to prevent hanging deletes
        const timeout = setTimeout(() => {
          reject(new Error('Cloudinary delete timeout after 15 seconds'));
        }, 15000);

        cloudinary.uploader.destroy(filename, {
          type: 'upload',
          resource_type: 'image',
        }, (error, result) => {
          clearTimeout(timeout);
          if (error) {
            console.error('❌ Cloudinary delete error:', error);
            reject(error);
          } else {
            console.log(`✅ File deleted from Cloudinary: ${result.result}`);
            resolve(result);
          }
        });
      });
      
      return true;
    } catch (error) {
      console.error('❌ Cloudinary delete failed:', error);
      // Don't throw error, just return false to indicate failure
      return false;
    }
  }

  // List files in storage
  async listFiles(fieldName = null) {
    try {
      if (this.useCloudinary) {
        return await this.listCloudinaryFiles(fieldName);
      } else if (this.isCloudDeployment) {
        return await this.listCloudFiles(fieldName);
      } else {
        return await this.listLocalFiles(fieldName);
      }
    } catch (error) {
      console.error('❌ File list error:', error);
      throw error;
    }
  }

  // List files in local storage
  async listLocalFiles(fieldName = null) {
    const uploadsDir = path.join(__dirname, 'uploads');
    const passportsDir = path.join(uploadsDir, 'passports');
    const signaturesDir = path.join(uploadsDir, 'signatures');

    const files = {
      passports: [],
      signatures: [],
      total: 0
    };

    if (fs.existsSync(passportsDir)) {
      files.passports = fs.readdirSync(passportsDir);
    }
    
    if (fs.existsSync(signaturesDir)) {
      files.signatures = fs.readdirSync(signaturesDir);
    }

    files.total = files.passports.length + files.signatures.length;
    return files;
  }

  // List files in cloud storage
  async listCloudFiles(fieldName = null) {
    const files = {
      passports: [],
      signatures: [],
      total: 0
    };

    for (const [filename, fileData] of base64Storage.entries()) {
      if (fileData.fieldName === 'passportPhoto') {
        files.passports.push(filename);
      } else if (fileData.fieldName === 'signature') {
        files.signatures.push(filename);
      }
    }

    files.total = files.passports.length + files.signatures.length;
    return files;
  }

  // List files in Cloudinary
  async listCloudinaryFiles(fieldName = null) {
    console.log(`📋 Listing files in Cloudinary for ${fieldName}`);
    try {
      const result = await cloudinary.api.resources_by_tag(
        `NARAP/${fieldName}`,
        { max_results: 100 } // Adjust as needed
      );

      const files = {
        passports: [],
        signatures: [],
        total: result.total_count
      };

      result.resources.forEach(resource => {
        if (resource.public_id.includes('passportPhoto')) {
          files.passports.push(resource.public_id);
        } else if (resource.public_id.includes('signature')) {
          files.signatures.push(resource.public_id);
        }
      });

      console.log(`✅ Found ${files.total} files in Cloudinary for ${fieldName}`);
      return files;
    } catch (error) {
      console.error('❌ Cloudinary list failed:', error);
      throw error;
    }
  }

  // Get storage info
  getStorageInfo() {
    return {
      type: this.storageType,
      isCloudDeployment: this.isCloudDeployment,
      environment: process.env.NODE_ENV || 'development',
      render: !!process.env.RENDER,
      vercel: !!process.env.VERCEL,
      heroku: !!process.env.HEROKU,
      useCloudinary: this.useCloudinary
    };
  }
}

// Create singleton instance
const cloudStorage = new CloudStorage();

module.exports = cloudStorage; 