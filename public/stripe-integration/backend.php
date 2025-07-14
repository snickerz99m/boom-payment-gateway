<?php
/**
 * Stripe Payment Gateway Backend
 * PHP backend for secure Stripe API interactions
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, User-Agent');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

class StripePaymentBackend {
    private $encryptionKey;
    private $rateLimiter;
    private $userAgents;
    private $logFile;
    
    public function __construct() {
        // Generate or load encryption key
        $this->encryptionKey = $this->getEncryptionKey();
        
        // Initialize rate limiter
        $this->rateLimiter = new RateLimiter();
        
        // Initialize user agents for rotation
        $this->userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'
        ];
        
        // Set up logging
        $this->logFile = __DIR__ . '/stripe_payment.log';
        
        // Load Stripe PHP SDK if available
        if (file_exists(__DIR__ . '/vendor/autoload.php')) {
            require_once __DIR__ . '/vendor/autoload.php';
        }
    }
    
    /**
     * Process payment request
     */
    public function processPayment() {
        try {
            // Check rate limit
            if (!$this->rateLimiter->checkLimit()) {
                throw new Exception('Rate limit exceeded. Please try again later.');
            }
            
            // Get and validate input
            $input = $this->getInput();
            $this->validateInput($input);
            
            // Decrypt sensitive data
            $decryptedData = $this->decryptSensitiveData($input);
            
            // Generate random user data if needed
            $userData = $this->generateUserData($decryptedData);
            
            // Set up proxy if configured
            $proxyConfig = $this->setupProxy($input);
            
            // Process payment based on operation type
            $result = $this->executePayment($decryptedData, $userData, $proxyConfig);
            
            // Log successful transaction
            $this->logTransaction($result, 'success');
            
            return $this->sendResponse(true, $result);
            
        } catch (Exception $e) {
            // Log error
            $this->logTransaction(['error' => $e->getMessage()], 'error');
            
            return $this->sendResponse(false, null, $e->getMessage());
        }
    }
    
    /**
     * Get input data
     */
    private function getInput() {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON input');
        }
        
        return $input;
    }
    
    /**
     * Validate input data
     */
    private function validateInput($input) {
        $required = ['stripeSecretKey', 'operation', 'cardNumber', 'expiryDate', 'cvv', 'cardholderName', 'email'];
        
        foreach ($required as $field) {
            if (!isset($input[$field]) || empty($input[$field])) {
                throw new Exception("Missing required field: $field");
            }
        }
        
        // Validate email
        if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
            throw new Exception('Invalid email address');
        }
        
        // Validate card number (basic length check)
        $cardNumber = preg_replace('/\s/', '', $input['cardNumber']);
        if (strlen($cardNumber) < 13 || strlen($cardNumber) > 19) {
            throw new Exception('Invalid card number length');
        }
        
        // Validate expiry date
        if (!preg_match('/^\d{2}\/\d{2}$/', $input['expiryDate'])) {
            throw new Exception('Invalid expiry date format');
        }
        
        // Validate CVV
        if (!preg_match('/^\d{3,4}$/', $input['cvv'])) {
            throw new Exception('Invalid CVV');
        }
        
        // Validate operation
        if (!in_array($input['operation'], ['auth', 'charge'])) {
            throw new Exception('Invalid operation type');
        }
        
        // Validate amount for charge operations
        if ($input['operation'] === 'charge' && (!isset($input['amount']) || $input['amount'] <= 0)) {
            throw new Exception('Amount is required for charge operations');
        }
    }
    
    /**
     * Decrypt sensitive data
     */
    private function decryptSensitiveData($input) {
        $sensitiveFields = ['stripeSecretKey', 'cardNumber', 'cvv'];
        $decrypted = $input;
        
        foreach ($sensitiveFields as $field) {
            if (isset($decrypted[$field])) {
                // Simple base64 decoding (matches frontend encryption)
                $decrypted[$field] = base64_decode($decrypted[$field]);
                
                // In production, use proper decryption
                // $decrypted[$field] = $this->decrypt($decrypted[$field]);
            }
        }
        
        return $decrypted;
    }
    
    /**
     * Generate random user data
     */
    private function generateUserData($input) {
        $firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'William', 'Jessica'];
        $lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
        $domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
        
        $firstName = $firstNames[array_rand($firstNames)];
        $lastName = $lastNames[array_rand($lastNames)];
        $domain = $domains[array_rand($domains)];
        
        return [
            'firstName' => $firstName,
            'lastName' => $lastName,
            'fullName' => "$firstName $lastName",
            'email' => strtolower("$firstName.$lastName" . rand(100, 999) . "@$domain"),
            'userAgent' => $this->userAgents[array_rand($this->userAgents)]
        ];
    }
    
    /**
     * Setup proxy configuration
     */
    private function setupProxy($input) {
        if (!isset($input['useProxy']) || !$input['useProxy']) {
            return null;
        }
        
        return [
            'host' => $input['proxyHost'] ?? '',
            'port' => $input['proxyPort'] ?? 8080,
            'username' => $input['proxyUsername'] ?? '',
            'password' => $input['proxyPassword'] ?? ''
        ];
    }
    
    /**
     * Execute payment processing
     */
    private function executePayment($data, $userData, $proxyConfig) {
        $stripeSecretKey = $data['stripeSecretKey'];
        $operation = $data['operation'];
        $amount = $operation === 'charge' ? floatval($data['amount']) : 0;
        
        // Validate Stripe secret key format
        if (!preg_match('/^sk_(test|live)_[A-Za-z0-9]{24,}$/', $stripeSecretKey)) {
            throw new Exception('Invalid Stripe secret key format');
        }
        
        // Process payment via Stripe API
        $paymentResult = $this->processStripePayment($data, $userData, $proxyConfig);
        
        // Format response
        return [
            'success' => true,
            'transactionId' => $paymentResult['id'] ?? 'txn_' . uniqid(),
            'amount' => number_format($amount, 2),
            'currency' => 'USD',
            'status' => $paymentResult['status'] ?? 'completed',
            'message' => $operation === 'auth' ? 'Authorization successful' : 'Payment processed successfully',
            'authCode' => $paymentResult['auth_code'] ?? 'AUTH_' . strtoupper(substr(md5(uniqid()), 0, 8)),
            'customer' => [
                'name' => $userData['fullName'],
                'email' => $userData['email']
            ],
            'card' => [
                'last4' => substr($data['cardNumber'], -4),
                'brand' => $this->getCardBrand($data['cardNumber']),
                'exp_month' => substr($data['expiryDate'], 0, 2),
                'exp_year' => '20' . substr($data['expiryDate'], 3, 2)
            ]
        ];
    }
    
    /**
     * Process payment via Stripe API
     */
    private function processStripePayment($data, $userData, $proxyConfig) {
        $stripeSecretKey = $data['stripeSecretKey'];
        $operation = $data['operation'];
        $amount = $operation === 'charge' ? floatval($data['amount']) * 100 : 0; // Convert to cents
        
        // Prepare Stripe API request
        $stripeData = [
            'card' => [
                'number' => $data['cardNumber'],
                'exp_month' => intval(substr($data['expiryDate'], 0, 2)),
                'exp_year' => intval('20' . substr($data['expiryDate'], 3, 2)),
                'cvc' => $data['cvv']
            ],
            'amount' => $amount,
            'currency' => 'usd',
            'description' => $data['description'] ?? 'Payment transaction'
        ];
        
        // Make API request to Stripe
        $response = $this->makeStripeRequest($stripeSecretKey, $operation, $stripeData, $proxyConfig);
        
        return $response;
    }
    
    /**
     * Make request to Stripe API
     */
    private function makeStripeRequest($secretKey, $operation, $data, $proxyConfig) {
        $endpoint = $operation === 'auth' ? 'payment_intents' : 'charges';
        $url = "https://api.stripe.com/v1/$endpoint";
        
        // Set up cURL
        $ch = curl_init();
        
        // Basic cURL options
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($data),
            CURLOPT_USERPWD => "$secretKey:",
            CURLOPT_HTTPHEADER => [
                'User-Agent: ' . $this->userAgents[array_rand($this->userAgents)],
                'Content-Type: application/x-www-form-urlencoded'
            ],
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2
        ]);
        
        // Configure proxy if provided
        if ($proxyConfig && !empty($proxyConfig['host'])) {
            curl_setopt($ch, CURLOPT_PROXY, $proxyConfig['host'] . ':' . $proxyConfig['port']);
            
            if (!empty($proxyConfig['username'])) {
                curl_setopt($ch, CURLOPT_PROXYUSERPWD, $proxyConfig['username'] . ':' . $proxyConfig['password']);
            }
        }
        
        // Execute request
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);
        
        // Handle cURL errors
        if ($error) {
            throw new Exception("Request failed: $error");
        }
        
        // Parse response
        $responseData = json_decode($response, true);
        
        if ($httpCode !== 200) {
            $errorMessage = $responseData['error']['message'] ?? 'Unknown Stripe API error';
            throw new Exception("Stripe API error: $errorMessage");
        }
        
        return $responseData;
    }
    
    /**
     * Get card brand from card number
     */
    private function getCardBrand($cardNumber) {
        $cardNumber = preg_replace('/\s/', '', $cardNumber);
        
        if (preg_match('/^4/', $cardNumber)) {
            return 'visa';
        } elseif (preg_match('/^5[1-5]/', $cardNumber)) {
            return 'mastercard';
        } elseif (preg_match('/^3[47]/', $cardNumber)) {
            return 'amex';
        } elseif (preg_match('/^6(?:011|5)/', $cardNumber)) {
            return 'discover';
        } else {
            return 'unknown';
        }
    }
    
    /**
     * Get or generate encryption key
     */
    private function getEncryptionKey() {
        $keyFile = __DIR__ . '/.encryption_key';
        
        if (file_exists($keyFile)) {
            return file_get_contents($keyFile);
        } else {
            $key = bin2hex(random_bytes(32));
            file_put_contents($keyFile, $key);
            return $key;
        }
    }
    
    /**
     * Encrypt data
     */
    private function encrypt($data) {
        $cipher = 'AES-256-GCM';
        $key = hex2bin($this->encryptionKey);
        $iv = random_bytes(16);
        
        $encrypted = openssl_encrypt($data, $cipher, $key, 0, $iv, $tag);
        
        return base64_encode($iv . $tag . $encrypted);
    }
    
    /**
     * Decrypt data
     */
    private function decrypt($encryptedData) {
        $cipher = 'AES-256-GCM';
        $key = hex2bin($this->encryptionKey);
        $data = base64_decode($encryptedData);
        
        $iv = substr($data, 0, 16);
        $tag = substr($data, 16, 16);
        $encrypted = substr($data, 32);
        
        return openssl_decrypt($encrypted, $cipher, $key, 0, $iv, $tag);
    }
    
    /**
     * Log transaction
     */
    private function logTransaction($data, $type) {
        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'type' => $type,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'data' => $data
        ];
        
        file_put_contents($this->logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
    }
    
    /**
     * Send JSON response
     */
    private function sendResponse($success, $data = null, $message = null) {
        $response = [
            'success' => $success,
            'timestamp' => date('c')
        ];
        
        if ($data) {
            $response['data'] = $data;
        }
        
        if ($message) {
            $response['message'] = $message;
        }
        
        echo json_encode($response);
        exit;
    }
}

