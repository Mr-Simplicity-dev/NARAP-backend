const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, uppercase: true, trim: true },
  certificateNumber: { type: String, unique: true, sparse: true, trim: true }, // Added this field
  recipient: { type: String, required: true, trim: true },
  email: { type: String, required: false, lowercase: true, trim: true }, // Made optional
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
  serialNumber: { type: String, unique: true, sparse: true }
}, { timestamps: true });

certificateSchema.pre('save', function(next) {
  if (!this.serialNumber) {
    this.serialNumber = `NARAP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
  // Ensure certificateNumber is set to number if not provided
  if (!this.certificateNumber && this.number) {
    this.certificateNumber = this.number;
  }
  next();
});

module.exports = mongoose.model('Certificate', certificateSchema); 