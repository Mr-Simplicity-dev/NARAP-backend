const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['idcard', 'certificate', 'database']
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['bank_transfer', 'card', 'mobile_money', 'ussd', 'phone_number']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    unique: true
  },
  // Flutterwave specific fields (replace Monnify fields)
  flutterwaveReference: {
    type: String,
    unique: true,
    sparse: true
  },
  transactionReference: {
    type: String,
    sparse: true
  },
  txRef: {
    type: String,
    sparse: true
  },
  amountPaid: {
    type: Number
  },
  paymentDate: {
    type: Date
  },
  paymentDescription: {
    type: String
  },
  customerName: {
    type: String,
    default: 'NARAP Admin'
  },
  customerEmail: {
    type: String,
    default: 'admin@narap.org.ng'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  processedBy: {
    type: String,
    default: 'admin'
  },
  // Database hosting specific fields
  plan: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: function() { return this.type === 'database'; }
  },
  duration: {
    type: String,
    required: function() { return this.type === 'database'; }
  },
  expiryDate: {
    type: Date,
    required: function() { return this.type === 'database'; }
  }
}, { timestamps: true });

// Update indexes for Flutterwave
paymentSchema.index({ flutterwaveReference: 1 });
paymentSchema.index({ txRef: 1 });
paymentSchema.index({ transactionReference: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ type: 1 });

module.exports = mongoose.model('Payment', paymentSchema);