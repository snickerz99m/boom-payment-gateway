// Enhanced Stripe Payment Gateway - Bulk Card Processing Implementation
// Features: Bulk card processing, detailed status reporting, auto-generation

class EnhancedStripeGateway {
    constructor() {
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
        
        this.emailDomains = [
            'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
            'protonmail.com', 'aol.com', 'live.com', 'me.com', 'mac.com',
            'yandex.com', 'mail.com', 'zoho.com', 'fastmail.com', 'tutanota.com'
        ];
        
        this.firstNames = [
            'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
            'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
            'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa',
            'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra', 'Donald', 'Donna',
            'Steven', 'Carol', 'Paul', 'Ruth', 'Andrew', 'Sharon', 'Joshua', 'Michelle',
            'Kenneth', 'Laura', 'Kevin', 'Sarah', 'Brian', 'Kimberly', 'George', 'Deborah'
        ];
        
        this.lastNames = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
            'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
            'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
            'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
            'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
            'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell'
        ];
        
        this.results = {
            authorized: [],
            charged: [],
            declined: [],
            cvvIssues: [],
            valid: [],
            log: []
        };
        
        this.init();
    }
    
    init() {
        this.attachEventListeners();
        this.setupValidation();
        this.generateRandomUserData();
        this.setupKeyValidation();
        this.clearResults();
    }
    
    attachEventListeners() {
        const form = document.getElementById('paymentForm');
        const cardNumber = document.getElementById('cardNumber');
        const expiry = document.getElementById('expiry');
        const cvv = document.getElementById('cvv');
        const operation = document.getElementById('operation');
        const stripeSecretKey = document.getElementById('stripeSecretKey');
        const bulkCards = document.getElementById('bulkCards');
        
        form.addEventListener('submit', (e) => this.handleSubmit(e));
        cardNumber.addEventListener('input', (e) => this.formatCardNumber(e));
        expiry.addEventListener('input', (e) => this.formatExpiry(e));
        cvv.addEventListener('input', (e) => this.formatCVV(e));
        operation.addEventListener('change', (e) => this.handleOperationChange(e));
        stripeSecretKey.addEventListener('input', (e) => this.validateStripeKey(e));
        bulkCards.addEventListener('input', (e) => this.handleBulkCardsInput(e));
        
        // Generate new random data every 5 minutes
        setInterval(() => this.generateRandomUserData(), 300000);
    }
    
    setupKeyValidation() {
        const stripeSecretKey = document.getElementById('stripeSecretKey');
        const keyValidation = document.getElementById('keyValidation');
        
        stripeSecretKey.addEventListener('blur', () => {
            const key = stripeSecretKey.value.trim();
            if (key) {
                this.validateStripeKeyComprehensive(key);
            }
        });
        
        stripeSecretKey.addEventListener('input', () => {
            const key = stripeSecretKey.value.trim();
            if (key) {
                this.validateStripeKeyFormat(key);
            } else {
                keyValidation.style.display = 'none';
            }
        });
    }
    
    validateStripeKeyFormat(key) {
        const keyValidation = document.getElementById('keyValidation');
        
        keyValidation.className = 'validation-status checking';
        keyValidation.textContent = '🔍 Checking key format...';
        keyValidation.style.display = 'block';
        
        // Basic format validation
        if (!key.match(/^sk_(test|live)_[a-zA-Z0-9]+$/)) {
            keyValidation.className = 'validation-status invalid';
            keyValidation.textContent = '❌ Invalid key format. Must start with sk_test_ or sk_live_';
            return false;
        }
        
        // Check if it's a live key
        if (key.startsWith('sk_live_')) {
            keyValidation.className = 'validation-status valid';
            keyValidation.textContent = '✅ Live key format valid - Testing connectivity...';
        } else {
            keyValidation.className = 'validation-status valid';
            keyValidation.textContent = '✅ Test key format valid - Testing connectivity...';
        }
        
        return true;
    }
    
    /**
     * Comprehensive Stripe key validation
     * 
     * This method validates Stripe keys by:
     * 1. Checking the key format locally (must start with sk_test_ or sk_live_)
     * 2. Sending the key to the backend for API validation
     * 3. Displaying detailed validation results with error handling
     * 4. Providing helpful suggestions for common error types
     * 
     * @param {string} key - The Stripe secret key to validate
     */
    async validateStripeKeyComprehensive(key) {
        const keyValidation = document.getElementById('keyValidation');
        
        if (!this.validateStripeKeyFormat(key)) {
            return;
        }
        
        keyValidation.className = 'validation-status checking';
        keyValidation.textContent = '🔍 Validating key with Stripe API...';
        
        try {
            // Encrypt the key for transmission (using base64 encoding for key validation)
            const encryptedKey = this.encryptData(key);
            
            // Make validation request to backend
            const response = await fetch('backend.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'validate_key',
                    stripeSecretKey: encryptedKey
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                const validation = result.data.validation;
                const keyType = result.data.key_type;
                
                if (validation.valid) {
                    keyValidation.className = 'validation-status valid';
                    
                    // Build comprehensive success message
                    let statusMessage = `✅ Valid ${keyType.toUpperCase()} Key - Active and functional`;
                    
                    // Add endpoint information
                    if (validation.endpoint_tested) {
                        statusMessage += `\n🎯 Endpoint: ${validation.endpoint_tested}`;
                    }
                    
                    // Add balance information if available
                    if (validation.balance_available) {
                        statusMessage += `\n💰 Balance: Available funds detected`;
                    }
                    
                    // Add timestamp
                    if (validation.timestamp) {
                        statusMessage += `\n⏰ Validated: ${validation.timestamp}`;
                    }
                    
                    keyValidation.textContent = statusMessage;
                    
                    // Log successful validation
                    this.logMessage(`✅ ${keyType.toUpperCase()} Key Validation - SUCCESS via ${validation.endpoint_tested || '/v1/balance'}`);
                } else {
                    keyValidation.className = 'validation-status invalid';
                    
                    // Build comprehensive error message
                    let statusMessage = `❌ Invalid ${keyType.toUpperCase()} Key`;
                    
                    // Add main error message
                    if (validation.message) {
                        statusMessage += `\n📝 Error: ${validation.message}`;
                    }
                    
                    // Add HTTP status if available
                    if (validation.http_status) {
                        statusMessage += `\n📊 HTTP Status: ${validation.http_status}`;
                    }
                    
                    // Add error code if available and not unknown
                    if (validation.error_code && validation.error_code !== 'unknown_error') {
                        statusMessage += `\n⚠️ Error Code: ${validation.error_code}`;
                    }
                    
                    // Add error type if available
                    if (validation.error_type && validation.error_type !== 'api_error') {
                        statusMessage += `\n🔍 Error Type: ${validation.error_type}`;
                    }
                    
                    // Add endpoint information
                    if (validation.endpoint_tested) {
                        statusMessage += `\n🎯 Endpoint: ${validation.endpoint_tested}`;
                    }
                    
                    // Add timestamp
                    if (validation.timestamp) {
                        statusMessage += `\n⏰ Failed: ${validation.timestamp}`;
                    }
                    
                    // Add helpful suggestions for common errors
                    if (validation.error_type === 'network_error') {
                        statusMessage += `\n💡 Check your internet connection and try again`;
                    } else if (validation.error_type === 'authentication_error') {
                        statusMessage += `\n💡 Verify the key is active in your Stripe dashboard`;
                    } else if (validation.error_type === 'permission_error') {
                        statusMessage += `\n💡 Contact Stripe support to activate your account`;
                    }
                    
                    keyValidation.textContent = statusMessage;
                    
                    // Log validation failure with enhanced details
                    this.logMessage(`❌ ${keyType.toUpperCase()} Key Validation - FAILED: ${validation.message} (${validation.error_code})`);
                }
            } else {
                keyValidation.className = 'validation-status invalid';
                keyValidation.textContent = `❌ Validation Error\n📝 ${result.error || 'Unknown error occurred'}`;
                this.logMessage(`❌ Key Validation - ERROR: ${result.error || 'Unknown error'}`);
            }
            
        } catch (error) {
            keyValidation.className = 'validation-status invalid';
            keyValidation.textContent = `❌ Network Error\n📝 ${error.message}\n💡 Check your connection and try again`;
            this.logMessage(`❌ Key Validation - Network Error: ${error.message}`);
        }
    }
    
    handleBulkCardsInput(e) {
        const bulkCards = e.target.value.trim();
        const singleCardSection = document.querySelector('.single-card-section');
        
        if (bulkCards) {
            singleCardSection.style.opacity = '0.5';
            singleCardSection.style.pointerEvents = 'none';
        } else {
            singleCardSection.style.opacity = '1';
            singleCardSection.style.pointerEvents = 'auto';
        }
        
        // Validate bulk cards format
        this.validateBulkCards(bulkCards);
    }
    
    validateBulkCards(bulkCards) {
        if (!bulkCards) return true;
        
        const lines = bulkCards.split('\n').filter(line => line.trim());
        let validCount = 0;
        
        lines.forEach(line => {
            const parts = line.trim().split('|');
            if (parts.length === 4) {
                const [cardNum, month, year, cvv] = parts;
                if (cardNum && month && year && cvv) {
                    validCount++;
                }
            }
        });
        
        this.logMessage(`Bulk validation: ${validCount}/${lines.length} cards have valid format`);
        return validCount === lines.length;
    }
    
    clearResults() {
        this.results = {
            authorized: [],
            charged: [],
            declined: [],
            cvvIssues: [],
            valid: [],
            log: []
        };
        
        this.updateResultBoxes();
    }
    
    updateResultBoxes() {
        document.getElementById('authorizedCards').textContent = this.formatResults(this.results.authorized);
        document.getElementById('chargedCards').textContent = this.formatResults(this.results.charged);
        document.getElementById('declinedCards').textContent = this.formatResults(this.results.declined);
        document.getElementById('cvvIssues').textContent = this.formatResults(this.results.cvvIssues);
        document.getElementById('validCards').textContent = this.formatResults(this.results.valid);
        document.getElementById('processingLog').textContent = this.results.log.join('\n');
    }
    
    formatResults(results) {
        if (results.length === 0) return '';
        
        return results.map(result => {
            const maskedCard = this.maskCardNumber(result.cardNumber);
            let line = `${maskedCard}|${result.expiry}|${result.cvv} - ${result.status}`;
            
            // Add reason
            if (result.reason) {
                line += ` (${result.reason})`;
            }
            
            // Add additional details for successful transactions
            if (result.details && result.details.transactionId) {
                line += ` [ID: ${result.details.transactionId}]`;
            }
            
            // Add enhanced error details for failed transactions
            if (result.details && result.details.errorType) {
                line += ` [Type: ${result.details.errorType}]`;
                
                if (result.details.declineCode && result.details.declineCode !== 'unknown') {
                    line += ` [Code: ${result.details.declineCode}]`;
                }
                
                if (result.details.httpStatus) {
                    line += ` [HTTP: ${result.details.httpStatus}]`;
                }
                
                if (result.details.timestamp) {
                    line += ` [Time: ${new Date(result.details.timestamp).toLocaleTimeString()}]`;
                }
                
                // Add suggestions on separate lines for better readability
                if (result.details.suggestions && result.details.suggestions.length > 0) {
                    line += '\n    💡 Suggestions: ' + result.details.suggestions.join(', ');
                }
            }
            
            return line;
        }).join('\n');
    }
    
    updateResultBoxes() {
        document.getElementById('authorizedCards').textContent = this.formatResults(this.results.authorized);
        document.getElementById('chargedCards').textContent = this.formatResults(this.results.charged);
        document.getElementById('declinedCards').textContent = this.formatResults(this.results.declined);
        document.getElementById('cvvIssues').textContent = this.formatResults(this.results.cvvIssues);
        document.getElementById('validCards').textContent = this.formatResults(this.results.valid);
        document.getElementById('processingLog').textContent = this.results.log.join('\n');
        
        // Update result box headers with counts
        this.updateResultBoxHeaders();
    }
    
    updateResultBoxHeaders() {
        const updateHeader = (boxId, results, label) => {
            const box = document.getElementById(boxId);
            if (box) {
                const header = box.querySelector('.result-header h3');
                if (header) {
                    const count = results.length;
                    header.textContent = `${label} (${count})`;
                }
            }
        };
        
        updateHeader('authorizedBox', this.results.authorized, '✅ Authorized Cards');
        updateHeader('chargedBox', this.results.charged, '💰 Charged Cards');
        updateHeader('declinedBox', this.results.declined, '❌ Declined Cards');
        updateHeader('cvvIssuesBox', this.results.cvvIssues, '🔒 CVV Issues (CCN Cards)');
        updateHeader('validBox', this.results.valid, '🟢 Valid Cards (Ready for Charging)');
    }
    
    maskCardNumber(cardNumber) {
        if (!cardNumber) return '';
        const cleaned = cardNumber.replace(/\s+/g, '');
        return cleaned.substring(0, 4) + '*'.repeat(cleaned.length - 8) + cleaned.substring(cleaned.length - 4);
    }
    
    logMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.results.log.push(`[${timestamp}] ${message}`);
        document.getElementById('processingLog').textContent = this.results.log.join('\n');
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
        const resultsContainer = document.getElementById('resultsContainer');
        
        // Validate all fields
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Validate Stripe key
        if (!this.validateStripeKeyFormat(data.stripeSecretKey)) {
            this.logMessage('❌ Invalid Stripe secret key format');
            return;
        }
        
        // Clear previous results
        this.clearResults();
        
        // Show loading and results container
        submitBtn.disabled = true;
        loading.style.display = 'block';
        resultsContainer.style.display = 'block';
        
        try {
            // Determine processing mode
            const bulkCards = data.bulkCards?.trim();
            
            if (bulkCards) {
                this.logMessage('🔄 Starting bulk card processing...');
                await this.processBulkCards(bulkCards, data);
            } else {
                this.logMessage('🔄 Starting single card processing...');
                await this.processSingleCard(data);
            }
            
            this.logMessage('✅ Processing completed');
            
        } catch (error) {
            console.error('Payment processing error:', error);
            this.logMessage(`❌ Processing error: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            loading.style.display = 'none';
        }
    }
    
    async processBulkCards(bulkCards, formData) {
        const lines = bulkCards.split('\n').filter(line => line.trim());
        const threads = parseInt(formData.threads) || 1;
        const delay = parseInt(formData.delay) || 500;
        
        this.logMessage(`📊 Processing ${lines.length} cards with ${threads} threads and ${delay}ms delay...`);
        
        // Process cards in batches based on thread count
        const batchSize = Math.ceil(lines.length / threads);
        const batches = [];
        
        for (let i = 0; i < lines.length; i += batchSize) {
            batches.push(lines.slice(i, i + batchSize));
        }
        
        this.logMessage(`🔄 Split into ${batches.length} batches of ~${batchSize} cards each`);
        
        // Process batches concurrently
        const promises = batches.map((batch, batchIndex) => 
            this.processBatch(batch, formData, delay, batchIndex + 1)
        );
        
        await Promise.all(promises);
        
        this.logMessage(`✅ Bulk processing completed with ${threads} threads`);
    }
    
    async processBatch(batch, formData, delay, batchNumber) {
        this.logMessage(`🔄 Starting batch ${batchNumber} with ${batch.length} cards...`);
        
        for (let i = 0; i < batch.length; i++) {
            const line = batch[i].trim();
            const parts = line.split('|');
            
            if (parts.length !== 4) {
                this.logMessage(`⚠️ Skipping invalid format: ${line}`);
                continue;
            }
            
            const [cardNumber, month, year, cvv] = parts;
            
            // Normalize year format
            const normalizedYear = year.length === 2 ? year : year.slice(-2);
            
            const cardData = {
                cardNumber: cardNumber.replace(/\s+/g, ''),
                expiry: `${month}/${normalizedYear}`,
                cvv: cvv,
                holderName: formData.cardholderName || this.generateRandomName()
            };
            
            const cardIndex = (batchNumber - 1) * batch.length + i + 1;
            this.logMessage(`🔄 [Batch ${batchNumber}] Processing card ${cardIndex}: ${this.maskCardNumber(cardData.cardNumber)}`);
            
            try {
                await this.processCard(cardData, formData);
                
                // Add delay between requests if configured
                if (delay > 0 && i < batch.length - 1) {
                    await this.sleep(delay);
                }
                
            } catch (error) {
                this.logMessage(`❌ [Batch ${batchNumber}] Error processing card ${cardIndex}: ${error.message}`);
                this.results.declined.push({
                    cardNumber: cardData.cardNumber,
                    expiry: cardData.expiry,
                    cvv: cardData.cvv,
                    status: 'ERROR',
                    reason: error.message
                });
            }
            
            this.updateResultBoxes();
        }
        
        this.logMessage(`✅ Batch ${batchNumber} completed`);
    }
    
    async processSingleCard(formData) {
        const cardData = {
            cardNumber: formData.cardNumber.replace(/\s+/g, ''),
            expiry: formData.expiry,
            cvv: formData.cvv,
            holderName: formData.cardholderName || this.generateRandomName()
        };
        
        this.logMessage(`🔄 Processing single card: ${this.maskCardNumber(cardData.cardNumber)}`);
        
        await this.processCard(cardData, formData);
        this.updateResultBoxes();
    }
    
    async processCard(cardData, formData) {
        // Generate customer data
        const customerData = this.generateCustomerData(cardData.holderName);
        
        // Prepare payment data
        const paymentData = {
            stripeSecretKey: formData.stripeSecretKey,
            operation: formData.operation,
            amount: parseFloat(formData.amount) * 100, // Convert to cents
            currency: formData.currency,
            cardData: cardData,
            customerData: customerData,
            proxyConfig: {
                host: formData.proxyHost,
                port: formData.proxyPort ? parseInt(formData.proxyPort) : null,
                username: formData.proxyUsername,
                password: formData.proxyPassword
            },
            threadsConfig: {
                threads: parseInt(formData.threads) || 1
            },
            delayConfig: {
                delay: parseInt(formData.delay) || 500
            },
            description: formData.description || 'Bulk payment processing',
            userAgent: this.getRandomItem(this.userAgents),
            timestamp: Date.now(),
            sessionId: this.generateSessionId()
        };
        
        // Process payment
        const response = await this.processPayment(paymentData);
        
        // Categorize result
        this.categorizeResult(cardData, response);
        
        return response;
    }
    
    categorizeResult(cardData, response) {
        const result = {
            cardNumber: cardData.cardNumber,
            expiry: cardData.expiry,
            cvv: cardData.cvv,
            status: '',
            reason: '',
            details: null
        };
        
        if (response.success) {
            switch (response.operation) {
                case 'authorization':
                    result.status = 'AUTHORIZED';
                    result.reason = 'Card authorized successfully';
                    result.details = {
                        transactionId: response.transactionId,
                        amount: response.amount || 0
                    };
                    this.results.authorized.push(result);
                    break;
                case 'charge':
                    result.status = 'CHARGED';
                    result.reason = `Charged $${response.amount}`;
                    result.details = {
                        transactionId: response.transactionId,
                        amount: response.amount
                    };
                    this.results.charged.push(result);
                    break;
                case 'auth_capture':
                    result.status = 'CHARGED';
                    result.reason = `Auth & Captured $${response.amount}`;
                    result.details = {
                        transactionId: response.transactionId,
                        authorizationId: response.authorization_id,
                        captureId: response.capture_id,
                        amount: response.amount
                    };
                    this.results.charged.push(result);
                    break;
                default:
                    result.status = 'VALID';
                    result.reason = 'Card is valid and ready for charging';
                    this.results.valid.push(result);
            }
        } else {
            // Enhanced error handling with detailed categorization
            result.details = {
                errorType: response.error_type || 'unknown',
                declineCode: response.decline_code || 'unknown',
                httpStatus: response.http_status || null,
                suggestions: response.suggestions || [],
                responseBody: response.response_body || null,
                timestamp: response.timestamp || new Date().toISOString()
            };
            
            // Handle different types of failures with specific categories
            const errorType = response.error_type || 'unknown';
            const errorMessage = response.error?.toLowerCase() || '';
            
            switch (errorType) {
                case 'authentication_error':
                    result.status = 'KEY_ERROR';
                    result.reason = 'Stripe key authentication failed';
                    this.results.declined.push(result);
                    break;
                    
                case 'permission_error':
                    result.status = 'PERMISSION_ERROR';
                    result.reason = 'Insufficient permissions or account not activated';
                    this.results.declined.push(result);
                    break;
                    
                case 'network_error':
                    result.status = 'NETWORK_ERROR';
                    result.reason = 'Network connection failed';
                    this.results.declined.push(result);
                    break;
                    
                case 'card_error':
                default:
                    // Card-specific errors with enhanced categorization
                    if (errorMessage.includes('cvv') || errorMessage.includes('cvc')) {
                        result.status = 'CVV_ISSUE';
                        result.reason = 'CVV verification failed';
                        this.results.cvvIssues.push(result);
                    } else if (errorMessage.includes('expired')) {
                        result.status = 'EXPIRED';
                        result.reason = 'Card has expired';
                        this.results.declined.push(result);
                    } else if (errorMessage.includes('stolen') || errorMessage.includes('fraud')) {
                        result.status = 'STOLEN';
                        result.reason = 'Card flagged as stolen/fraudulent';
                        this.results.declined.push(result);
                    } else if (errorMessage.includes('insufficient')) {
                        result.status = 'INSUFFICIENT_FUNDS';
                        result.reason = 'Insufficient funds';
                        this.results.declined.push(result);
                    } else if (errorMessage.includes('do_not_honor')) {
                        result.status = 'DO_NOT_HONOR';
                        result.reason = 'Card issuer declined transaction';
                        this.results.declined.push(result);
                    } else {
                        result.status = 'DECLINED';
                        result.reason = response.error || 'Unknown error';
                        this.results.declined.push(result);
                    }
                    break;
            }
        }
        
        // Enhanced logging with more details
        const statusIcon = this.getStatusIcon(result.status);
        const maskedCard = this.maskCardNumber(result.cardNumber);
        let logMessage = `${statusIcon} ${result.status}: ${maskedCard} - ${result.reason}`;
        
        // Add HTTP status and error details to log
        if (!response.success && result.details) {
            if (result.details.httpStatus) {
                logMessage += ` (HTTP: ${result.details.httpStatus})`;
            }
            if (result.details.errorType && result.details.errorType !== 'unknown') {
                logMessage += ` (Type: ${result.details.errorType})`;
            }
            if (result.details.declineCode && result.details.declineCode !== 'unknown') {
                logMessage += ` (Code: ${result.details.declineCode})`;
            }
        }
        
        this.logMessage(logMessage);
        
        // Log additional details for errors
        if (!response.success && result.details && result.details.suggestions.length > 0) {
            this.logMessage(`💡 Suggestions for ${maskedCard}: ${result.details.suggestions.join(', ')}`);
        }
        
        // Log response body for network errors in debug mode
        if (!response.success && result.details && result.details.responseBody && result.details.errorType === 'network_error') {
            this.logMessage(`🔍 Network error details for ${maskedCard}: ${JSON.stringify(result.details.responseBody)}`);
        }
    }
    
    getStatusIcon(status) {
        const icons = {
            'AUTHORIZED': '✅',
            'CHARGED': '💰',
            'VALID': '🟢',
            'CVV_ISSUE': '🔒',
            'EXPIRED': '⏰',
            'STOLEN': '🚨',
            'INSUFFICIENT_FUNDS': '💸',
            'DO_NOT_HONOR': '⛔',
            'DECLINED': '❌',
            'KEY_ERROR': '🔑',
            'PERMISSION_ERROR': '🚫',
            'NETWORK_ERROR': '🌐'
        };
        return icons[status] || '❓';
    }
    
    generateCustomerData(holderName) {
        const firstName = holderName ? holderName.split(' ')[0] : this.getRandomItem(this.firstNames);
        const lastName = holderName ? holderName.split(' ')[1] || this.getRandomItem(this.lastNames) : this.getRandomItem(this.lastNames);
        const email = this.generateRandomEmail(firstName, lastName);
        
        return {
            firstName,
            lastName,
            email,
            name: `${firstName} ${lastName}`,
            userAgent: this.getRandomItem(this.userAgents),
            timestamp: Date.now()
        };
    }
    
    generateRandomName() {
        const firstName = this.getRandomItem(this.firstNames);
        const lastName = this.getRandomItem(this.lastNames);
        return `${firstName} ${lastName}`;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async processPayment(paymentData) {
        // Use the backend PHP file for actual processing
        const response = await fetch('backend.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': paymentData.userAgent,
                'X-Session-ID': paymentData.sessionId
            },
            body: JSON.stringify(paymentData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        return result;
    }
    
    /**
     * Encrypt data for transmission
     * 
     * For key validation, we use simple base64 encoding instead of full encryption
     * to avoid the complexity of client-side encryption while still providing
     * basic obfuscation during transmission. The backend handles this properly
     * by attempting base64 decode first, then falling back to full decryption
     * for backward compatibility.
     * 
     * @param {string} data - The data to encode
     * @returns {string} Base64 encoded data
     */
    encryptData(data) {
        // Simple client-side encoding (backend handles real encryption)
        return btoa(data);
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    showResult(message, type) {
        // Legacy function for backward compatibility
        this.logMessage(`${type === 'success' ? '✅' : '❌'} ${message}`);
    }
}

// Initialize the enhanced payment gateway when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EnhancedStripeGateway();
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