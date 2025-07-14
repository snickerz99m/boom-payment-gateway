<?php
/**
 * Enhanced Stripe Payment Gateway Backend - Bulk Processing & Advanced Validation
 * Features: Bulk card processing, detailed decline reasons, automatic customer data generation
 */

class StripePaymentBackend {
    
    private $encryptionKey;
    private $rateLimitFile;
    private $logFile;
    private $userAgents;
    private $declineReasons;
    
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
        
        // Decline reason mapping
        $this->declineReasons = [
            'card_declined' => 'Card was declined',
            'expired_card' => 'Card has expired',
            'incorrect_cvc' => 'CVV verification failed',
            'processing_error' => 'Payment processing error',
            'incorrect_number' => 'Invalid card number',
            'invalid_expiry_month' => 'Invalid expiry month',
            'invalid_expiry_year' => 'Invalid expiry year',
            'invalid_cvc' => 'Invalid CVV',
            'insufficient_funds' => 'Insufficient funds',
            'stolen_card' => 'Card reported as stolen',
            'lost_card' => 'Card reported as lost',
            'pickup_card' => 'Card requires pickup',
            'fraudulent' => 'Transaction flagged as fraudulent',
            'do_not_honor' => 'Card issuer declined transaction',
            'generic_decline' => 'Transaction declined by card issuer'
        ];
        
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
     * Process Stripe payment with enhanced validation
     */
    private function processPayment($input) {
        // Decrypt Stripe secret key
        $stripeSecretKey = $this->decryptData($input['stripeSecretKey']);
        
        // Validate Stripe key format
        if (!$this->isValidStripeKey($stripeSecretKey)) {
            throw new Exception('Invalid Stripe secret key format');
        }
        
        // Validate key is alive
        if (!$this->validateStripeKeyAlive($stripeSecretKey)) {
            throw new Exception('Stripe key is dead or invalid');
        }
        
        // Generate customer data if not provided
        $customerData = $this->generateEnhancedCustomerData($input);
        
        // Prepare Stripe payment data
        $paymentData = [
            'amount' => $input['amount'],
            'currency' => $input['currency'],
            'payment_method_data' => [
                'type' => 'card',
                'card' => [
                    'number' => $input['cardData']['cardNumber'],
                    'exp_month' => $this->getExpiryMonth($input['cardData']['expiry']),
                    'exp_year' => $this->getExpiryYear($input['cardData']['expiry']),
                    'cvc' => $input['cardData']['cvv']
                ],
                'billing_details' => [
                    'name' => $customerData['name'],
                    'email' => $customerData['email']
                ]
            ],
            'customer' => [
                'name' => $customerData['name'],
                'email' => $customerData['email']
            ],
            'description' => $input['description'] ?? 'Enhanced payment processing',
            'metadata' => [
                'customer_email' => $customerData['email'],
                'customer_name' => $customerData['name'],
                'session_id' => $input['sessionId'] ?? uniqid('session_'),
                'operation_type' => $input['operation'],
                'processing_time' => date('Y-m-d H:i:s')
            ]
        ];
        
        // Set capture based on operation type
        if ($input['operation'] === 'auth') {
            $paymentData['capture_method'] = 'manual';
            $paymentData['amount'] = 0; // $0 authorization
        } else {
            $paymentData['capture_method'] = 'automatic';
        }
        
        // Execute payment
        try {
            $response = $this->makeStripeRequest($stripeSecretKey, '/v1/payment_intents', $paymentData, $input);
            
            // Handle different operation types
            switch ($input['operation']) {
                case 'auth':
                    return $this->handleAuthorizationResponse($response, $paymentData);
                case 'charge':
                    return $this->handleChargeResponse($response, $paymentData);
                case 'auth_capture':
                    return $this->handleAuthCaptureResponse($response, $paymentData, $stripeSecretKey, $input);
                default:
                    throw new Exception('Invalid operation type');
            }
            
        } catch (Exception $e) {
            // Enhanced error handling with detailed decline reasons
            return $this->handlePaymentError($e, $input['cardData']);
        }
    }
    
