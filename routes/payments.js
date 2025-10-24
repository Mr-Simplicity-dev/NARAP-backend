const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const axios = require('axios');

// Import your existing utilities
const { 
    canAddMember, 
    canAddCertificate, 
    initializeLimitsFromCurrentData, 
    increaseLimits 
} = require('../utils/limitsChecker');


// Monnify configuration
const MONNIFY_CONFIG = {
    apiKey: process.env.MONNIFY_API_KEY,
    secretKey: process.env.MONNIFY_SECRET_KEY,
    contractCode: process.env.MONNIFY_CONTRACT_CODE,
    baseUrl: process.env.MONNIFY_BASE_URL || 'https://sandbox.monnify.com',
    mode: process.env.MONNIFY_MODE || 'LIVE'
};

// Get payment configuration (public keys only)
router.get('/payment-config', (req, res) => {
    res.json({
        apiKey: MONNIFY_CONFIG.apiKey,
        contractCode: MONNIFY_CONFIG.contractCode,
        mode: MONNIFY_CONFIG.mode
    });
});

// Get current limits status
router.get('/limits-status', async (req, res) => {
    try {
        const memberCheck = await canAddMember();
        const certificateCheck = await canAddCertificate();
        const limits = await initializeLimitsFromCurrentData();

        res.json({
            success: true,
            status: {
                members: {
                    current: memberCheck.currentCount || 0,
                    limit: memberCheck.limit || limits.memberLimit,
                    remaining: memberCheck.remaining || 0,
                    canAdd: memberCheck.allowed
                },
                certificates: {
                    current: certificateCheck.currentCount || 0,
                    limit: certificateCheck.limit || limits.certificateLimit,
                    remaining: certificateCheck.remaining || 0,
                    canAdd: certificateCheck.allowed
                }
            }
        });

    } catch (error) {
        console.error('Error getting limits status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get limits status',
            error: error.message
        });
    }
});

// Verify payment with Monnify
router.post('/verify-payment', async (req, res) => {
    try {
        const {
            paymentReference,
            transactionReference,
            paymentStatus,
            amountPaid,
            paymentType,
            metadata
        } = req.body;

        console.log('🔍 Verifying payment:', paymentReference);

        // For testing purposes, we'll accept the payment if status is PAID
        // In production, you should verify with Monnify API
        if (paymentStatus === 'PAID') {
            // Save payment record
            const payment = new Payment({
                type: paymentType,
                amount: metadata?.capacityIncrease || 0,
                paymentMethod: 'card',
                status: 'completed',
                paymentReference: paymentReference,
                transactionReference: transactionReference,
                amountPaid: amountPaid,
                paymentDate: new Date(),
                paymentDescription: `${paymentType} capacity increase`,
                metadata: metadata
            });

            await payment.save();

            console.log('✅ Payment verified and saved:', payment._id);

            res.json({
                success: true,
                message: 'Payment verified successfully',
                payment: payment
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Payment verification failed - payment not completed'
            });
        }

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment verification failed',
            error: error.message
        });
    }
});

// Increase system limits after successful payment
router.post('/increase-limits', async (req, res) => {
    try {
        const {
            memberLimit,
            certificateLimit,
            paymentReference,
            transactionReference,
            amountPaid
        } = req.body;

        console.log('🔍 Increasing limits:', { memberLimit, certificateLimit });

        // Get current limits before updating
        const currentLimits = await initializeLimitsFromCurrentData();
        const oldMemberLimit = currentLimits.memberLimit;
        const oldCertificateLimit = currentLimits.certificateLimit;
        
        // Calculate new limits (add to existing limits)
        let newMemberLimit = oldMemberLimit;
        let newCertificateLimit = oldCertificateLimit;
        
        if (memberLimit && memberLimit > 0) {
            newMemberLimit = oldMemberLimit + memberLimit;
        }
        
        if (certificateLimit && certificateLimit > 0) {
            newCertificateLimit = oldCertificateLimit + certificateLimit;
        }
        
        // Update limits using your existing function
        await increaseLimits(newMemberLimit, newCertificateLimit);
        
        // Log the activity
        console.log('✅ Limits updated successfully:', {
            memberLimit: `${oldMemberLimit} → ${newMemberLimit} (+${memberLimit || 0})`,
            certificateLimit: `${oldCertificateLimit} → ${newCertificateLimit} (+${certificateLimit || 0})`,
            paymentReference: paymentReference
        });

        res.json({
            success: true,
            message: 'Limits increased successfully',
            limits: {
                memberLimit: newMemberLimit,
                certificateLimit: newCertificateLimit,
                memberIncrease: memberLimit || 0,
                certificateIncrease: certificateLimit || 0
            },
            paymentReference: paymentReference
        });

    } catch (error) {
        console.error('Limit increase error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to increase limits',
            error: error.message
        });
    }
});

