# Enhanced Stripe Integration Documentation

## Overview

This enhanced Stripe integration provides advanced features for card validation and bulk processing with a dynamic user interface. The system is designed for real-world functionality, not just demo purposes.

## Key Features

### 1. Bulk Card Processing
- **Format Support**: Accepts cards in `cardnum|mm|yy|cvv` or `cardnum|mm|yyyy|cvv` format
- **Multi-line Input**: Process multiple cards simultaneously, one per line
- **Automatic Validation**: Real-time format validation with status feedback
- **Rate Limiting**: Built-in delays between requests to prevent API rate limiting

### 2. Real-time Stripe Key Validation
- **Format Validation**: Automatically validates `sk_live_` and `sk_test_` key formats
- **Live Status Check**: Verifies if the provided key is active and functional using `/v1/charges` endpoint
- **Enhanced Error Handling**: Detailed HTTP status codes, error messages, and response bodies for failed requests
- **Visual Feedback**: Clear "Valid Key" or "Invalid Key" indicators with descriptive messages
- **Comprehensive Logging**: Detailed logs including network errors, HTTP status codes, and timestamps

### 3. Separate Result Categorization
- **Authorized Cards**: Successfully authorized cards (for $0 auth operations)
- **Charged Cards**: Successfully charged cards (for charge operations)
- **Declined Cards**: Cards declined with specific reasons (expired, stolen, etc.)
- **CVV Issues**: Cards with CVV verification problems (CCN cards)
- **Valid Cards**: Cards that are valid and ready for charging

### 4. Enhanced Error Handling
- **Detailed Decline Reasons**: Specific error messages for different failure types
- **Error Categorization**: Automatic sorting of errors by type (CVV, expired, stolen, etc.)
- **Network Error Handling**: Comprehensive logging of network issues with HTTP status codes
- **Response Body Logging**: Complete response bodies for debugging network and API errors
- **User-friendly Messages**: Clear, actionable error descriptions with suggestions

### 5. Automatic Data Generation
- **Email Generation**: Realistic email addresses with various domain providers
- **Name Generation**: Diverse first and last name combinations
- **User Agent Rotation**: Multiple browser user agents for security
- **Customer Data**: Complete customer profiles for each transaction

### 6. Copy Functionality
- **Quick Copy**: One-click copy buttons for each result category
- **Formatted Output**: Results formatted for easy use in other systems
- **Clipboard Integration**: Direct copy to clipboard with visual feedback

## Stripe Key Validation Process

### Validation Workflow
1. **Format Validation**: Checks if key starts with `sk_test_` or `sk_live_`
2. **API Connectivity Test**: Uses `/v1/charges` endpoint to verify key validity
3. **Error Categorization**: Classifies errors into authentication, network, or permission issues
4. **Detailed Logging**: Records HTTP status codes, error messages, and response bodies

### Key Validation Results
- **Valid Key**: Shows green checkmark with key type and endpoint tested
- **Invalid Key**: Shows red X with specific error message and HTTP status
- **Network Error**: Shows detailed network error information with suggestions

### Error Types Handled
- `authentication_error`: Invalid or expired API keys
- `permission_error`: Insufficient permissions or inactive accounts
- `network_error`: DNS, SSL, timeout, or connection issues
- `card_error`: Card-specific validation failures

### Enhanced Logging Features
All validation attempts are logged with:
- Timestamp and IP address
- Key type (test/live) and prefix
- HTTP status codes from API responses
- Complete error messages and response bodies
- Network diagnostic information for troubleshooting

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
- Live keys are validated using the `/v1/charges` endpoint as recommended by Stripe
- Validation includes HTTP status codes, error messages, and response bodies
- Clear "Valid Key" or "Invalid Key" feedback is provided with detailed information

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

#### 4. Single Card Processing
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

2. **"Invalid Key - Stripe key authentication failed"**
   - Verify the key is active in your Stripe dashboard
   - Check if the key has proper permissions for `/v1/charges` endpoint
   - Review HTTP status codes in the detailed error message

3. **Network Connection Issues**
   - Check your internet connection
   - Review detailed error logs for HTTP status codes and response bodies
   - Verify proxy settings if using a proxy
   - Check if Stripe API is experiencing issues

4. **"Rate limit exceeded"**
   - Wait for the rate limit to reset (1 minute)
   - Consider using delays between bulk requests

5. **"CVV verification failed"**
   - Check CVV format (3 digits for most cards, 4 for Amex)
   - Verify card number and CVV match

### Log Files
- Transaction logs: `payment_log.txt` - Contains detailed transaction information, HTTP status codes, and error details
- Rate limit data: `rate_limit.json` - Tracks API rate limiting per IP address
- Encryption key: `encryption.key` - Securely stores the encryption key for sensitive data
- Server logs: Check PHP error logs for additional network and API error information

## Support

For issues or questions:
1. Check the processing log for detailed error information
2. Verify Stripe key permissions and status
3. Review the troubleshooting section
4. Check network connectivity and proxy settings

## License

This software is provided as-is for educational and development purposes. Use responsibly and in compliance with applicable laws and regulations.