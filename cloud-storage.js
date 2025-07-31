const fs = require('fs');
const path = require('path');

// Cloud storage configuration
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local'; // 'local', 'cloudinary', 'aws-s3'
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Base64 storage for cloud deployments (temporary solution)
const base64Storage = new Map();

class CloudStorage {
  constructor() {
    this.storageType = STORAGE_TYPE;
    this.isCloudDeployment = process.env.NODE_ENV === 'production' || 
                            process.env.RENDER || 
                            process.env.VERCEL ||
                            process.env.HEROKU;
    
    console.log(`🔧 Storage initialized: ${this.storageType} (Cloud: ${this.isCloudDeployment})`);
  }

  // Save file to appropriate storage
  async saveFile(file, fieldName) {
    try {
      if (this.isCloudDeployment) {
        return await this.saveToCloud(file, fieldName);
      } else {
        return await this.saveToLocal(file, fieldName);
      }
    } catch (error) {
      console.error('❌ File save error:', error);
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
    return {
      filename: filename,
      path: null,
      url: `/api/uploads/${fieldName === 'passportPhoto' ? 'passports' : 'signatures'}/${filename}`,
      storageType: 'cloud',
      base64Data: base64Data
    };
  }

  // Get file from storage
  async getFile(filename, fieldName) {
    try {
      if (this.isCloudDeployment) {
        return await this.getFromCloud(filename, fieldName);
      } else {
        return await this.getFromLocal(filename, fieldName);
      }
    } catch (error) {
      console.error('❌ File get error:', error);
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
    const fileData = base64Storage.get(filename);
    
    if (!fileData) {
      throw new Error(`File not found in cloud storage: ${filename}`);
    }

    const buffer = Buffer.from(fileData.data, 'base64');
    
    return {
      buffer: buffer,
      size: buffer.length,
      path: null,
      storageType: 'cloud',
      mimeType: fileData.mimeType
    };
  }

  // Delete file from storage
  async deleteFile(filename, fieldName) {
    try {
      if (this.isCloudDeployment) {
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

  // List files in storage
  async listFiles(fieldName = null) {
    try {
      if (this.isCloudDeployment) {
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

  // Get storage info
  getStorageInfo() {
    return {
      type: this.storageType,
      isCloudDeployment: this.isCloudDeployment,
      environment: process.env.NODE_ENV || 'development',
      render: !!process.env.RENDER,
      vercel: !!process.env.VERCEL,
      heroku: !!process.env.HEROKU
    };
  }
}

// Create singleton instance
const cloudStorage = new CloudStorage();

module.exports = cloudStorage; 