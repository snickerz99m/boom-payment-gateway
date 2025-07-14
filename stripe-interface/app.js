// Stripe Payment Gateway - Advanced Security Client-Side Implementation
// Features: User-Agent Rotation, Random Data Generation, Security Validation

class StripePaymentGateway {
    constructor() {
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
        
        this.emailDomains = [
            'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
            'protonmail.com', 'aol.com', 'live.com', 'me.com', 'mac.com'
        ];
        
        this.firstNames = [
            'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
            'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
            'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa',
            'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra', 'Donald', 'Donna'
        ];
        
        this.lastNames = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
            'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
            'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
            'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young'
        ];
        
        this.init();
    }
    
    init() {
        this.attachEventListeners();
        this.setupValidation();
        this.generateRandomUserData();
    }
    
    attachEventListeners() {
        const form = document.getElementById('paymentForm');
        const cardNumber = document.getElementById('cardNumber');
        const expiry = document.getElementById('expiry');
        const cvv = document.getElementById('cvv');
        const operation = document.getElementById('operation');
        const amount = document.getElementById('amount');
        
        form.addEventListener('submit', (e) => this.handleSubmit(e));
        cardNumber.addEventListener('input', (e) => this.formatCardNumber(e));
        expiry.addEventListener('input', (e) => this.formatExpiry(e));
        cvv.addEventListener('input', (e) => this.formatCVV(e));
        operation.addEventListener('change', (e) => this.handleOperationChange(e));
        
        // Generate new random data every 5 minutes
        setInterval(() => this.generateRandomUserData(), 300000);
    }
    
    setupValidation() {
        const inputs = document.querySelectorAll('input[required], select[required]');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    }
    
    generateRandomUserData() {
        const firstName = this.getRandomItem(this.firstNames);
        const lastName = this.getRandomItem(this.lastNames);
        const email = this.generateRandomEmail(firstName, lastName);
        
        // Store for potential use
        this.generatedUserData = {
            firstName,
            lastName,
            email,
            userAgent: this.getRandomItem(this.userAgents),
            timestamp: Date.now()
        };
        
        console.log('Generated new user data:', this.generatedUserData);
    }
    
    generateRandomEmail(firstName, lastName) {
        const domain = this.getRandomItem(this.emailDomains);
        const variations = [
            `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
            `${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`,
            `${firstName.toLowerCase()}_${lastName.toLowerCase()}@${domain}`,
            `${firstName.toLowerCase()}${this.getRandomNumber(100, 999)}@${domain}`,
            `${firstName.toLowerCase().substring(0, 3)}${lastName.toLowerCase()}@${domain}`
        ];
        
        return this.getRandomItem(variations);
    }
    
    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
    
    getRandomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    formatCardNumber(e) {
        let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        let formattedValue = '';
        let matches = value.match(/\d{4,16}/g);
        let match = matches && matches[0] || '';
        let parts = [];
        
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        
        if (parts.length) {
            formattedValue = parts.join(' ');
        }
        
        e.target.value = formattedValue;
    }
    
    formatExpiry(e) {
        let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        let formattedValue = '';
        
        if (value.length >= 2) {
            formattedValue = value.substring(0, 2) + '/' + value.substring(2, 4);
        } else {
            formattedValue = value;
        }
        
        e.target.value = formattedValue;
    }
    
    formatCVV(e) {
        let value = e.target.value.replace(/[^0-9]/gi, '');
        e.target.value = value.substring(0, 4);
    }
    
    handleOperationChange(e) {
        const amountField = document.getElementById('amount');
        const amountLabel = document.querySelector('label[for="amount"]');
        
        if (e.target.value === 'auth') {
            amountField.value = '0.00';
            amountField.readOnly = true;
            amountLabel.textContent = 'Amount (USD) - $0 Authorization';
        } else {
            amountField.readOnly = false;
            amountLabel.textContent = 'Amount (USD)';
            if (amountField.value === '0.00') {
                amountField.value = '';
            }
        }
    }
    
    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';
        
        switch (field.id) {
            case 'stripeSecretKey':
                if (!value.startsWith('sk_test_') && !value.startsWith('sk_live_')) {
                    isValid = false;
                    errorMessage = 'Invalid Stripe secret key format';
                }
                break;
                
            case 'cardNumber':
                const cleanCard = value.replace(/\s+/g, '');
                if (!this.isValidCardNumber(cleanCard)) {
                    isValid = false;
                    errorMessage = 'Invalid card number';
                }
                break;
                
            case 'expiry':
                if (!this.isValidExpiry(value)) {
                    isValid = false;
                    errorMessage = 'Invalid expiry date';
                }
                break;
                
            case 'cvv':
                if (value.length < 3 || value.length > 4) {
                    isValid = false;
                    errorMessage = 'Invalid CVV';
                }
                break;
                
            case 'amount':
                const amount = parseFloat(value);
                if (isNaN(amount) || amount < 0) {
                    isValid = false;
                    errorMessage = 'Invalid amount';
                }
                break;
        }
        
        if (!isValid) {
            this.showFieldError(field, errorMessage);
        } else {
            this.clearFieldError(field);
        }
        
        return isValid;
    }
    
    isValidCardNumber(cardNumber) {
        // Luhn algorithm
        let sum = 0;
        let alternate = false;
        
        for (let i = cardNumber.length - 1; i >= 0; i--) {
            let n = parseInt(cardNumber.charAt(i), 10);
            
            if (alternate) {
                n *= 2;
                if (n > 9) {
                    n = (n % 10) + 1;
                }
            }
            
            sum += n;
            alternate = !alternate;
        }
        
        return (sum % 10 === 0) && cardNumber.length >= 13;
    }
    
    isValidExpiry(expiry) {
        const match = expiry.match(/^(\d{2})\/(\d{2})$/);
        if (!match) return false;
        
        const month = parseInt(match[1], 10);
        const year = parseInt(match[2], 10) + 2000;
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        return month >= 1 && month <= 12 && 
               (year > currentYear || (year === currentYear && month >= currentMonth));
    }
    
    showFieldError(field, message) {
        this.clearFieldError(field);
        
        field.style.borderColor = '#dc3545';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.style.color = '#dc3545';
        errorDiv.style.fontSize = '14px';
        errorDiv.style.marginTop = '5px';
        errorDiv.textContent = message;
        
        field.parentNode.appendChild(errorDiv);
    }
    
    clearFieldError(field) {
        field.style.borderColor = '#e1e5e9';
        const errorDiv = field.parentNode.querySelector('.field-error');
        if (errorDiv) {
            errorDiv.remove();
        }
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        const submitBtn = document.getElementById('submitBtn');
        const loading = document.getElementById('loading');
        const result = document.getElementById('result');
        
        // Validate all fields
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        let isValid = true;
        const requiredFields = form.querySelectorAll('[required]');
        
        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        
        if (!isValid) {
            this.showResult('Please fix the errors before submitting', 'error');
            return;
        }
        
        // Show loading state
        submitBtn.disabled = true;
        loading.style.display = 'block';
        result.style.display = 'none';
        
        try {
            // Prepare payment data with security features
            const paymentData = {
                stripeSecretKey: this.encryptData(data.stripeSecretKey),
                operation: data.operation,
                amount: parseFloat(data.amount) * 100, // Convert to cents
                currency: data.currency,
                cardData: {
                    number: data.cardNumber.replace(/\s+/g, ''),
                    expiry: data.expiry,
                    cvv: data.cvv,
                    holderName: data.cardholderName
                },
                customerData: this.generatedUserData,
                proxyConfig: {
                    host: data.proxyHost,
                    port: data.proxyPort ? parseInt(data.proxyPort) : null,
                    username: data.proxyUsername,
                    password: data.proxyPassword
                },
                description: data.description,
                userAgent: this.generatedUserData.userAgent,
                timestamp: Date.now(),
                sessionId: this.generateSessionId()
            };
            
            // Process payment
            const response = await this.processPayment(paymentData);
            
            if (response.success) {
                this.showResult(
                    `Payment successful! Transaction ID: ${response.transactionId}`,
                    'success'
                );
                form.reset();
                this.generateRandomUserData();
            } else {
                this.showResult(
                    `Payment failed: ${response.error}`,
                    'error'
                );
            }
            
        } catch (error) {
            console.error('Payment processing error:', error);
            this.showResult(
                'An error occurred while processing the payment. Please try again.',
                'error'
            );
        } finally {
            // Hide loading state
            submitBtn.disabled = false;
            loading.style.display = 'none';
        }
    }
    
    async processPayment(paymentData) {
        // Simulate API call to backend
        const response = await fetch('/api/stripe/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': paymentData.userAgent,
                'X-Session-ID': paymentData.sessionId
            },
            body: JSON.stringify(paymentData)
        });
        
        return await response.json();
    }
    
    encryptData(data) {
        // Simple client-side encryption (in production, use proper encryption)
        return btoa(data);
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    showResult(message, type) {
        const result = document.getElementById('result');
        result.className = `result ${type}`;
        result.innerHTML = `
            <strong>${type === 'success' ? '✅ Success' : '❌ Error'}</strong><br>
            ${message}
        `;
        result.style.display = 'block';
        
        // Auto-hide success messages after 10 seconds
        if (type === 'success') {
            setTimeout(() => {
                result.style.display = 'none';
            }, 10000);
        }
    }
}

// Initialize the payment gateway when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StripePaymentGateway();
});

// Security: Clear sensitive data on page unload
window.addEventListener('beforeunload', () => {
    // Clear form data
    const form = document.getElementById('paymentForm');
    if (form) {
        form.reset();
    }
    
    // Clear any stored sensitive data
    sessionStorage.clear();
});

// Prevent right-click context menu on production
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('dragstart', e => e.preventDefault());
}