    /**
     * Validate if Stripe key is alive
     */
    private function validateStripeKeyAlive($stripeKey) {
        try {
            // Test key by making a simple API call
            $response = $this->makeStripeRequest($stripeKey, '/v1/customers', ['limit' => 1], []);
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Generate enhanced customer data
     */
    private function generateEnhancedCustomerData($input) {
        $firstNames = [
            'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
            'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
            'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa',
            'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra', 'Donald', 'Donna',
            'Steven', 'Carol', 'Paul', 'Ruth', 'Andrew', 'Sharon', 'Joshua', 'Michelle',
            'Kenneth', 'Laura', 'Kevin', 'Sarah', 'Brian', 'Kimberly', 'George', 'Deborah'
        ];
        
        $lastNames = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
            'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
            'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
            'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
            'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
            'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell'
        ];
        
        $domains = [
            'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
            'protonmail.com', 'aol.com', 'live.com', 'me.com', 'mac.com',
            'yandex.com', 'mail.com', 'zoho.com', 'fastmail.com', 'tutanota.com'
        ];
        
        // Use provided name or generate random
        if (isset($input['customerData']['name']) && !empty($input['customerData']['name'])) {
            $nameParts = explode(' ', $input['customerData']['name']);
            $firstName = $nameParts[0];
            $lastName = isset($nameParts[1]) ? $nameParts[1] : $lastNames[array_rand($lastNames)];
        } else {
            $firstName = $firstNames[array_rand($firstNames)];
            $lastName = $lastNames[array_rand($lastNames)];
        }
        
        $domain = $domains[array_rand($domains)];
        
        // Generate realistic email variations
        $emailVariations = [
            strtolower($firstName . '.' . $lastName . '@' . $domain),
            strtolower($firstName . $lastName . '@' . $domain),
            strtolower($firstName . '_' . $lastName . '@' . $domain),
            strtolower($firstName . rand(100, 999) . '@' . $domain),
            strtolower(substr($firstName, 0, 3) . $lastName . '@' . $domain)
        ];
        
        $email = $emailVariations[array_rand($emailVariations)];
        
        return [
            'name' => $firstName . ' ' . $lastName,
            'email' => $email,
            'firstName' => $firstName,
            'lastName' => $lastName,
            'domain' => $domain
        ];
    }
    
    /**
     * Handle authorization response
     */
    private function handleAuthorizationResponse($response, $paymentData) {
        return [
            'success' => true,
            'operation' => 'authorization',
            'transactionId' => $response['id'],
            'status' => $response['status'],
            'amount' => $paymentData['amount'] / 100,
            'currency' => strtoupper($paymentData['currency']),
            'payment_intent' => $response['id'],
            'client_secret' => $response['client_secret'] ?? null,
            'requires_action' => $response['status'] === 'requires_action'
        ];
    }
    
    /**
     * Handle charge response
     */
    private function handleChargeResponse($response, $paymentData) {
        return [
            'success' => true,
            'operation' => 'charge',
            'transactionId' => $response['id'],
            'status' => $response['status'],
            'amount' => $paymentData['amount'] / 100,
            'currency' => strtoupper($paymentData['currency']),
            'payment_intent' => $response['id'],
            'captured' => $response['status'] === 'succeeded'
        ];
    }
    
    /**
     * Handle auth and capture response
     */
    private function handleAuthCaptureResponse($response, $paymentData, $stripeKey, $input) {
        // First authorize
        $authResponse = $response;
        
        // Then capture if authorization successful
        if ($authResponse['status'] === 'requires_capture') {
            try {
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
                    'currency' => strtoupper($paymentData['currency']),
                    'authorization_id' => $authResponse['id'],
                    'capture_id' => $captureResponse['id'],
                    'captured' => $captureResponse['status'] === 'succeeded'
                ];
                
            } catch (Exception $e) {
                return [
                    'success' => false,
                    'operation' => 'auth_capture',
                    'error' => 'Authorization succeeded but capture failed: ' . $e->getMessage(),
                    'authorization_id' => $authResponse['id']
                ];
            }
        }
        
        // If no capture required, return authorization result
        return $this->handleAuthorizationResponse($authResponse, $paymentData);
    }
    