// Database hosting activation
router.post('/database-hosting', async (req, res) => {
    try {
        const {
            plan,
            paymentReference,
            transactionReference,
            amountPaid,
            paymentStatus
        } = req.body;

        console.log('🔍 Activating database hosting:', plan);

        if (paymentStatus !== 'PAID') {
            return res.status(400).json({
                success: false,
                message: 'Payment not completed'
            });
        }

        // Calculate expiry date
        const now = new Date();
        const expiryDate = new Date(now);
        
        if (plan === 'monthly') {
            expiryDate.setMonth(expiryDate.getMonth() + 1);
        } else if (plan === 'yearly') {
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        }

        // Save database hosting payment
        const payment = new Payment({
            type: 'database',
            amount: plan === 'monthly' ? 35 : 336,
            paymentMethod: 'card',
            status: 'completed',
            paymentReference: paymentReference,
            transactionReference: transactionReference,
            amountPaid: amountPaid,
            paymentDate: now,
            paymentDescription: `Database hosting - ${plan} plan`,
            plan: plan,
            duration: plan === 'monthly' ? '1 month' : '12 months',
            expiryDate: expiryDate
        });

        await payment.save();

        console.log('✅ Database hosting activated:', {
            plan: plan,
            expiryDate: expiryDate,
            paymentReference: paymentReference
        });

        res.json({
            success: true,
            message: 'Database hosting activated successfully',
            plan: plan,
            duration: payment.duration,
            expiryDate: expiryDate.toISOString().split('T')[0],
            paymentReference: paymentReference
        });

    } catch (error) {
        console.error('Database hosting activation error:', error);
        res.status(500).json({
            success: false,
            message: 'Database hosting activation failed',
            error: error.message
        });
    }
});

// Get database hosting status
router.get('/database-status', async (req, res) => {
    try {
        // Find the latest active database hosting payment
        const latestHosting = await Payment.findOne({
            type: 'database',
            status: 'completed',
            expiryDate: { $gt: new Date() }
        }).sort({ createdAt: -1 });

        if (latestHosting) {
            res.json({
                success: true,
                status: {
                    active: true,
                    plan: latestHosting.plan,
                    duration: latestHosting.duration,
                    expiryDate: latestHosting.expiryDate.toISOString().split('T')[0],
                    daysRemaining: Math.ceil((latestHosting.expiryDate - new Date()) / (1000 * 60 * 60 * 24))
                }
            });
        } else {
            res.json({
                success: true,
                status: {
                    active: false,
                    plan: null,
                    expiryDate: null,
                    daysRemaining: 0
                }
            });
        }

    } catch (error) {
        console.error('Database status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check database status'
        });
    }
});

// Get payment history
router.get('/payment-history', async (req, res) => {
    try {
        const { page = 1, limit = 10, type } = req.query;
        
        const filter = {};
        if (type) {
            filter.type = type;
        }

        const payments = await Payment.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Payment.countDocuments(filter);

        res.json({
            success: true,
            payments: payments,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total: total
        });

    } catch (error) {
        console.error('Payment history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payment history'
        });
    }
});

// Helper function to get Monnify access token (for production use)
async function getMonnifyAccessToken() {
    try {
        const auth = Buffer.from(`${MONNIFY_CONFIG.apiKey}:${MONNIFY_CONFIG.secretKey}`).toString('base64');
        
        const response = await axios.post(
            `${MONNIFY_CONFIG.baseUrl}/api/v1/auth/login`,
            {},
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.responseBody.accessToken;
    } catch (error) {
        console.error('Failed to get Monnify access token:', error);
        throw error;
    }
}

module.exports = router;



