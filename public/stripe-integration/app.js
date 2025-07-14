/**
 * Stripe Payment Gateway Integration
 * Frontend JavaScript for secure payment processing
 */

class StripePaymentGateway {
    constructor() {
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/91.0.864.59',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 OPR/77.0.4054.172'
        ];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupFormValidation();
        this.generateRandomUserData();
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('stripe-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processPayment();
        });

        // Operation type change
        document.querySelectorAll('input[name="operation"]').forEach(radio => {
            radio.addEventListener('change', this.handleOperationChange.bind(this));
        });

        // Proxy toggle
        document.getElementById('use-proxy').addEventListener('change', this.handleProxyToggle.bind(this));

        // Card number formatting
        document.getElementById('card-number').addEventListener('input', this.formatCardNumber.bind(this));

        // Expiry date formatting
        document.getElementById('expiry-date').addEventListener('input', this.formatExpiryDate.bind(this));

        // CVV validation
        document.getElementById('cvv').addEventListener('input', this.validateCVV.bind(this));

        // Generate random user data button
        this.addRandomDataButton();

        // Validate key button
        document.getElementById('validate-key-btn').addEventListener('click', this.validateStripeKey.bind(this));
    }

    setupFormValidation() {
        const form = document.getElementById('stripe-form');
        
        // Real-time validation
        form.addEventListener('input', (e) => {
            this.validateField(e.target);
        });
    }

    handleOperationChange(e) {
        const amountInput = document.getElementById('amount-input');
        const amountField = document.getElementById('amount');
        
        if (e.target.value === 'charge') {
            amountInput.classList.add('show');
            amountField.required = true;
        } else {
            amountInput.classList.remove('show');
            amountField.required = false;
            amountField.value = '';
        }
    }

    handleProxyToggle(e) {
        const proxyInputs = document.getElementById('proxy-inputs');
        
        if (e.target.checked) {
            proxyInputs.classList.add('show');
        } else {
            proxyInputs.classList.remove('show');
        }
    }

    formatCardNumber(e) {
        let value = e.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
        let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
        
        if (formattedValue.length > 19) {
            formattedValue = formattedValue.substr(0, 19);
        }
        
        e.target.value = formattedValue;
    }

    formatExpiryDate(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        
        e.target.value = value;
    }

    validateCVV(e) {
        let value = e.target.value.replace(/\D/g, '');
        e.target.value = value;
    }

    validateField(field) {
        const fieldName = field.name;
        const value = field.value.trim();
        
        // Remove previous error styling
        field.classList.remove('error');
        
        switch (fieldName) {
            case 'cardNumber':
                if (value && !this.validateCardNumber(value.replace(/\s/g, ''))) {
                    field.classList.add('error');
                }
                break;
            case 'expiryDate':
                if (value && !this.validateExpiryDate(value)) {
                    field.classList.add('error');
                }
                break;
            case 'cvv':
                if (value && (value.length < 3 || value.length > 4)) {
                    field.classList.add('error');
                }
                break;
            case 'email':
                if (value && !this.validateEmail(value)) {
                    field.classList.add('error');
                }
                break;
        }
    }

    validateCardNumber(cardNumber) {
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
        
        return (sum % 10 === 0);
    }

    validateExpiryDate(expiryDate) {
        const parts = expiryDate.split('/');
        if (parts.length !== 2) return false;
        
        const month = parseInt(parts[0], 10);
        const year = parseInt('20' + parts[1], 10);
        
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        if (month < 1 || month > 12) return false;
        if (year < currentYear || (year === currentYear && month < currentMonth)) return false;
        
        return true;
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    generateRandomUserData() {
        const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'William', 'Jessica'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
        const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
        
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const domain = domains[Math.floor(Math.random() * domains.length)];
        
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 999)}@${domain}`;
        
        return {
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            email
        };
    }

    addRandomDataButton() {
        const cardholderGroup = document.getElementById('cardholder-name').parentElement;
        const button = document.createElement('button');
        button.type = 'button';
        button.innerHTML = '🎲 Generate Random Data';
        button.style.cssText = `
            background: #28a745;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.9em;
            margin-top: 10px;
        `;
        
        button.addEventListener('click', () => {
            const userData = this.generateRandomUserData();
            document.getElementById('cardholder-name').value = userData.fullName;
            document.getElementById('email').value = userData.email;
        });
        
        cardholderGroup.appendChild(button);
    }

    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    async validateStripeKey() {
        const keyInput = document.getElementById('stripe-secret-key');
        const validateBtn = document.getElementById('validate-key-btn');
        const validationStatus = document.getElementById('validation-status');
        
        const key = keyInput.value.trim();
        
        if (!key) {
            this.showValidationStatus('error', 'Please enter a Stripe secret key');
            return;
        }
        
        // Basic format validation
        if (!key.match(/^sk_(test|live)_[A-Za-z0-9]{24,}$/)) {
            this.showValidationStatus('error', 'Invalid Stripe secret key format. Must start with sk_test_ or sk_live_');
            return;
        }
        
        // Disable button and show loading
        validateBtn.disabled = true;
        validateBtn.textContent = '⏳ Validating...';
        validationStatus.style.display = 'none';
        
        try {
            // Encrypt the key
            const encryptedKey = btoa(key);
            
            // Make validation request
            const response = await fetch('backend.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    action: 'validate_key',
                    stripeSecretKey: encryptedKey
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showValidationStatus('success', 'Valid Stripe key!', result.data);
            } else {
                this.showValidationStatus('error', result.message || 'Key validation failed');
            }
            
        } catch (error) {
            this.showValidationStatus('error', 'Network error: ' + error.message);
        } finally {
            // Re-enable button
            validateBtn.disabled = false;
            validateBtn.textContent = '🔍 Validate Key';
        }
    }

    showValidationStatus(type, message, details = null) {
        const validationStatus = document.getElementById('validation-status');
        
        validationStatus.className = `validation-status ${type}`;
        validationStatus.style.display = 'block';
        
        let content = `<strong>${message}</strong>`;
        
        if (details) {
            content += '<div class="validation-details">';
            if (details.key_type) {
                content += `<div><strong>Key Type:</strong> ${details.key_type}</div>`;
            }
            if (details.validation && details.validation.account_id) {
                content += `<div><strong>Account ID:</strong> ${details.validation.account_id}</div>`;
            }
            if (details.validation && details.validation.country) {
                content += `<div><strong>Country:</strong> ${details.validation.country}</div>`;
            }
            if (details.validation && details.validation.charges_enabled !== undefined) {
                content += `<div><strong>Charges Enabled:</strong> ${details.validation.charges_enabled ? 'Yes' : 'No'}</div>`;
            }
            if (details.validation && details.validation.test_mode) {
                content += `<div><em>Note: Running in test mode (no internet access)</em></div>`;
            }
            content += '</div>';
        }
        
        validationStatus.innerHTML = content;
        
        // Auto-hide after 15 seconds
        setTimeout(() => {
            validationStatus.style.display = 'none';
        }, 15000);
    }

    async processPayment() {
        const form = document.getElementById('stripe-form');
        const submitBtn = document.getElementById('submit-btn');
        const loading = document.getElementById('loading');
        const resultSection = document.getElementById('result-section');
        
        // Disable form and show loading
        submitBtn.disabled = true;
        loading.classList.add('show');
        resultSection.style.display = 'none';
        
        try {
            // Validate form
            if (!this.validateForm()) {
                throw new Error('Please fill in all required fields correctly');
            }
            
            // Collect form data
            const formData = new FormData(form);
            const paymentData = {
                stripeSecretKey: formData.get('stripeSecretKey'),
                operation: formData.get('operation'),
                amount: formData.get('amount') || '0',
                cardNumber: formData.get('cardNumber').replace(/\s/g, ''),
                expiryDate: formData.get('expiryDate'),
                cvv: formData.get('cvv'),
                cardholderName: formData.get('cardholderName'),
                email: formData.get('email'),
                description: formData.get('description') || 'Payment transaction',
                useProxy: formData.get('useProxy') === 'on',
                proxyHost: formData.get('proxyHost'),
                proxyPort: formData.get('proxyPort'),
                proxyUsername: formData.get('proxyUsername'),
                proxyPassword: formData.get('proxyPassword'),
                userAgent: this.getRandomUserAgent(),
                timestamp: new Date().toISOString()
            };
            
            // Encrypt sensitive data
            const encryptedData = await this.encryptSensitiveData(paymentData);
            
            // Send to backend
            const response = await fetch('backend.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'User-Agent': paymentData.userAgent
                },
                body: JSON.stringify(encryptedData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.showResult('success', result);
            } else {
                this.showResult('error', result);
            }
            
        } catch (error) {
            this.showResult('error', {
                success: false,
                message: error.message || 'An error occurred while processing your payment'
            });
        } finally {
            // Re-enable form and hide loading
            submitBtn.disabled = false;
            loading.classList.remove('show');
        }
    }

    validateForm() {
        const form = document.getElementById('stripe-form');
        const requiredFields = form.querySelectorAll('input[required], textarea[required]');
        let isValid = true;
        
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                field.classList.add('error');
                isValid = false;
            } else {
                field.classList.remove('error');
            }
        });
        
        // Additional validation
        const cardNumber = document.getElementById('card-number').value.replace(/\s/g, '');
        const expiryDate = document.getElementById('expiry-date').value;
        const cvv = document.getElementById('cvv').value;
        const email = document.getElementById('email').value;
        
        if (!this.validateCardNumber(cardNumber)) {
            document.getElementById('card-number').classList.add('error');
            isValid = false;
        }
        
        if (!this.validateExpiryDate(expiryDate)) {
            document.getElementById('expiry-date').classList.add('error');
            isValid = false;
        }
        
        if (cvv.length < 3 || cvv.length > 4) {
            document.getElementById('cvv').classList.add('error');
            isValid = false;
        }
        
        if (!this.validateEmail(email)) {
            document.getElementById('email').classList.add('error');
            isValid = false;
        }
        
        return isValid;
    }

    async encryptSensitiveData(data) {
        // Simple client-side encryption for demo purposes
        // In production, use proper encryption libraries
        const sensitiveFields = ['stripeSecretKey', 'cardNumber', 'cvv'];
        const encryptedData = { ...data };
        
        sensitiveFields.forEach(field => {
            if (encryptedData[field]) {
                encryptedData[field] = btoa(encryptedData[field]); // Base64 encoding as simple encryption
            }
        });
        
        return encryptedData;
    }

    showResult(type, result) {
        const resultSection = document.getElementById('result-section');
        const resultContent = document.getElementById('result-content');
        
        resultSection.className = `result-section ${type}`;
        resultSection.style.display = 'block';
        
        if (type === 'success') {
            resultContent.innerHTML = `
                <h3>✅ Payment Successful!</h3>
                <p><strong>Transaction ID:</strong> ${result.transactionId || 'N/A'}</p>
                <p><strong>Amount:</strong> $${result.amount || '0.00'}</p>
                <p><strong>Status:</strong> ${result.status || 'Completed'}</p>
                <p><strong>Message:</strong> ${result.message || 'Payment processed successfully'}</p>
                ${result.authCode ? `<p><strong>Authorization Code:</strong> ${result.authCode}</p>` : ''}
                <p><strong>Processed At:</strong> ${new Date().toLocaleString()}</p>
            `;
        } else {
            resultContent.innerHTML = `
                <h3>❌ Payment Failed</h3>
                <p><strong>Error:</strong> ${result.message || 'Unknown error occurred'}</p>
                <p><strong>Code:</strong> ${result.code || 'N/A'}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            `;
        }
        
        // Auto-hide after 30 seconds
        setTimeout(() => {
            resultSection.style.display = 'none';
        }, 30000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StripePaymentGateway();
});

// Add CSS for error styling
const style = document.createElement('style');
style.textContent = `
    .form-group input.error,
    .form-group textarea.error {
        border-color: #dc3545 !important;
        box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1) !important;
    }
    
    .form-group input.error:focus,
    .form-group textarea.error:focus {
        border-color: #dc3545 !important;
        box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.25) !important;
    }
`;
document.head.appendChild(style);