    /**
     * Handle payment errors with detailed decline reasons
     */
    private function handlePaymentError($exception, $cardData) {
        $errorMessage = $exception->getMessage();
        $declineCode = $this->extractDeclineCode($errorMessage);
        
        // Map decline codes to user-friendly messages
        $reason = $this->declineReasons[$declineCode] ?? $errorMessage;
        
        // Determine error category
        $category = $this->categorizeError($declineCode, $errorMessage);
        
        return [
            'success' => false,
            'error' => $reason,
            'decline_code' => $declineCode,
            'category' => $category,
            'card_last4' => substr($cardData['cardNumber'], -4),
            'raw_error' => $errorMessage
        ];
    }
    
    /**
     * Extract decline code from error message
     */
    private function extractDeclineCode($errorMessage) {
        // Common Stripe decline codes
        $codes = [
            'card_declined', 'expired_card', 'incorrect_cvc', 'processing_error',
            'incorrect_number', 'invalid_expiry_month', 'invalid_expiry_year',
            'invalid_cvc', 'insufficient_funds', 'stolen_card', 'lost_card',
            'pickup_card', 'fraudulent', 'do_not_honor', 'generic_decline'
        ];
        
        foreach ($codes as $code) {
            if (stripos($errorMessage, $code) !== false) {
                return $code;
            }
        }
        
        return 'generic_decline';
    }
    
    /**
     * Categorize error for better sorting
     */
    private function categorizeError($declineCode, $errorMessage) {
        $cvvErrors = ['incorrect_cvc', 'invalid_cvc'];
        $expiredErrors = ['expired_card', 'invalid_expiry_month', 'invalid_expiry_year'];
        $stolenErrors = ['stolen_card', 'lost_card', 'pickup_card', 'fraudulent'];
        
        if (in_array($declineCode, $cvvErrors)) {
            return 'cvv_issue';
        } elseif (in_array($declineCode, $expiredErrors)) {
            return 'expired';
        } elseif (in_array($declineCode, $stolenErrors)) {
            return 'stolen';
        } else {
            return 'declined';
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
        
        // Convert data to form format for Stripe API
        $postData = $this->buildQueryString($data);
        
        // Use proxy if configured
        if (!empty($input['proxyConfig']['host'])) {
            return $this->makeProxyRequest($url, $postData, $headers, $input['proxyConfig']);
        } else {
            return $this->makeDirectRequest($url, $postData, $headers);
        }
    }
    
    /**
     * Build query string for Stripe API
     */
    private function buildQueryString($data, $prefix = '') {
        $queryData = [];
        
        foreach ($data as $key => $value) {
            $currentKey = $prefix ? $prefix . '[' . $key . ']' : $key;
            
            if (is_array($value)) {
                $queryData[] = $this->buildQueryString($value, $currentKey);
            } else {
                $queryData[] = urlencode($currentKey) . '=' . urlencode($value);
            }
        }
        
        return implode('&', $queryData);
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
            throw new Exception($errorMessage);
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
            throw new Exception($errorMessage);
        }
        
        return $decodedResponse;
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
        $year = (int)substr($expiry, 3, 2);
        return $year < 50 ? 2000 + $year : 1900 + $year;
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
        $cardRequired = ['cardNumber', 'expiry', 'cvv'];
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
            'session_id' => $input['sessionId'] ?? null,
            'card_last4' => substr($input['cardData']['cardNumber'], -4)
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

// Handle the request
try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $backend = new StripePaymentBackend();
        $backend->handleRequest();
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Internal server error']);
}
?>