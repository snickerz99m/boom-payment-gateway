# 🚀 BOOM Payment Gateway

**A Complete, Production-Ready Payment Processing System**

Transform any website into a fully functional e-commerce platform with secure payment processing in minutes!

![Admin Panel](https://github.com/user-attachments/assets/a205c0f3-363e-4f4e-bc1c-8fd5a789fca5)

---

## 🎯 **What This Does**

This is a **complete payment gateway system** that:
- ✅ Processes credit card payments securely
- ✅ Handles Visa, Mastercard, American Express, and Discover cards
- ✅ Never stores actual card numbers (uses secure tokens)
- ✅ Works with ANY website or shopping cart
- ✅ Includes fraud protection and security
- ✅ Provides instant payment confirmations
- ✅ Handles refunds automatically
- ✅ Includes a professional admin panel

---

## 🛠️ **Super Easy Setup (Windows)**

### **Option 1: One-Click Setup**
1. Download the project ZIP file
2. Extract to your desired folder
3. Double-click `setup-windows.bat`
4. Follow the on-screen instructions

### **Option 2: Manual Setup**

**Step 1: Install Node.js**
1. Go to [nodejs.org](https://nodejs.org)
2. Download the "LTS" version (recommended)
3. Run the installer and follow the prompts
4. Restart your computer

**Step 2: Setup the Payment Gateway**
1. Open Command Prompt (`Win + R`, type `cmd`, press Enter)
2. Navigate to your project folder:
   ```cmd
   cd path/to/boom-payment-gateway
   ```
3. Install dependencies:
   ```cmd
   npm install
   ```
4. Create configuration file:
   ```cmd
   copy .env.example .env
   ```
5. Start the server:
   ```cmd
   npm start
   ```

**Step 3: Access the Admin Panel**
- Open your web browser
- Go to: `http://localhost:3000/admin`
- Login with: `admin@boom-payments.com` / `password`

---

## 🔌 **API Integration for Shopping Sites**

### **Payment Processing Endpoint**
```javascript
// Process a payment
POST /api/v1/payments/process
Content-Type: application/json

{
  "amount": 2999,  // Amount in cents ($29.99)
  "currency": "USD",
  "cardData": {
    "cardNumber": "4111111111111111",
    "expiryDate": "12/25",
    "cvv": "123",
    "cardholderName": "John Doe"
  },
  "customerData": {
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "orderData": {
    "orderId": "ORDER-123",
    "description": "Premium Product Purchase"
  }
}
```

### **Response**
```javascript
{
  "success": true,
  "data": {
    "transactionId": "txn_1234567890",
    "status": "completed",
    "amount": 2999,
    "currency": "USD",
    "gatewayResponse": "approved"
  }
}
```

### **Integration Examples**

**HTML Form Integration:**
```html
<form id="payment-form">
  <input type="text" id="card-number" placeholder="Card Number">
  <input type="text" id="expiry" placeholder="MM/YY">
  <input type="text" id="cvv" placeholder="CVV">
  <button type="submit">Pay Now</button>
</form>

<script>
document.getElementById('payment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const paymentData = {
    amount: 2999,
    currency: 'USD',
    cardData: {
      cardNumber: document.getElementById('card-number').value,
      expiryDate: document.getElementById('expiry').value,
      cvv: document.getElementById('cvv').value,
      cardholderName: 'John Doe'
    }
  };
  
  const response = await fetch('/api/v1/payments/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentData)
  });
  
  const result = await response.json();
  if (result.success) {
    alert('Payment successful!');
  } else {
    alert('Payment failed: ' + result.message);
  }
});
</script>
```

**PHP Integration:**
```php
<?php
$paymentData = [
    'amount' => 2999,
    'currency' => 'USD',
    'cardData' => [
        'cardNumber' => $_POST['card_number'],
        'expiryDate' => $_POST['expiry'],
        'cvv' => $_POST['cvv'],
        'cardholderName' => $_POST['cardholder_name']
    ]
];

$response = file_get_contents('http://localhost:3000/api/v1/payments/process', false, stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => json_encode($paymentData)
    ]
]));

$result = json_decode($response, true);
if ($result['success']) {
    echo "Payment successful! Transaction ID: " . $result['data']['transactionId'];
} else {
    echo "Payment failed: " . $result['message'];
}
?>
```

---

## 📊 **Admin Panel Features**

### **Dashboard**
- Real-time transaction monitoring
- Revenue analytics
- Customer metrics
- Payment success rates

### **Transaction Management**
- View all transactions
- Filter by status, date, amount
- Search functionality
- Export capabilities

### **Customer Management**
- Customer profiles
- Payment history
- Risk assessment
- Communication tools

### **Refund Management**
- Process refunds
- Partial refunds
- Refund tracking
- Automated notifications

### **Settings**
- Payment configuration
- Security settings
- API key management
- Webhook configuration

---

## 🔐 **Security Features**

### **Built-in Security**
- ✅ PCI DSS compliant tokenization
- ✅ SSL/TLS encryption
- ✅ Rate limiting
- ✅ Input validation
- ✅ SQL injection protection
- ✅ XSS protection
- ✅ CSRF protection

### **Authentication**
- JWT token-based authentication
- Session management
- Role-based access control
- API key authentication

### **Data Protection**
- Encrypted sensitive data storage
- Secure card tokenization
- No plain text card storage
- Audit logging

---

## 🌍 **Remote Access & Deployment**

### **Local Development with Ngrok**
1. Install Ngrok from [ngrok.com](https://ngrok.com)
2. Start your payment gateway:
   ```cmd
   npm start
   ```
3. In another terminal:
   ```cmd
   ngrok http 3000
   ```
4. Use the provided HTTPS URL for remote access

### **Cloud Deployment**

**Heroku Deployment:**
1. Create a Heroku app
2. Add the SQLite buildpack
3. Deploy your code
4. Set environment variables

**AWS/Azure/GCP:**
- Use Docker container deployment
- Configure environment variables
- Set up SSL certificates
- Configure load balancing

---

## 📝 **API Documentation**

### **Authentication**
All admin endpoints require authentication:
```javascript
// Login
POST /api/v1/auth/login
{
  "email": "admin@boom-payments.com",
  "password": "password"
}

// Use token in subsequent requests
Authorization: Bearer <token>
```

### **Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/payments/process` | POST | Process a payment |
| `/api/v1/transactions` | GET | List transactions |
| `/api/v1/transactions/{id}` | GET | Get transaction details |
| `/api/v1/customers` | GET | List customers |
| `/api/v1/customers/{id}` | GET | Get customer details |
| `/api/v1/payments/{id}/refund` | POST | Process refund |
| `/api/v1/webhooks/payment` | POST | Payment webhook |

---

## 🛠️ **Configuration**

### **Environment Variables**
```env
# Database (SQLite by default)
DB_DIALECT=sqlite
DB_PATH=data/payments.db

# Security
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-32-character-key

# Server
PORT=3000
NODE_ENV=production

# Business Settings
BUSINESS_NAME=Your Business Name
BUSINESS_EMAIL=admin@yourbusiness.com
CURRENCY=USD
```

### **Production Settings**
1. Change default admin password
2. Use strong JWT secret
3. Enable HTTPS
4. Configure proper database
5. Set up monitoring
6. Configure backups

---

## 🧪 **Testing**

### **Run Tests**
```cmd
npm test
```

### **Test Coverage**
```cmd
npm run test:coverage
```

### **Test Data**
The system includes sample test data for:
- Valid/invalid card numbers
- Various payment scenarios
- Error conditions
- Security tests

---

## 🔧 **Troubleshooting**

### **Common Issues**

**Server won't start:**
- Check Node.js version (requires 16+)
- Verify npm install completed
- Check port 3000 is available
- Review .env configuration

**Database errors:**
- Delete `data/payments.db` and restart
- Check file permissions
- Verify disk space

**Admin panel won't load:**
- Clear browser cache
- Check console for errors
- Verify server is running
- Try incognito/private mode

**API errors:**
- Check request format
- Verify authentication
- Review server logs
- Test with curl/Postman

### **Getting Help**
1. Check the error logs
2. Review the API documentation
3. Test with sample data
4. Check browser console
5. Verify environment configuration

---

## 📋 **Requirements**

- **Node.js**: 16.0.0 or higher
- **npm**: 8.0.0 or higher
- **Operating System**: Windows 10/11, macOS, or Linux
- **RAM**: 512MB minimum
- **Storage**: 100MB minimum

---

## 📄 **License**

MIT License - feel free to use this in your projects!

---

## 🎉 **Quick Start Checklist**

- [ ] Install Node.js
- [ ] Download/clone project
- [ ] Run `npm install`
- [ ] Copy `.env.example` to `.env`
- [ ] Run `npm start`
- [ ] Open `http://localhost:3000/admin`
- [ ] Login with default credentials
- [ ] Change admin password
- [ ] Test a payment
- [ ] Integrate with your website

**You're ready to accept payments! 🚀**