/**
 * Rate Limiter Class
 */
class RateLimiter {
    private $maxRequests = 10;
    private $timeWindow = 60; // 1 minute
    private $storageFile;
    
    public function __construct() {
        $this->storageFile = __DIR__ . '/.rate_limit_data';
    }
    
    /**
     * Check if request is within rate limit
     */
    public function checkLimit() {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $now = time();
        
        // Load existing data
        $data = $this->loadData();
        
        // Clean old entries
        $data = $this->cleanOldEntries($data, $now);
        
        // Check current IP
        if (!isset($data[$ip])) {
            $data[$ip] = [];
        }
        
        // Count requests in current window
        $requests = array_filter($data[$ip], function($timestamp) use ($now) {
            return $timestamp > $now - $this->timeWindow;
        });
        
        // Check limit
        if (count($requests) >= $this->maxRequests) {
            return false;
        }
        
        // Add current request
        $data[$ip][] = $now;
        
        // Save data
        $this->saveData($data);
        
        return true;
    }
    
    /**
     * Load rate limit data
     */
    private function loadData() {
        if (file_exists($this->storageFile)) {
            $content = file_get_contents($this->storageFile);
            return json_decode($content, true) ?: [];
        }
        
        return [];
    }
    
    /**
     * Save rate limit data
     */
    private function saveData($data) {
        file_put_contents($this->storageFile, json_encode($data), LOCK_EX);
    }
    
    /**
     * Clean old entries
     */
    private function cleanOldEntries($data, $now) {
        foreach ($data as $ip => $requests) {
            $data[$ip] = array_filter($requests, function($timestamp) use ($now) {
                return $timestamp > $now - $this->timeWindow;
            });
            
            if (empty($data[$ip])) {
                unset($data[$ip]);
            }
        }
        
        return $data;
    }
}

// Initialize and process request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $backend = new StripePaymentBackend();
    $backend->processPayment();
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>