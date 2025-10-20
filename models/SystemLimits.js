const mongoose = require('mongoose');

const systemLimitsSchema = new mongoose.Schema({
  memberLimit: { 
    type: Number, 
    required: true, 
    default: 1415  // Change this number whenever you want to increase/decrease
  },
  certificateLimit: { 
    type: Number, 
    required: true, 
    default: 1415   // Change this number whenever you want to increase/decrease
  },
  isActive: { 
    type: Boolean, 
    default: true  // Set to false to disable limits temporarily
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('SystemLimits', systemLimitsSchema);