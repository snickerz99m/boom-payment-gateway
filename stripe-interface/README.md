# Stripe Payment Gateway - Enhanced Integration Documentation

## Overview

This enhanced Stripe integration provides advanced features for card validation and bulk processing with a dynamic user interface. The system is designed for real-world functionality, not just demo purposes.

## Key Features

### 1. Bulk Card Processing
- **Format Support**: Accepts cards in `cardnum|mm|yy|cvv` or `cardnum|mm|yyyy|cvv` format
- **Multi-line Input**: Process multiple cards simultaneously, one per line
- **Automatic Validation**: Real-time format validation with status feedback
- **Rate Limiting**: Built-in delays between requests to prevent API rate limiting

### 2. Delay and Threading Options
- **Configurable Delays**: Set delay time between processing requests (0-10 seconds)
- **Multi-threading Support**: Configure number of parallel processing threads (1-10)
- **Batch Processing**: Automatically processes cards in batches based on thread count
- **Rate Limiting Protection**: Built-in delays prevent API rate limiting

### 3. Real-time Stripe Key Validation
- **Format Validation**: Automatically validates `sk_live_` and `sk_test_` key formats
- **Live Status Check**: Verifies if the provided key is active and functional
- **Visual Feedback**: Clear success/error indicators with descriptive messages

### 4. Separate Result Categorization
- **Authorized Cards**: Successfully authorized cards (for $0 auth operations)
- **Charged Cards**: Successfully charged cards (for charge operations)
- **Declined Cards**: Cards declined with specific reasons (expired, stolen, etc.)
- **CVV Issues**: Cards with CVV verification problems (CCN cards)
- **Valid Cards**: Cards that are valid and ready for charging

### 5. Enhanced Error Handling
- **Detailed Decline Reasons**: Specific error messages for different failure types
- **Error Categorization**: Automatic sorting of errors by type (CVV, expired, stolen, etc.)
- **User-friendly Messages**: Clear, actionable error descriptions

### 6. Automatic Data Generation
- **Email Generation**: Realistic email addresses with various domain providers
- **Name Generation**: Diverse first and last name combinations
- **User Agent Rotation**: Multiple browser user agents for security
- **Customer Data**: Complete customer profiles for each transaction

### 7. Copy Functionality
- **Quick Copy**: One-click copy buttons for each result category
- **Formatted Output**: Results formatted for easy use in other systems
- **Clipboard Integration**: Direct copy to clipboard with visual feedback

## Usage Instructions

### Basic Setup

1. **Navigate to the interface**:
   ```bash
   cd stripe-interface
   php -S localhost:8080
   ```

2. **Access the interface**:
   Open `http://localhost:8080/index.html` in your browser

### Using the Interface

#### 1. Stripe Key Configuration
- Enter your Stripe secret key (`sk_live_` or `sk_test_`)
- The system will automatically validate the key format
- Live keys are detected and marked for production use

#### 2. Operation Types
- **$0 Authorization**: Authorize cards without charging (amount automatically set to $0)
- **Charge**: Immediately charge the specified amount
- **Auth & Capture**: Authorize first, then capture the payment

#### 3. Bulk Card Processing
Format your cards as follows:
```
4111111111111111|12|25|123
5555555555554444|01|26|456
378282246310005|03|2025|1234
6011111111111117|05|24|789
```

#### 4. Delay and Threading Configuration
- **Delay Between Requests**: Set time delay between processing each card (0-10 seconds)
- **Number of Threads**: Configure parallel processing threads (1-10)
- **Batch Processing**: Cards are automatically processed in batches based on thread count
- **Rate Limiting**: Built-in protection against API rate limiting

#### 5. Single Card Processing
If no bulk cards are provided, the system will use the single card fields:
- Card Number
- Expiry (MM/YY)
- CVV
- Cardholder Name (auto-generated if empty)

### Result Interpretation

#### Authorized Cards
```
4111****1111|12/25|123 - AUTHORIZED (Card authorized successfully)
```

#### Charged Cards
```
5555****4444|01/26|456 - CHARGED (Charged $29.99)
```

#### Declined Cards
```
3782****0005|03/25|1234 - EXPIRED (Card has expired)
6011****1117|05/24|789 - STOLEN (Card flagged as stolen/fraudulent)
```

#### CVV Issues
```
4000****0002|12/25|123 - CVV_ISSUE (CVV verification failed)
```

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

## Testing

### Test Cards
Use these test cards for development:
- **Visa**: `4111111111111111`
- **Mastercard**: `5555555555554444`
- **American Express**: `378282246310005`
- **Discover**: `6011111111111117`

### Running Tests
```bash
npm test -- tests/stripe-interface-enhanced.test.js
```

## File Structure

```
stripe-interface/
├── index.html          # Enhanced UI with bulk processing
├── app.js             # Enhanced JavaScript functionality
├── backend.php        # Enhanced PHP backend processing
├── proxy.js           # Proxy service (Node.js)
├── routes.js          # Express.js routes
└── README.md          # This documentation
```

## Troubleshooting

### Common Issues

1. **"Invalid Stripe key format"**
   - Ensure key starts with `sk_live_` or `sk_test_`
   - Check for typos or extra characters

2. **"Stripe key is dead or invalid"**
   - Verify the key is active in your Stripe dashboard
   - Check if the key has proper permissions

3. **"Rate limit exceeded"**
   - Wait for the rate limit to reset (1 minute)
   - Consider using delays between bulk requests

4. **"CVV verification failed"**
   - Check CVV format (3 digits for most cards, 4 for Amex)
   - Verify card number and CVV match

### Log Files
- Transaction logs: `payment_log.txt`
- Rate limit data: `rate_limit.json`
- Encryption key: `encryption.key`

## Support

For issues or questions:
1. Check the processing log for detailed error information
2. Verify Stripe key permissions and status
3. Review the troubleshooting section
4. Check network connectivity and proxy settings

## License

This software is provided as-is for educational and development purposes. Use responsibly and in compliance with applicable laws and regulations.