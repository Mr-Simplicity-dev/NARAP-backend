const SystemLimits = require('../models/SystemLimits');
const User = require('../models/User');
const Certificate = require('../models/Certificate');

// Initialize limits based on current database counts
const initializeLimitsFromCurrentData = async () => {
  let limits = await SystemLimits.findOne();
  
  if (!limits) {
    // Get current counts from database
    const currentMemberCount = await User.countDocuments({ isActive: { $ne: false } });
    const currentCertificateCount = await Certificate.countDocuments({ status: { $ne: 'revoked' } });
    
    // Set limits to current counts (this freezes additions)
    limits = new SystemLimits({
      memberLimit: currentMemberCount,        // This will be 1415 for your case
      certificateLimit: currentCertificateCount, // Whatever your current certificate count is
      isActive: true
    });
    await limits.save();
    
    console.log('🔒 System limits initialized based on current data:', {
      memberLimit: limits.memberLimit,
      certificateLimit: limits.certificateLimit,
      message: 'No new additions allowed until limits are increased'
    });
  }
  return limits;
};

// Check if we can add a new member
const canAddMember = async () => {
  try {
    const limits = await initializeLimitsFromCurrentData();
    
    if (!limits.isActive) {
      return { allowed: true, message: 'Limits disabled' };
    }

    const currentCount = await User.countDocuments({ isActive: { $ne: false } });
    
    if (currentCount >= limits.memberLimit) {
      return {
        allowed: false,
        message: `❌ "Your member capacity is full. Please buy additional slots to continue adding new members.;: ${currentCount}, Limit: ${limits.memberLimit}. Contact admin to increase limit.`,
        currentCount,
        limit: limits.memberLimit
      };
    }

    return {
      allowed: true,
      message: `✅ Members: ${currentCount}/${limits.memberLimit} (${limits.memberLimit - currentCount} remaining)`,
      currentCount,
      limit: limits.memberLimit,
      remaining: limits.memberLimit - currentCount
    };
  } catch (error) {
    console.error('Error checking member limits:', error);
    return { allowed: true, message: 'Error checking limits, allowing operation' };
  }
};

// Check if we can add a new certificate
const canAddCertificate = async () => {
  try {
    const limits = await initializeLimitsFromCurrentData();
    
    if (!limits.isActive) {
      return { allowed: true, message: 'Limits disabled' };
    }

    const currentCount = await Certificate.countDocuments({ status: { $ne: 'revoked' } });
    
    if (currentCount >= limits.certificateLimit) {
      return {
        allowed: false,
        message: `❌ Your certificate capacity is full. Please buy additional slots to continue adding new members.; Current: ${currentCount}, Limit: ${limits.certificateLimit}. Contact admin to increase limit.`,
        currentCount,
        limit: limits.certificateLimit
      };
    }

    return {
      allowed: true,
      message: `✅ Certificates: ${currentCount}/${limits.certificateLimit} (${limits.certificateLimit - currentCount} remaining)`,
      currentCount,
      limit: limits.certificateLimit,
      remaining: limits.certificateLimit - currentCount
    };
  } catch (error) {
    console.error('Error checking certificate limits:', error);
    return { allowed: true, message: 'Error checking limits, allowing operation' };
  }
};

// Function to manually increase limits
const increaseLimits = async (newMemberLimit, newCertificateLimit) => {
  try {
    const limits = await initializeLimitsFromCurrentData();
    
    if (newMemberLimit !== undefined) {
      limits.memberLimit = newMemberLimit;
    }
    if (newCertificateLimit !== undefined) {
      limits.certificateLimit = newCertificateLimit;
    }
    
    await limits.save();
    
    console.log('🚀 Limits increased:', {
      memberLimit: limits.memberLimit,
      certificateLimit: limits.certificateLimit
    });
    
    return limits;
  } catch (error) {
    console.error('Error increasing limits:', error);
    throw error;
  }
};

module.exports = {
  canAddMember,
  canAddCertificate,
  initializeLimitsFromCurrentData,
  increaseLimits
};