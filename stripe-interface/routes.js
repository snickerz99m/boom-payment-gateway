const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../src/utils/logger');
const ProxyService = require('./proxy');

const router = express.Router();

// Initialize proxy service
const proxyService = new ProxyService();

// Serve the Stripe interface
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Also handle /stripe/index.html
router.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static files
router.get('/app.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'app.js'));
});

router.get('/proxy.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'proxy.js'));
});

router.get('/backend.php', (req, res) => {
    res.sendFile(path.join(__dirname, 'backend.php'));
});

router.get('/README.md', (req, res) => {
    res.sendFile(path.join(__dirname, 'README.md'));
});

// API endpoint for Stripe payment processing
router.post('/api/stripe/process', async (req, res) => {
    try {
        logger.info('Processing Stripe payment request');
        
        const {
            stripeSecretKey,
            operation,
            amount,
            currency,
            cardData,
            customerData,
            proxyConfig,
            description,
            userAgent,
            sessionId,
            delayTime,
            threadCount
        } = req.body;
        
        // Validate required fields
        if (!stripeSecretKey || !operation || !amount || !currency || !cardData) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // Decrypt Stripe key (simple base64 decoding for demo)
        const decryptedKey = Buffer.from(stripeSecretKey, 'base64').toString('utf8');
        
        // Validate Stripe key format
        if (!decryptedKey.startsWith('sk_test_') && !decryptedKey.startsWith('sk_live_')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Stripe secret key format'
            });
        }
        
        // Generate random customer data if not provided
        const generatedCustomer = customerData || generateCustomerData();
        
        // Prepare Stripe payment data
        const paymentData = {
            amount: Math.round(amount), // Amount in cents
            currency: currency.toLowerCase(),
            payment_method_data: {
                type: 'card',
                card: {
                    number: cardData.number.replace(/\s+/g, ''),
                    exp_month: cardData.expiry ? parseInt(cardData.expiry.split('/')[0]) : 12,
                    exp_year: cardData.expiry ? parseInt('20' + cardData.expiry.split('/')[1]) : 2025,
                    cvc: cardData.cvv
                }
            },
            description: description || 'Payment processed via secure gateway',
            metadata: {
                customer_email: generatedCustomer.email,
                customer_name: generatedCustomer.firstName + ' ' + generatedCustomer.lastName,
                session_id: sessionId || generateSessionId(),
                operation_type: operation
            },
            confirm: true
        };
        
        // Set capture based on operation type
        if (operation === 'auth') {
            paymentData.capture_method = 'manual';
            paymentData.amount = 0; // $0 authorization
        } else if (operation === 'charge') {
            paymentData.capture_method = 'automatic';
        }
        
        // Make request to Stripe API
        const result = await makeStripeRequest(decryptedKey, paymentData, proxyConfig, userAgent);
        
        // Log transaction
        logTransaction(req.ip, operation, amount, currency, result.success, result.transactionId, sessionId);
        
        res.json({
            success: true,
            transactionId: result.transactionId,
            status: result.status,
            amount: amount / 100,
            currency: currency,
            operation: operation,
            customer: generatedCustomer
        });
        
    } catch (error) {
        logger.error('Stripe payment processing error:', error);
        
        res.status(500).json({
            success: false,
            error: error.message || 'Payment processing failed'
        });
    }
});

// Helper function to make Stripe API request
async function makeStripeRequest(stripeKey, paymentData, proxyConfig, userAgent) {
    const https = require('https');
    const querystring = require('querystring');
    
    const postData = querystring.stringify({
        ...flattenObject(paymentData)
    });
    
    const options = {
        hostname: 'api.stripe.com',
        port: 443,
        path: '/v1/payment_intents',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
            'User-Agent': userAgent || getRandomUserAgent(),
            'Stripe-Version': '2023-10-16'
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (res.statusCode >= 400) {
                        reject(new Error(response.error?.message || 'Stripe API error'));
                    } else {
                        resolve({
                            success: true,
                            transactionId: response.id,
                            status: response.status,
                            response: response
                        });
                    }
                } catch (error) {
                    reject(new Error('Failed to parse Stripe response'));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

// Helper function to flatten nested objects for form data
function flattenObject(obj, prefix = '') {
    const flattened = {};
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            const newKey = prefix ? `${prefix}[${key}]` : key;
            
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                Object.assign(flattened, flattenObject(value, newKey));
            } else {
                flattened[newKey] = value;
            }
        }
    }
    
    return flattened;
}

// Helper function to generate random customer data
function generateCustomerData() {
    const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    
    return {
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}@${domain}`,
        userAgent: getRandomUserAgent(),
        timestamp: Date.now()
    };
}

// Helper function to get random user agent
function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Helper function to generate session ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex');
}

// Helper function to log transactions
function logTransaction(ip, operation, amount, currency, success, transactionId, sessionId) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        ip,
        operation,
        amount,
        currency,
        success,
        transactionId,
        sessionId
    };
    
    logger.info('Stripe transaction logged:', logEntry);
}

module.exports = router;