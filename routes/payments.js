const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Flutterwave = require('flutterwave-node-v3');

// Import your existing utilities
const { 
    canAddMember, 
    canAddCertificate, 
    initializeLimitsFromCurrentData, 
    increaseLimits 
} = require('../utils/limitsChecker');

// Flutterwave configuration
const flw = new Flutterwave(
    process.env.FLUTTERWAVE_PUBLIC_KEY,
    process.env.FLUTTERWAVE_SECRET_KEY
);

const FLUTTERWAVE_CONFIG = {
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
    encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY,
    baseUrl: process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.com/v3'
};

// Get payment configuration (public keys only)
router.get('/payment-config', (req, res) => {
    res.json({
        publicKey: FLUTTERWAVE_CONFIG.publicKey,
        baseUrl: FLUTTERWAVE_CONFIG.baseUrl
    });
});

// Initialize payment
router.post('/initialize-payment', async (req, res) => {
    try {
        const { 
            amount, 
            type, 
            customerEmail = 'admin@narap.org.ng', 
            customerName = 'NARAP Admin',
            metadata = {}
        } = req.body;
        
        const txRef = `NARAP_${type}_${Date.now()}`;
        
        let description = '';
        if (type === 'idcard') {
            description = `ID Card Payment - Increase Member Capacity by ${metadata.capacityIncrease || amount}`;
        } else if (type === 'certificate') {
            description = `Certificate Payment - Increase Certificate Capacity by ${metadata.capacityIncrease || amount}`;
        } else if (type === 'database') {
            description = `Database Hosting Payment - ${metadata.plan || 'monthly'} plan`;
        }

        const payload = {
            tx_ref: txRef,
            amount: amount,
            currency: 'NGN',
            redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-callback`,
            customer: {
                email: customerEmail,
                name: customerName
            },
            customizations: {
                title: 'NARAP Payment',
                description: description,
                logo: 'images/narap-logo.jpg'
            },
            meta: {
                payment_type: type,
                ...metadata
            }
        };

        const response = await flw.StandardSubaccount.create(payload);
        
        if (response.status === 'success') {
            // Save payment record as pending
            const payment = new Payment({
                type: type,
                amount: amount,
                paymentMethod: 'card',
                status: 'pending',
                txRef: txRef,
                customerName: customerName,
                customerEmail: customerEmail,
                paymentDescription: description,
                metadata: metadata
            });
            
            await payment.save();
            
            res.json({
                success: true,
                data: response.data,
                payment_link: response.data.link,
                tx_ref: txRef
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to initialize payment'
            });
        }
    } catch (error) {
        console.error('Payment initialization error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment initialization failed',
            error: error.message
        });
    }
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

// Verify payment with Flutterwave
router.post('/verify-payment', async (req, res) => {
    try {
        const {
            transaction_id,
            tx_ref,
            status,
            amount,
            slots_to_add,
            payment_type,
            usd_amount,
            cost_per_slot_usd,
            exchange_rate,
            ngn_amount
        } = req.body;

        console.log('🔍 Verifying USD-based payment:', transaction_id);
        console.log('Payment details:', {
            payment_type,
            usd_amount,
            exchange_rate,
            expected_ngn: ngn_amount,
            slots_to_add
        });

        // Verify with Flutterwave API
        const response = await flw.Transaction.verify({ id: transaction_id });
        
        if (response.status === 'success' && response.data.status === 'successful' && response.data.tx_ref === tx_ref) {
            // Validate amount matches expected NGN calculation from USD
            let expectedNgnAmount = Math.round(usd_amount * exchange_rate);
            
            // Allow small variance for exchange rate fluctuations (₦50)
            const variance = 50;
            if (Math.abs(response.data.amount - expectedNgnAmount) > variance) {
                return res.status(400).json({
                    success: false,
                    message: `Amount mismatch. Expected: ₦${expectedNgnAmount.toLocaleString()}, Received: ₦${response.data.amount.toLocaleString()}`,
                    details: {
                        expected_usd: usd_amount,
                        exchange_rate: exchange_rate,
                        expected_ngn: expectedNgnAmount,
                        received_ngn: response.data.amount,
                        variance: Math.abs(response.data.amount - expectedNgnAmount)
                    }
                });
            }
            
            // Update payment record with USD and NGN details
            const payment = await Payment.findOneAndUpdate(
                { txRef: tx_ref },
                {
                    status: 'completed',
                    flutterwaveReference: transaction_id,
                    transactionReference: response.data.flw_ref,
                    amountPaid: response.data.amount, // NGN amount paid
                    paymentDate: new Date(response.data.created_at),
                    metadata: { 
                        ...response.data,
                        // USD-based pricing details
                        usd_amount: usd_amount,
                        cost_per_slot_usd: cost_per_slot_usd,
                        exchange_rate_used: exchange_rate,
                        ngn_equivalent: response.data.amount,
                        slots_added: slots_to_add,
                        payment_type: payment_type,
                        rate_fetched_at: new Date().toISOString(),
                        // Original Flutterwave data
                        flw_ref: response.data.flw_ref,
                        processor_response: response.data.processor_response,
                        card_details: response.data.card,
                        customer_details: response.data.customer
                    }
                },
                { new: true }
            );

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment record not found',
                    tx_ref: tx_ref
                });
            }

            console.log('✅ USD-based payment verified and saved:', {
                payment_id: payment._id,
                usd_amount: usd_amount,
                ngn_amount: response.data.amount,
                exchange_rate: exchange_rate,
                slots_added: slots_to_add
            });

            // Prepare response with comprehensive payment details
            const responseData = {
                success: true,
                message: 'Payment verified successfully',
                payment: {
                    id: payment._id,
                    type: payment_type,
                    status: payment.status,
                    flutterwaveReference: transaction_id,
                    transactionReference: response.data.flw_ref,
                    tx_ref: tx_ref
                },
                pricing_details: {
                    usd_amount: usd_amount,
                    cost_per_slot_usd: cost_per_slot_usd,
                    exchange_rate: exchange_rate,
                    ngn_amount_paid: response.data.amount,
                    slots_added: slots_to_add
                },
                flutterwave_data: {
                    transaction_id: response.data.id,
                    flw_ref: response.data.flw_ref,
                    status: response.data.status,
                    amount: response.data.amount,
                    currency: response.data.currency,
                    charged_amount: response.data.charged_amount,
                    app_fee: response.data.app_fee,
                    merchant_fee: response.data.merchant_fee,
                    processor_response: response.data.processor_response,
                    auth_model: response.data.auth_model,
                    ip: response.data.ip,
                    narration: response.data.narration,
                    created_at: response.data.created_at
                }
            };

            res.json(responseData);

        } else {
            console.error('❌ Payment verification failed:', {
                flw_status: response.status,
                transaction_status: response.data?.status,
                tx_ref_match: response.data?.tx_ref === tx_ref,
                expected_tx_ref: tx_ref,
                received_tx_ref: response.data?.tx_ref
            });

            res.status(400).json({
                success: false,
                message: 'Payment verification failed - payment not successful',
                details: {
                    flutterwave_status: response.status,
                    transaction_status: response.data?.status,
                    tx_ref_provided: tx_ref,
                    tx_ref_from_flutterwave: response.data?.tx_ref,
                    transaction_id: transaction_id
                }
            });
        }

    } catch (error) {
        console.error('💥 Payment verification error:', error);
        
        // Handle specific Flutterwave API errors
        if (error.response) {
            console.error('Flutterwave API Error:', {
                status: error.response.status,
                data: error.response.data
            });
            
            return res.status(500).json({
                success: false,
                message: 'Flutterwave API error during verification',
                error: error.response.data?.message || 'Unknown Flutterwave error',
                details: {
                    api_status: error.response.status,
                    transaction_id: transaction_id,
                    tx_ref: tx_ref
                }
            });
        }
        
        // Handle network or other errors
        res.status(500).json({
            success: false,
            message: 'Payment verification failed due to server error',
            error: error.message,
            details: {
                transaction_id: transaction_id,
                tx_ref: tx_ref,
                timestamp: new Date().toISOString()
            }
        });
    }
});


// Increase system limits after successful payment
router.post('/increase-limits', async (req, res) => {
    try {
        const {
            memberLimit,
            certificateLimit,
            flutterwaveReference,
            transactionReference,
            amountPaid,
            slotsAdded,
            costPerSlotUSD,
            usdAmount,
            exchangeRate
        } = req.body;

        console.log('🔍 Increasing limits with USD-based payment:', {
            memberLimit,
            certificateLimit,
            slotsAdded,
            usdAmount,
            exchangeRate,
            flutterwaveReference
        });

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
        
        // Log the activity with USD details
        console.log('✅ Limits updated successfully with USD pricing:', {
            memberLimit: `${oldMemberLimit} → ${newMemberLimit} (+${memberLimit || 0})`,
            certificateLimit: `${oldCertificateLimit} → ${newCertificateLimit} (+${certificateLimit || 0})`,
            usd_amount: usdAmount,
            exchange_rate: exchangeRate,
            ngn_paid: amountPaid,
            flutterwaveReference: flutterwaveReference
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
            payment_details: {
                slots_added: slotsAdded,
                cost_per_slot_usd: costPerSlotUSD,
                usd_amount: usdAmount,
                exchange_rate: exchangeRate,
                ngn_amount_paid: amountPaid,
                flutterwaveReference: flutterwaveReference
            },
            previous_limits: {
                memberLimit: oldMemberLimit,
                certificateLimit: oldCertificateLimit
            }
        });

    } catch (error) {
        console.error('💥 Limit increase error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to increase limits',
            error: error.message,
            details: {
                flutterwaveReference: flutterwaveReference,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// Database hosting activation
router.post('/database-hosting', async (req, res) => {
    try {
        const {
            plan,
            flutterwaveReference,
            transactionReference,
            amountPaid,
            paymentStatus,
            usdAmount,
            exchangeRate
        } = req.body;

        console.log('🔍 Activating database hosting with USD pricing:', {
            plan,
            usdAmount,
            exchangeRate,
            amountPaid,
            flutterwaveReference
        });

        if (paymentStatus !== 'successful') {
            return res.status(400).json({
                success: false,
                message: 'Payment not completed',
                payment_status: paymentStatus
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

        // Save database hosting payment with USD details
        const payment = new Payment({
            type: 'database',
            amount: amountPaid, // NGN amount paid
            paymentMethod: 'card',
            status: 'completed',
            flutterwaveReference: flutterwaveReference,
            transactionReference: transactionReference,
            amountPaid: amountPaid,
            paymentDate: now,
            paymentDescription: `Database hosting - ${plan} plan - $${usdAmount} (₦${amountPaid.toLocaleString()} at rate ₦${exchangeRate}/$1)`,
            plan: plan,
            duration: plan === 'monthly' ? '1 month' : '12 months',
            expiryDate: expiryDate,
            metadata: {
                usd_amount: usdAmount,
                exchange_rate: exchangeRate,
                ngn_amount: amountPaid,
                pricing_model: 'usd_based',
                rate_fetched_at: new Date().toISOString()
            }
        });

        await payment.save();

        console.log('✅ Database hosting activated with USD pricing:', {
            plan: plan,
            usd_amount: usdAmount,
            ngn_amount: amountPaid,
            exchange_rate: exchangeRate,
            expiry_date: expiryDate,
            flutterwaveReference: flutterwaveReference
        });

        res.json({
            success: true,
            message: 'Database hosting activated successfully',
            hosting_details: {
                plan: plan,
                duration: payment.duration,
                expiryDate: expiryDate.toISOString().split('T')[0],
                activated_at: now.toISOString()
            },
            payment_details: {
                usd_amount: usdAmount,
                exchange_rate: exchangeRate,
                ngn_amount: amountPaid,
                flutterwaveReference: flutterwaveReference,
                transactionReference: transactionReference
            }
        });

    } catch (error) {
        console.error('💥 Database hosting activation error:', error);
        res.status(500).json({
            success: false,
            message: 'Database hosting activation failed',
            error: error.message,
            details: {
                flutterwaveReference: flutterwaveReference,
                timestamp: new Date().toISOString()
            }
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

// Webhook endpoint for Flutterwave (optional but recommended)
router.post('/webhook', async (req, res) => {
    try {
        const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
        const signature = req.headers["verif-hash"];
        
        if (!signature || (signature !== secretHash)) {
            // This request isn't from Flutterwave; discard
            return res.status(401).end();
        }
        
        const payload = req.body;
        
        if (payload.event === "charge.completed") {
            // Update payment status in your database
            await Payment.findOneAndUpdate(
                { txRef: payload.data.tx_ref },
                {
                    status: 'completed',
                    flutterwaveReference: payload.data.id,
                    transactionReference: payload.data.flw_ref,
                    amountPaid: payload.data.amount,
                    paymentDate: new Date(payload.data.created_at)
                }
            );
            
            console.log('✅ Webhook: Payment updated via webhook');
        }
        
        res.status(200).end();
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).end();
    }
});

module.exports = router;

