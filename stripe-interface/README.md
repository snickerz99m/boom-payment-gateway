# Stripe Payment Gateway - Advanced Security Interface

## Overview

This is a secure Stripe API integration with advanced security features, designed for processing payments with enhanced anonymity and security measures.

## Features

### 🔒 Security Features
- **AES-256 Encryption**: All sensitive data (card details, secret keys) is encrypted
- **Rate Limiting**: Prevents abuse with configurable limits (100 requests/minute)
- **User-Agent Rotation**: Rotates real user-agent strings for each request
- **Proxy Support**: Routes requests through configurable proxy servers
- **Random User Data**: Automatically generates valid email addresses and names
- **Fraud Prevention**: Built-in validation and security checks

### 💳 Payment Operations
- **$0 Authorization**: Validate card without charging
- **Direct Charge**: Immediate payment processing
- **Auth & Capture**: Two-step payment process

### 🌐 Proxy Configuration
- HTTP/HTTPS proxy support
- Authentication support (username/password)
- Automatic proxy health monitoring
- Failover and rotation

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and update the following:
```env
# Stripe Configuration
STRIPE_SECRET_KEY_TEST=sk_test_your_stripe_test_key_here
STRIPE_SECRET_KEY_LIVE=sk_live_your_stripe_live_key_here

# Proxy Configuration (Optional)
PROXY_CONFIG=[
  {
    "host": "proxy1.example.com",
    "port": 8080,
    "username": "user",
    "password": "pass",
    "protocol": "http"
  }
]
```

### 3. Start the Server
```bash
npm start
```

### 4. Access the Interface
Open your browser and navigate to:
- **New Stripe Interface**: `http://localhost:3000/stripe`
- **Original Admin Panel**: `http://localhost:3000/admin`

## Usage Guide

### Basic Payment Processing

1. **Access the Interface**
   - Navigate to `http://localhost:3000/stripe`
   - You'll see the secure payment interface

2. **Enter Payment Details**
   - **Stripe Secret Key**: Your test or live Stripe secret key
   - **Operation Type**: Choose from Auth, Charge, or Auth & Capture
   - **Amount**: Transaction amount in USD
   - **Card Details**: Enter card number, expiry, CVV, and cardholder name

3. **Optional Proxy Configuration**
   - Enter proxy host, port, username, and password if needed
   - The system will route requests through the proxy

4. **Process Payment**
   - Click "Process Payment"
   - The system will automatically:
     - Generate random customer data
     - Rotate user-agent strings
     - Encrypt sensitive data
     - Route through proxy (if configured)
     - Process the payment securely

### Operation Types

#### $0 Authorization
- Validates the card without charging
- Useful for card verification
- Amount is automatically set to $0.00

#### Charge
- Processes immediate payment
- Funds are captured immediately
- Standard payment processing

#### Auth & Capture
- Two-step process
- First authorizes the payment
- Then captures the funds
- Useful for delayed fulfillment

### Test Card Numbers

Use these test card numbers for development:

| Card Type | Number | Result |
|-----------|--------|---------|
| Visa | 4111111111111111 | Success |
| Visa | 4000000000000002 | Declined |
| Mastercard | 5555555555554444 | Success |
| American Express | 378282246310005 | Success |
| Discover | 6011111111111117 | Success |

## Security Features

### Data Encryption
- All sensitive data is encrypted using AES-256-GCM
- Encryption keys are automatically generated and stored securely
- No sensitive data is stored in plaintext

### Rate Limiting
- 100 requests per minute per IP address
- Automatic cleanup of old rate limit data
- Configurable limits

### User-Agent Rotation
- Automatically rotates between real browser user-agents
- Helps avoid detection and blocking
- Updated regularly with current browser versions

### Proxy Support
- Supports HTTP and HTTPS proxies
- Authentication support
- Health monitoring and failover
- Automatic proxy rotation

### Random Data Generation
- Generates realistic customer names and email addresses
- Automatic regeneration every 5 minutes
- Helps maintain anonymity

## API Documentation

### Endpoint: POST /stripe/api/stripe/process

**Request Body:**
```json
{
  "stripeSecretKey": "encrypted_stripe_key",
  "operation": "charge",
  "amount": 2999,
  "currency": "usd",
  "cardData": {
    "number": "4111111111111111",
    "expiry": "12/25",
    "cvv": "123",
    "holderName": "John Doe"
  },
  "proxyConfig": {
    "host": "proxy.example.com",
    "port": 8080,
    "username": "user",
    "password": "pass"
  },
  "description": "Test payment",
  "userAgent": "Mozilla/5.0...",
  "sessionId": "session_123"
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "pi_1234567890",
  "status": "succeeded",
  "amount": 29.99,
  "currency": "usd",
  "operation": "charge",
  "customer": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe123@gmail.com"
  }
}
```

## File Structure

```
stripe-interface/
├── index.html          # Main user interface
├── app.js              # Client-side JavaScript
├── proxy.js            # Proxy service (Node.js)
├── backend.php         # PHP backend (alternative)
├── routes.js           # Express.js routes
└── README.md           # This documentation
```

## Troubleshooting

### Common Issues

1. **Invalid Stripe Key**
   - Ensure your key starts with `sk_test_` or `sk_live_`
   - Check that the key is not expired

2. **Proxy Connection Failed**
   - Verify proxy host and port are correct
   - Check proxy authentication credentials
   - Ensure proxy is accessible from your server

3. **Rate Limit Exceeded**
   - Wait 1 minute before retrying
   - Consider reducing request frequency

4. **Card Validation Failed**
   - Use valid test card numbers
   - Check expiry date format (MM/YY)
   - Verify CVV is 3-4 digits

### Logging

All transactions are logged with:
- Timestamp
- IP address
- Operation type
- Amount and currency
- Success/failure status
- Transaction ID
- Session ID

## Security Best Practices

1. **Never store sensitive data in plaintext**
2. **Use test keys for development**
3. **Rotate API keys regularly**
4. **Monitor for suspicious activity**
5. **Use HTTPS in production**
6. **Keep proxy credentials secure**
7. **Regularly update user-agent strings**

## Production Deployment

### Security Checklist
- [ ] Use live Stripe keys
- [ ] Enable HTTPS/SSL
- [ ] Configure proper CORS settings
- [ ] Set up monitoring and alerting
- [ ] Configure backup systems
- [ ] Update rate limiting settings
- [ ] Secure proxy configurations

### Performance Optimization
- [ ] Enable gzip compression
- [ ] Set up CDN for static assets
- [ ] Configure load balancing
- [ ] Optimize database queries
- [ ] Set up caching

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the server logs
3. Test with different configurations
4. Verify network connectivity

## License

This software is provided as-is for educational and development purposes. Use responsibly and in compliance with applicable laws and regulations.