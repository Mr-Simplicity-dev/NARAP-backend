const mongoose = require('mongoose');

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

module.exports = mongoose.model('User', userSchema); 