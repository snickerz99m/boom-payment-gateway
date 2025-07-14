<?php
/**
 * Stripe Payment Gateway Backend - Advanced Security Implementation
 * Features: AES-256 encryption, rate limiting, user-agent rotation, proxy support
 */

class StripePaymentBackend {
    
    private $encryptionKey;
    private $rateLimitFile;
    private $logFile;
    private $userAgents;
    private $proxyService;
    
    public function __construct() {
        // Security configuration
        $this->encryptionKey = $this->getEncryptionKey();
        $this->rateLimitFile = __DIR__ . '/rate_limit.json';
        $this->logFile = __DIR__ . '/payment_log.txt';
        
        // User agent rotation
        $this->userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
        
        // Initialize proxy service
        $this->proxyService = new ProxyService();
        
        // Set security headers
        $this->setSecurityHeaders();
    }
    
    /**
     * Main API endpoint handler
     */
    public function handleRequest() {
        try {
            // Rate limiting check
            if (!$this->checkRateLimit()) {
                $this->sendErrorResponse('Rate limit exceeded', 429);
                return;
            }
            
            // Validate request method
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                $this->sendErrorResponse('Method not allowed', 405);
                return;
            }
            
            // Get and validate input
            $input = $this->getInput();
            if (!$input) {
                $this->sendErrorResponse('Invalid request data', 400);
                return;
            }
            
            // Validate required fields
            $validationResult = $this->validateInput($input);
            if (!$validationResult['valid']) {
                $this->sendErrorResponse($validationResult['error'], 400);
                return;
            }
            
            // Process payment
            $result = $this->processPayment($input);
            
            // Log transaction
            $this->logTransaction($input, $result);
            
            // Send response
            $this->sendSuccessResponse($result);
            
        } catch (Exception $e) {
            $this->logError($e->getMessage());
            $this->sendErrorResponse('Internal server error', 500);
        }
    }
    
    /**
     * Process Stripe payment with security features
     */
    private function processPayment($input) {
        // Decrypt Stripe secret key
        $stripeSecretKey = $this->decryptData($input['stripeSecretKey']);
        
        // Validate Stripe key format
        if (!$this->isValidStripeKey($stripeSecretKey)) {
            throw new Exception('Invalid Stripe secret key');
        }
        
        // Generate random customer data if not provided
        $customerData = $this->generateCustomerData($input);
        
        // Prepare Stripe payment data
        $paymentData = [
            'amount' => $input['amount'],
            'currency' => $input['currency'],
            'source' => [
                'object' => 'card',
                'number' => $input['cardData']['number'],
                'exp_month' => $this->getExpiryMonth($input['cardData']['expiry']),
                'exp_year' => $this->getExpiryYear($input['cardData']['expiry']),
                'cvc' => $input['cardData']['cvv']
            ],
            'description' => $input['description'] ?? 'Payment processed via secure gateway',
            'metadata' => [
                'customer_email' => $customerData['email'],
                'customer_name' => $customerData['name'],
                'session_id' => $input['sessionId'] ?? uniqid('session_'),
                'operation_type' => $input['operation']
            ]
        ];
        
        // Execute payment based on operation type
        switch ($input['operation']) {
            case 'auth':
                return $this->authorizePayment($stripeSecretKey, $paymentData, $input);
            case 'charge':
                return $this->chargePayment($stripeSecretKey, $paymentData, $input);
            case 'auth_capture':
                return $this->authCapturePayment($stripeSecretKey, $paymentData, $input);
            default:
                throw new Exception('Invalid operation type');
        }
    }
    
    /**
     * Authorize payment ($0 or specified amount)
     */
    private function authorizePayment($stripeKey, $paymentData, $input) {
        // For auth operations, typically use $0 or minimum amount
        $paymentData['amount'] = $input['operation'] === 'auth' ? 0 : $paymentData['amount'];
        $paymentData['capture'] = false; // Don't capture immediately
        
        $response = $this->makeStripeRequest($stripeKey, '/v1/payment_intents', $paymentData, $input);
        
        return [
            'success' => true,
            'operation' => 'authorization',
            'transactionId' => $response['id'],
            'status' => $response['status'],
            'amount' => $paymentData['amount'] / 100,
            'currency' => $paymentData['currency'],
            'payment_intent' => $response['id'],
            'client_secret' => $response['client_secret'] ?? null
        ];
    }
    
    /**
     * Charge payment immediately
     */
    private function chargePayment($stripeKey, $paymentData, $input) {
        $paymentData['capture'] = true; // Capture immediately
        
        $response = $this->makeStripeRequest($stripeKey, '/v1/payment_intents', $paymentData, $input);
        
        return [
            'success' => true,
            'operation' => 'charge',
            'transactionId' => $response['id'],
            'status' => $response['status'],
            'amount' => $paymentData['amount'] / 100,
            'currency' => $paymentData['currency'],
            'payment_intent' => $response['id']
        ];
    }
    
    /**
     * Authorize and capture payment
     */
    private function authCapturePayment($stripeKey, $paymentData, $input) {
        // First authorize
        $paymentData['capture'] = false;
        $authResponse = $this->makeStripeRequest($stripeKey, '/v1/payment_intents', $paymentData, $input);
        
        // Then capture
        $captureData = ['amount_to_capture' => $paymentData['amount']];
        $captureResponse = $this->makeStripeRequest(
            $stripeKey, 
            '/v1/payment_intents/' . $authResponse['id'] . '/capture', 
            $captureData, 
            $input
        );
        
        return [
            'success' => true,
            'operation' => 'auth_capture',
            'transactionId' => $authResponse['id'],
            'status' => $captureResponse['status'],
            'amount' => $paymentData['amount'] / 100,
            'currency' => $paymentData['currency'],
            'authorization_id' => $authResponse['id'],
            'capture_id' => $captureResponse['id']
        ];
    }
    
    /**
     * Make secure request to Stripe API
     */
    private function makeStripeRequest($stripeKey, $endpoint, $data, $input) {
        $url = 'https://api.stripe.com' . $endpoint;
        
        // Get random user agent
        $userAgent = $this->getRandomUserAgent();
        
        // Prepare headers
        $headers = [
            'Authorization: Bearer ' . $stripeKey,
            'Content-Type: application/x-www-form-urlencoded',
            'User-Agent: ' . $userAgent,
            'Stripe-Version: 2023-10-16'
        ];
        
        // Convert data to form format
        $postData = http_build_query($data);
        
        // Use proxy if configured
        if (!empty($input['proxyConfig']['host'])) {
            return $this->makeProxyRequest($url, $postData, $headers, $input['proxyConfig']);
        } else {
            return $this->makeDirectRequest($url, $postData, $headers);
        }
    }
    
    /**
     * Make direct request to Stripe
     */
    private function makeDirectRequest($url, $postData, $headers) {
        $ch = curl_init();
        
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $postData,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);
        
        if ($response === false || !empty($error)) {
            throw new Exception('cURL error: ' . $error);
        }
        
        $decodedResponse = json_decode($response, true);
        
        if ($httpCode >= 400) {
            $errorMessage = $decodedResponse['error']['message'] ?? 'Unknown Stripe error';
            throw new Exception('Stripe API error: ' . $errorMessage);
        }
        
        return $decodedResponse;
    }
    
    /**
     * Make request through proxy
     */
    private function makeProxyRequest($url, $postData, $headers, $proxyConfig) {
        $ch = curl_init();
        
        $curlOptions = [
            CURLOPT_URL => $url,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $postData,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_PROXY => $proxyConfig['host'] . ':' . $proxyConfig['port']
        ];
        
        // Add proxy authentication if provided
        if (!empty($proxyConfig['username']) && !empty($proxyConfig['password'])) {
            $curlOptions[CURLOPT_PROXYUSERPWD] = $proxyConfig['username'] . ':' . $proxyConfig['password'];
        }
        
        curl_setopt_array($ch, $curlOptions);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);
        
        if ($response === false || !empty($error)) {
            throw new Exception('Proxy cURL error: ' . $error);
        }
        
        $decodedResponse = json_decode($response, true);
        
        if ($httpCode >= 400) {
            $errorMessage = $decodedResponse['error']['message'] ?? 'Unknown Stripe error';
            throw new Exception('Stripe API error: ' . $errorMessage);
        }
        
        return $decodedResponse;
    }
    
    /**
     * Generate random customer data
     */
    private function generateCustomerData($input) {
        $firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda'];
        $lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
        $domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
        
        $firstName = $firstNames[array_rand($firstNames)];
        $lastName = $lastNames[array_rand($lastNames)];
        $domain = $domains[array_rand($domains)];
        
        return [
            'name' => $firstName . ' ' . $lastName,
            'email' => strtolower($firstName . '.' . $lastName . rand(100, 999) . '@' . $domain),
            'firstName' => $firstName,
            'lastName' => $lastName
        ];
    }
    
    /**
     * Encrypt sensitive data
     */
    private function encryptData($data) {
        $method = 'AES-256-GCM';
        $key = $this->encryptionKey;
        $iv = random_bytes(16);
        
        $encrypted = openssl_encrypt($data, $method, $key, OPENSSL_RAW_DATA, $iv, $tag);
        
        return base64_encode($iv . $tag . $encrypted);
    }
    
    /**
     * Decrypt sensitive data
     */
    private function decryptData($encryptedData) {
        $method = 'AES-256-GCM';
        $key = $this->encryptionKey;
        
        $data = base64_decode($encryptedData);
        $iv = substr($data, 0, 16);
        $tag = substr($data, 16, 16);
        $encrypted = substr($data, 32);
        
        $decrypted = openssl_decrypt($encrypted, $method, $key, OPENSSL_RAW_DATA, $iv, $tag);
        
        if ($decrypted === false) {
            throw new Exception('Failed to decrypt data');
        }
        
        return $decrypted;
    }
    
    /**
     * Get or generate encryption key
     */
    private function getEncryptionKey() {
        $keyFile = __DIR__ . '/encryption.key';
        
        if (file_exists($keyFile)) {
            return file_get_contents($keyFile);
        } else {
            $key = random_bytes(32);
            file_put_contents($keyFile, $key);
            chmod($keyFile, 0600);
            return $key;
        }
    }
    
    /**
     * Validate Stripe secret key format
     */
    private function isValidStripeKey($key) {
        return preg_match('/^sk_(test|live)_[a-zA-Z0-9]+$/', $key);
    }
    
    /**
     * Get random user agent
     */
    private function getRandomUserAgent() {
        return $this->userAgents[array_rand($this->userAgents)];
    }
    
    /**
     * Extract expiry month from MM/YY format
     */
    private function getExpiryMonth($expiry) {
        return (int)substr($expiry, 0, 2);
    }
    
    /**
     * Extract expiry year from MM/YY format
     */
    private function getExpiryYear($expiry) {
        return 2000 + (int)substr($expiry, 3, 2);
    }
    
    /**
     * Rate limiting check
     */
    private function checkRateLimit() {
        $clientIp = $_SERVER['REMOTE_ADDR'];
        $currentTime = time();
        $timeWindow = 60; // 1 minute
        $maxRequests = 100;
        
        // Load rate limit data
        $rateLimitData = [];
        if (file_exists($this->rateLimitFile)) {
            $rateLimitData = json_decode(file_get_contents($this->rateLimitFile), true) ?: [];
        }
        
        // Clean old entries
        $rateLimitData = array_filter($rateLimitData, function($data) use ($currentTime, $timeWindow) {
            return ($currentTime - $data['timestamp']) < $timeWindow;
        });
        
        // Check current IP
        $ipRequests = array_filter($rateLimitData, function($data) use ($clientIp) {
            return $data['ip'] === $clientIp;
        });
        
        if (count($ipRequests) >= $maxRequests) {
            return false;
        }
        
        // Add current request
        $rateLimitData[] = [
            'ip' => $clientIp,
            'timestamp' => $currentTime
        ];
        
        // Save rate limit data
        file_put_contents($this->rateLimitFile, json_encode($rateLimitData));
        
        return true;
    }
    
    /**
     * Set security headers
     */
    private function setSecurityHeaders() {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('X-XSS-Protection: 1; mode=block');
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        header('Content-Security-Policy: default-src \'self\'');
        header('Referrer-Policy: strict-origin-when-cross-origin');
    }
    
    /**
     * Get and validate input
     */
    private function getInput() {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            return false;
        }
        
        return $input;
    }
    
    /**
     * Validate input data
     */
    private function validateInput($input) {
        $required = ['stripeSecretKey', 'operation', 'amount', 'currency', 'cardData'];
        
        foreach ($required as $field) {
            if (!isset($input[$field]) || empty($input[$field])) {
                return ['valid' => false, 'error' => "Missing required field: $field"];
            }
        }
        
        // Validate card data
        $cardRequired = ['number', 'expiry', 'cvv'];
        foreach ($cardRequired as $field) {
            if (!isset($input['cardData'][$field]) || empty($input['cardData'][$field])) {
                return ['valid' => false, 'error' => "Missing required card field: $field"];
            }
        }
        
        // Validate operation type
        $validOperations = ['auth', 'charge', 'auth_capture'];
        if (!in_array($input['operation'], $validOperations)) {
            return ['valid' => false, 'error' => 'Invalid operation type'];
        }
        
        // Validate amount
        if (!is_numeric($input['amount']) || $input['amount'] < 0) {
            return ['valid' => false, 'error' => 'Invalid amount'];
        }
        
        return ['valid' => true];
    }
    
    /**
     * Log transaction
     */
    private function logTransaction($input, $result) {
        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'ip' => $_SERVER['REMOTE_ADDR'],
            'operation' => $input['operation'],
            'amount' => $input['amount'],
            'currency' => $input['currency'],
            'success' => $result['success'],
            'transaction_id' => $result['transactionId'] ?? null,
            'session_id' => $input['sessionId'] ?? null
        ];
        
        file_put_contents($this->logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
    }
    
    /**
     * Log error
     */
    private function logError($message) {
        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'ip' => $_SERVER['REMOTE_ADDR'],
            'error' => $message
        ];
        
        file_put_contents($this->logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
    }
    
    /**
     * Send success response
     */
    private function sendSuccessResponse($data) {
        header('Content-Type: application/json');
        echo json_encode([
            'success' => true,
            'data' => $data,
            'timestamp' => time()
        ]);
    }
    
    /**
     * Send error response
     */
    private function sendErrorResponse($message, $statusCode = 400) {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => $message,
            'timestamp' => time()
        ]);
    }
}

/**
 * Simple proxy service class
 */
class ProxyService {
    // Placeholder for proxy functionality
    // In production, this would contain actual proxy implementation
}

// Handle the request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $backend = new StripePaymentBackend();
    $backend->handleRequest();
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
?>