# BOOM Payment Gateway - Integration Examples

This directory contains integration examples for the BOOM Payment Gateway API in Python and PHP.

## 📁 Directory Structure

```
examples/
├── python/
│   ├── simple_payment.py      # Simple Python example
│   ├── payment_client.py      # Full-featured Python client
│   └── requirements.txt       # Python dependencies
├── php/
│   ├── simple_payment.php     # Simple PHP example
│   └── PaymentGatewayClient.php # Full-featured PHP client
└── README.md                  # This file
```

## 🐍 Python Examples

### Prerequisites
```bash
pip install requests
# OR
pip install -r python/requirements.txt
```

### Simple Example
```bash
cd python
python simple_payment.py
```

### Full Client Library
```bash
cd python
python payment_client.py
```

## 🐘 PHP Examples

### Prerequisites
- PHP 7.4+ with cURL extension

### Simple Example
```bash
cd php
php simple_payment.php
```

### Full Client Library
```bash
cd php
php PaymentGatewayClient.php
```

## 🔧 Configuration

### For Local Testing
- Default API URL: `http://localhost:3000`
- No authentication required for development

### For Remote Testing
1. Update the API URL in examples:
   ```python
   # Python
   API_BASE_URL = "http://192.168.1.100:3000"  # Your server IP
   ```
   
   ```php
   // PHP
   $apiBaseUrl = 'http://192.168.1.100:3000';  // Your server IP
   ```

2. Ensure firewall allows port 3000

### For Production
1. Use API keys for authentication:
   ```python
   # Python
   API_KEY = "your-production-api-key"
   ```
   
   ```php
   // PHP
   $apiKey = 'your-production-api-key';
   ```

2. Use HTTPS endpoints

## 🧪 Test Data

### Valid Test Card Numbers
- **Visa:** 4111111111111111
- **Mastercard:** 5555555555554444
- **American Express:** 378282246310005
- **Discover:** 6011111111111117

### Test Expiry Dates
- Use any future date in MM/YY format
- Example: 12/25, 01/26, 03/27

### Test CVV
- Visa/MC/Discover: 3 digits (123)
- American Express: 4 digits (1234)

## 🚀 Quick Start

1. **Start the payment gateway:**
   ```bash
   # From project root
   npm start
   ```

2. **Test Python example:**
   ```bash
   cd examples/python
   python simple_payment.py
   ```

3. **Test PHP example:**
   ```bash
   cd examples/php
   php simple_payment.php
   ```

## 📚 Additional Resources

- [Main README](../README.md) - Complete documentation
- [API Documentation](../README.md#api-documentation) - API reference
- [Troubleshooting](../README.md#troubleshooting) - Common issues and solutions
- [Security Configuration](../README.md#security-configuration) - Production security setup

## 🔗 Integration Tips

1. **Error Handling:** Always check the `success` field in API responses
2. **Timeouts:** Set appropriate timeouts for API calls (30 seconds recommended)
3. **Logging:** Log transaction IDs for debugging and support
4. **Testing:** Use test card numbers for development
5. **Security:** Never log sensitive card data in production

Happy coding! 🎉