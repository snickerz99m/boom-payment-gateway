<?php
/**
 * Enhanced Stripe Payment Gateway Backend - Bulk Processing & Advanced Validation
 * Features: Bulk card processing, detailed decline reasons, automatic customer data generation
 */

class EnhancedStripeBackend {
    
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
            
            // Check if this is a key validation request
            if (isset($input['action']) && $input['action'] === 'validate_key') {
                $this->handleKeyValidation($input);
                return;
            }
            
            // Validate required fields for payment processing
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
            $this->logError('Payment processing exception: ' . $e->getMessage());
            
            // SAFETY FIX: Safely access input variables that might not be defined
            // This prevents errors when exceptions occur before input is processed
            $errorDetails = [
                'error_message' => $e->getMessage(),
                'operation' => isset($input['operation']) ? $input['operation'] : 'unknown',
                'amount' => isset($input['amount']) ? $input['amount'] : 'unknown',
                'currency' => isset($input['currency']) ? $input['currency'] : 'unknown',
                'trace' => $e->getTraceAsString()
            ];
            
            // Log detailed error for debugging
            $this->logMessage('Detailed error: ' . json_encode($errorDetails));
            
            $this->sendErrorResponse('Internal server error: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * Handle key validation requests
     * 
     * This method validates Stripe secret keys by:
     * 1. Accepting base64 encoded keys from the frontend (for security)
     * 2. Attempting to decode the key - falls back to decryption for backward compatibility
     * 3. Validating the key format (must start with sk_test_ or sk_live_)
     * 4. Making a test request to Stripe's /v1/balance endpoint
     * 5. Returning detailed validation results with error handling
     */
    private function handleKeyValidation($input) {
        try {
            // Validate required fields for key validation
            if (!isset($input['stripeSecretKey']) || empty($input['stripeSecretKey'])) {
                $this->sendErrorResponse('Missing Stripe secret key', 400);
                return;
            }
            
            // For key validation, we expect base64 encoded key from frontend
            // Try to decode the key - if it fails, try to decrypt it (backward compatibility)
            $stripeSecretKey = null;
            
            // First, try base64 decoding (new approach for key validation)
            $decodedKey = base64_decode($input['stripeSecretKey'], true);
            if ($decodedKey !== false && $this->isValidStripeKey($decodedKey)) {
                $stripeSecretKey = $decodedKey;
                $this->logMessage('Key validation using base64 decoding');
            } else {
                // Fallback to decryption (for backward compatibility)
                try {
                    $stripeSecretKey = $this->decryptData($input['stripeSecretKey']);
                    $this->logMessage('Key validation using decryption');
                } catch (Exception $e) {
                    $this->logError('Both base64 decode and decryption failed: ' . $e->getMessage());
                    $this->sendErrorResponse('Invalid key format - unable to decode', 400);
                    return;
                }
            }
            
            // Validate key format
            if (!$this->isValidStripeKey($stripeSecretKey)) {
                $this->sendErrorResponse('Invalid Stripe secret key format', 400);
                return;
            }
            
            // Validate key is alive and get detailed information
            $validationResult = $this->validateStripeKeyAlive($stripeSecretKey);
            
            // Send validation result
            $this->sendSuccessResponse([
                'key_type' => $this->getKeyType($stripeSecretKey),
                'validation' => $validationResult,
                'timestamp' => date('Y-m-d H:i:s')
            ]);
            
        } catch (Exception $e) {
            $this->logError('Key validation error: ' . $e->getMessage());
            $this->sendErrorResponse('Key validation failed: ' . $e->getMessage(), 400);
        }
    }
    
    /**
     * Process payment with threading and delay support
     */
    private function processPayment($input) {
        // Get threads and delay configuration
        $threadsConfig = $this->getThreadsConfig($input);
        $delayConfig = $this->getDelayConfig($input);
        
        // Log processing configuration
        $this->logMessage("Processing with {$threadsConfig['threads']} threads and {$delayConfig['delay']}ms delay");
        
        // Apply delay if configured
        if ($delayConfig['delay'] > 0) {
            usleep($delayConfig['delay'] * 1000); // Convert ms to microseconds
        }
        
        // Decrypt or decode Stripe secret key
        $stripeSecretKey = $this->processStripeKey($input['stripeSecretKey']);
        
        // Validate Stripe key format
        if (!$this->isValidStripeKey($stripeSecretKey)) {
            throw new Exception('Invalid Stripe secret key format');
        }
        
        // Validate key is alive and has proper permissions
        $keyValidation = $this->validateStripeKeyAlive($stripeSecretKey);
        if (!$keyValidation['valid']) {
            throw new Exception($keyValidation['message']);
        }
        
        // Log successful key validation
        $this->logMessage("Key validation successful for " . $this->getKeyType($stripeSecretKey) . " key");
        
        // Generate customer data if not provided
        $customerData = $this->generateEnhancedCustomerData($input);
        
        // Normalize amount to integer (Stripe expects amounts in cents)
        $amount = (int)$input['amount'];
        
        // Prepare Stripe payment data
        $paymentData = [
            'amount' => $amount,
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
                'processing_time' => date('Y-m-d H:i:s'),
                'key_type' => $this->getKeyType($stripeSecretKey),
                'ip_address' => $_SERVER['REMOTE_ADDR'],
                'threads_config' => $threadsConfig['threads'],
                'delay_config' => $delayConfig['delay']
            ]
        ];
        
        // Set capture based on operation type
        if ($input['operation'] === 'auth') {
            $paymentData['capture_method'] = 'manual';
            // Keep the original amount for auth operations, don't set to 0
        } else {
            $paymentData['capture_method'] = 'automatic';
        }
        
        // Execute payment with enhanced error handling
        try {
            $response = $this->makeStripeRequest($stripeSecretKey, '/v1/payment_intents', $paymentData, $input, 'POST');
            
            // Log successful payment processing
            $this->logMessage("Payment processing successful: " . ($response['id'] ?? 'unknown'));
            
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
            $this->logMessage("Payment processing failed: " . $e->getMessage());
            return $this->handlePaymentError($e, $input['cardData'], $stripeSecretKey);
        }
    }
    
    /**
     * Get threads configuration from input
     */
    private function getThreadsConfig($input) {
        $defaultThreads = 1;
        $maxThreads = 10;
        
        $threads = isset($input['threadsConfig']['threads']) ? 
            (int)$input['threadsConfig']['threads'] : $defaultThreads;
        
        // Validate threads range
        if ($threads < 1) {
            $threads = 1;
        } elseif ($threads > $maxThreads) {
            $threads = $maxThreads;
        }
        
        return [
            'threads' => $threads,
            'max_threads' => $maxThreads,
            'default_threads' => $defaultThreads
        ];
    }
    
    /**
     * Get delay configuration from input
     */
    private function getDelayConfig($input) {
        $defaultDelay = 0;
        $maxDelay = 10000; // 10 seconds max
        
        $delay = isset($input['delayConfig']['delay']) ? 
            (int)$input['delayConfig']['delay'] : $defaultDelay;
        
        // Validate delay range
        if ($delay < 0) {
            $delay = 0;
        } elseif ($delay > $maxDelay) {
            $delay = $maxDelay;
        }
        
        return [
            'delay' => $delay,
            'max_delay' => $maxDelay,
            'default_delay' => $defaultDelay
        ];
    }
    
    /**
     * Validate if Stripe key is alive and has proper permissions
     * 
     * This method tests the Stripe key by making a request to the /v1/balance endpoint,
     * which is the recommended approach for validating API keys according to Stripe documentation.
     * 
     * @param string $stripeKey The Stripe secret key to validate
     * @return array Validation result with detailed error information
     */
    private function validateStripeKeyAlive($stripeKey) {
        try {
            // Log the validation attempt
            $this->logMessage("Validating Stripe key: " . $this->getKeyType($stripeKey) . " key");
            
            // Test key by making a simple API call to the balance endpoint
            // This is the recommended approach for validating Stripe keys
            // IMPORTANT: Use GET method for /v1/balance endpoint with no payload
            $response = $this->makeStripeRequest($stripeKey, '/v1/balance', [], [], 'GET');
            
            // Log successful validation with detailed information
            $this->logValidationResult($stripeKey, true, 'Key validation successful', $response);
            
            return [
                'valid' => true,
                'message' => 'Valid Stripe key with proper permissions',
                'endpoint_tested' => '/v1/balance',
                'key_type' => $this->getKeyType($stripeKey),
                'response_received' => true,
                'timestamp' => date('Y-m-d H:i:s'),
                'balance_available' => isset($response['available']) ? $response['available'] : null,
                'balance_pending' => isset($response['pending']) ? $response['pending'] : null
            ];
        } catch (Exception $e) {
            // Parse error details with enhanced information
            $errorDetails = $this->parseStripeError($e->getMessage());
            
            // Extract HTTP status code and response body from error message
            $httpStatus = $this->extractHttpStatus($e->getMessage());
            $responseBody = $this->extractResponseBody($e->getMessage());
            
            // Enhanced logging with HTTP status codes, error messages, and response bodies
            $this->logValidationResult($stripeKey, false, $e->getMessage(), [
                'http_status' => $httpStatus,
                'response_body' => $responseBody,
                'error_details' => $errorDetails,
                'endpoint_tested' => '/v1/balance',
                'timestamp' => date('Y-m-d H:i:s')
            ]);
            
            return [
                'valid' => false,
                'message' => $errorDetails['message'],
                'error_code' => $errorDetails['code'],
                'error_type' => $errorDetails['type'],
                'http_status' => $httpStatus,
                'response_body' => $responseBody,
                'endpoint_tested' => '/v1/balance',
                'raw_error' => $e->getMessage(),
                'timestamp' => date('Y-m-d H:i:s')
            ];
        }
    }
    
    /**
     * Extract HTTP status code from error message
     */
    private function extractHttpStatus($errorMessage) {
        if (preg_match('/HTTP.*?(\d{3})/', $errorMessage, $matches)) {
            return intval($matches[1]);
        }
        return null;
    }
    
    /**
     * Extract response body from error message
     */
    private function extractResponseBody($errorMessage) {
        // Try to extract JSON response from error message
        if (preg_match('/\{.*\}/', $errorMessage, $matches)) {
            $json = json_decode($matches[0], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $json;
            }
        }
        return null;
    }
    
    /**
     * Parse Stripe error message to extract meaningful information
     */
    private function parseStripeError($errorMessage) {
        // Common Stripe error patterns with more comprehensive matching
        $errorPatterns = [
            'Invalid API Key' => [
                'code' => 'invalid_api_key',
                'type' => 'authentication_error',
                'message' => 'Invalid API Key - Check your key format and permissions'
            ],
            'No such account' => [
                'code' => 'account_not_found',
                'type' => 'authentication_error',
                'message' => 'Account not found - Key may be invalid or account deleted'
            ],
            'Expired key' => [
                'code' => 'expired_key',
                'type' => 'authentication_error',
                'message' => 'Expired key - Please generate a new key'
            ],
            'Your account cannot currently make live charges' => [
                'code' => 'account_not_activated',
                'type' => 'permission_error',
                'message' => 'Account not activated for live charges'
            ],
            'The provided key does not have access' => [
                'code' => 'insufficient_permissions',
                'type' => 'permission_error',
                'message' => 'Invalid permissions - Key lacks required permissions'
            ],
            'Connection error' => [
                'code' => 'connection_error',
                'type' => 'network_error',
                'message' => 'Network error - Check internet connection and proxy settings'
            ],
            'SSL certificate problem' => [
                'code' => 'ssl_error',
                'type' => 'network_error',
                'message' => 'SSL certificate problem - Check SSL configuration'
            ],
            'Could not resolve host' => [
                'code' => 'dns_error',
                'type' => 'network_error',
                'message' => 'DNS resolution failed - Check network connection'
            ],
            'Operation timed out' => [
                'code' => 'timeout_error',
                'type' => 'network_error',
                'message' => 'Request timed out - Check network connection and try again'
            ],
            'Connection timed out' => [
                'code' => 'connection_timeout',
                'type' => 'network_error',
                'message' => 'Connection timed out - Check network connection'
            ],
            'DNS resolution failed' => [
                'code' => 'dns_error',
                'type' => 'network_error',
                'message' => 'DNS resolution failed - Unable to resolve api.stripe.com'
            ],
            'Network error' => [
                'code' => 'network_error',
                'type' => 'network_error',
                'message' => 'Network error - Check internet connection'
            ],
            'Unable to decode' => [
                'code' => 'invalid_key_format',
                'type' => 'authentication_error',
                'message' => 'Invalid key format - Unable to decode key'
            ],
            'HTTP Status: 401' => [
                'code' => 'unauthorized',
                'type' => 'authentication_error',
                'message' => 'Unauthorized - Invalid API key or insufficient permissions'
            ],
            'HTTP Status: 403' => [
                'code' => 'forbidden',
                'type' => 'permission_error',
                'message' => 'Forbidden - Access denied, check account permissions'
            ],
            'HTTP Status: 404' => [
                'code' => 'not_found',
                'type' => 'api_error',
                'message' => 'Not found - API endpoint not found'
            ],
            'HTTP Status: 429' => [
                'code' => 'rate_limit_exceeded',
                'type' => 'api_error',
                'message' => 'Rate limit exceeded - Too many requests'
            ],
            'HTTP Status: 500' => [
                'code' => 'server_error',
                'type' => 'api_error',
                'message' => 'Stripe server error - Try again later'
            ],
            'HTTP Status: 502' => [
                'code' => 'bad_gateway',
                'type' => 'network_error',
                'message' => 'Bad gateway - Stripe service temporarily unavailable'
            ],
            'HTTP Status: 503' => [
                'code' => 'service_unavailable',
                'type' => 'network_error',
                'message' => 'Service unavailable - Stripe temporarily unavailable'
            ]
        ];
        
        foreach ($errorPatterns as $pattern => $details) {
            if (stripos($errorMessage, $pattern) !== false) {
                return $details;
            }
        }
        
        // Default error if no pattern matches
        return [
            'code' => 'unknown_error',
            'type' => 'api_error',
            'message' => 'Unknown error occurred: ' . substr($errorMessage, 0, 100)
        ];
    }
    
    /**
     * Log validation result with detailed information including HTTP status codes and response bodies
     */
    private function logValidationResult($stripeKey, $success, $message, $response) {
        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'ip' => $_SERVER['REMOTE_ADDR'],
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
            'key_type' => $this->getKeyType($stripeKey),
            'key_prefix' => substr($stripeKey, 0, 20) . '...',
            'validation_success' => $success,
            'message' => $message,
            'endpoint_tested' => $response['endpoint_tested'] ?? '/v1/charges'
        ];
        
        if ($success) {
            // For successful validations, log basic response info
            $logEntry['response_summary'] = [
                'endpoint_tested' => $response['endpoint_tested'] ?? '/v1/balance',
                'response_received' => $response['response_received'] ?? true,
                'timestamp' => $response['timestamp'] ?? date('Y-m-d H:i:s')
            ];
        } else {
            // For failed validations, log detailed error information
            $logEntry['error_details'] = [
                'http_status' => $response['http_status'] ?? null,
                'response_body' => $response['response_body'] ?? null,
                'error_details' => $response['error_details'] ?? null,
                'endpoint_tested' => $response['endpoint_tested'] ?? '/v1/balance',
                'timestamp' => $response['timestamp'] ?? date('Y-m-d H:i:s')
            ];
            
            // Add network-specific information for network errors
            if (isset($response['error_details']['type']) && $response['error_details']['type'] === 'network_error') {
                $logEntry['network_info'] = [
                    'curl_version' => curl_version()['version'] ?? 'unknown',
                    'ssl_version' => curl_version()['ssl_version'] ?? 'unknown',
                    'proxy_configured' => !empty($_POST['proxyConfig']['host']) || !empty($_REQUEST['proxyConfig']['host'])
                ];
            }
        }
        
        // Write detailed log entry
        file_put_contents($this->logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
        
        // Also log to error_log for server-level monitoring
        error_log("Stripe Key Validation: " . ($success ? 'SUCCESS' : 'FAILED') . " - " . $message . " - Key: " . substr($stripeKey, 0, 20) . '...');
    }
    
    /**
     * Get key type (live or test)
     */
    private function getKeyType($key) {
        if (strpos($key, 'sk_live_') === 0) {
            return 'live';
        } elseif (strpos($key, 'sk_test_') === 0) {
            return 'test';
        }
        return 'unknown';
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
        // First check the authorization response
        $authResponse = $response;
        
        // Log the authorization response for debugging
        $this->logMessage("Auth response status: " . $authResponse['status']);
        
        // Check if authorization was successful and requires capture
        if ($authResponse['status'] === 'requires_capture') {
            try {
                // Capture the authorized amount
                $captureData = ['amount_to_capture' => $paymentData['amount']];
                $captureResponse = $this->makeStripeRequest(
                    $stripeKey, 
                    '/v1/payment_intents/' . $authResponse['id'] . '/capture', 
                    $captureData, 
                    $input,
                    'POST'
                );
                
                $this->logMessage("Capture successful: " . $captureResponse['id']);
                
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
                $this->logError("Capture failed: " . $e->getMessage());
                return [
                    'success' => false,
                    'operation' => 'auth_capture',
                    'error' => 'Authorization succeeded but capture failed: ' . $e->getMessage(),
                    'authorization_id' => $authResponse['id'],
                    'authorization_status' => $authResponse['status']
                ];
            }
        } elseif ($authResponse['status'] === 'succeeded') {
            // Payment was already captured (automatic capture)
            $this->logMessage("Payment already captured automatically");
            return [
                'success' => true,
                'operation' => 'auth_capture',
                'transactionId' => $authResponse['id'],
                'status' => $authResponse['status'],
                'amount' => $paymentData['amount'] / 100,
                'currency' => strtoupper($paymentData['currency']),
                'authorization_id' => $authResponse['id'],
                'captured' => true,
                'note' => 'Payment was captured automatically'
            ];
        } elseif ($authResponse['status'] === 'requires_action') {
            // Payment requires additional action (3D Secure, etc.)
            $this->logMessage("Payment requires additional action");
            return [
                'success' => false,
                'operation' => 'auth_capture',
                'error' => 'Payment requires additional action (3D Secure authentication)',
                'authorization_id' => $authResponse['id'],
                'authorization_status' => $authResponse['status'],
                'client_secret' => $authResponse['client_secret'] ?? null,
                'next_action' => $authResponse['next_action'] ?? null
            ];
        } else {
            // Authorization failed or has unexpected status
            $this->logMessage("Authorization failed or unexpected status: " . $authResponse['status']);
            return [
                'success' => false,
                'operation' => 'auth_capture',
                'error' => 'Authorization failed with status: ' . $authResponse['status'],
                'authorization_id' => $authResponse['id'],
                'authorization_status' => $authResponse['status'],
                'last_payment_error' => $authResponse['last_payment_error'] ?? null
            ];
        }
    }
    
    /**
     * Handle payment errors with detailed decline reasons and network error handling
     */
    private function handlePaymentError($exception, $cardData, $stripeKey = null) {
        $errorMessage = $exception->getMessage();
        $declineCode = $this->extractDeclineCode($errorMessage);
        
        // Enhanced error categorization
        $errorDetails = $this->parseStripeError($errorMessage);
        
        // Map decline codes to user-friendly messages
        $reason = $this->declineReasons[$declineCode] ?? $errorDetails['message'];
        
        // Determine error category
        $category = $this->categorizeError($declineCode, $errorMessage);
        
        // Log detailed error information
        $this->logDetailedError($errorMessage, $cardData, $stripeKey, $errorDetails);
        
        // Create comprehensive error response
        $errorResponse = [
            'success' => false,
            'error' => $reason,
            'decline_code' => $declineCode,
            'category' => $category,
            'error_type' => $errorDetails['type'],
            'card_last4' => substr($cardData['cardNumber'], -4),
            'card_brand' => $this->getCardBrand($cardData['cardNumber']),
            'raw_error' => $errorMessage,
            'timestamp' => date('Y-m-d H:i:s'),
            'suggestions' => $this->getErrorSuggestions($errorDetails['type'], $declineCode)
        ];
        
        // Add HTTP status code if available
        if (stripos($errorMessage, 'HTTP') !== false) {
            preg_match('/HTTP.*?(\d{3})/', $errorMessage, $matches);
            if (isset($matches[1])) {
                $errorResponse['http_status'] = intval($matches[1]);
            }
        }
        
        return $errorResponse;
    }
    
    /**
     * Log detailed error information for debugging
     */
    private function logDetailedError($errorMessage, $cardData, $stripeKey, $errorDetails) {
        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'ip' => $_SERVER['REMOTE_ADDR'],
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
            'error_type' => $errorDetails['type'],
            'error_code' => $errorDetails['code'],
            'error_message' => $errorMessage,
            'card_last4' => substr($cardData['cardNumber'], -4),
            'card_brand' => $this->getCardBrand($cardData['cardNumber']),
            'card_expiry' => $cardData['expiry'],
            'key_type' => $stripeKey ? $this->getKeyType($stripeKey) : 'unknown',
            'session_id' => $_POST['sessionId'] ?? uniqid('error_'),
            'request_method' => $_SERVER['REQUEST_METHOD'],
            'request_uri' => $_SERVER['REQUEST_URI'] ?? 'unknown'
        ];
        
        // Add additional context for network errors
        if ($errorDetails['type'] === 'network_error') {
            $logEntry['network_info'] = [
                'curl_version' => curl_version()['version'] ?? 'unknown',
                'ssl_version' => curl_version()['ssl_version'] ?? 'unknown',
                'proxy_configured' => !empty($_POST['proxyConfig']['host'])
            ];
        }
        
        file_put_contents($this->logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
    }
    
    /**
     * Get card brand from card number
     */
    private function getCardBrand($cardNumber) {
        $cardNumber = preg_replace('/\s+/', '', $cardNumber);
        
        $brands = [
            'visa' => '/^4[0-9]{12}(?:[0-9]{3})?$/',
            'mastercard' => '/^5[1-5][0-9]{14}$/',
            'amex' => '/^3[47][0-9]{13}$/',
            'discover' => '/^6(?:011|5[0-9]{2})[0-9]{12}$/',
            'diners' => '/^3[0-9][0-9]{11}$/',
            'jcb' => '/^(?:2131|1800|35\d{3})\d{11}$/'
        ];
        
        foreach ($brands as $brand => $pattern) {
            if (preg_match($pattern, $cardNumber)) {
                return $brand;
            }
        }
        
        return 'unknown';
    }
    
    /**
     * Get error suggestions based on error type
     */
    private function getErrorSuggestions($errorType, $declineCode) {
        $suggestions = [
            'authentication_error' => [
                'Check if your Stripe key is valid and active',
                'Verify the key has proper permissions',
                'Ensure you\'re using the correct environment key (test vs live)'
            ],
            'permission_error' => [
                'Contact Stripe support to activate your account',
                'Verify your account is approved for live transactions',
                'Check if there are any account restrictions'
            ],
            'network_error' => [
                'Check your internet connection',
                'Verify proxy settings if using a proxy',
                'Try again in a few moments',
                'Check if Stripe API is experiencing issues'
            ],
            'card_error' => [
                'Verify the card number is correct',
                'Check the expiry date and CVV',
                'Try a different card',
                'Contact the card issuer if needed'
            ]
        ];
        
        return $suggestions[$errorType] ?? ['Contact support for assistance'];
    }
    
    /**
     * Add logging helper method - with safer IP address handling
     */
    private function logMessage($message) {
        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'message' => $message
        ];
        
        // Ensure log directory exists and is writable
        if (is_writable(dirname($this->logFile))) {
            file_put_contents($this->logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
        }
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
        
        $response = $this->makeStripeRequest($stripeKey, '/v1/payment_intents', $paymentData, $input, 'POST');
        
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
        
        $response = $this->makeStripeRequest($stripeKey, '/v1/payment_intents', $paymentData, $input, 'POST');
        
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
        $authResponse = $this->makeStripeRequest($stripeKey, '/v1/payment_intents', $paymentData, $input, 'POST');
        
        // Then capture
        $captureData = ['amount_to_capture' => $paymentData['amount']];
        $captureResponse = $this->makeStripeRequest(
            $stripeKey, 
            '/v1/payment_intents/' . $authResponse['id'] . '/capture', 
            $captureData, 
            $input,
            'POST'
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
    private function makeStripeRequest($stripeKey, $endpoint, $data, $input, $method = 'POST') {
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
        
        // Convert data to form format for Stripe API only if there's data
        $postData = '';
        if (!empty($data)) {
            $postData = $this->buildQueryString($data);
        }
        
        // Log the request details for debugging
        $this->logMessage("Making Stripe API request: $method $endpoint" . 
                          (!empty($postData) ? " with data" : " (no data)"));
        
        // Use proxy if configured
        if (is_array($input) && !empty($input['proxyConfig']['host'])) {
            return $this->makeProxyRequest($url, $postData, $headers, $input['proxyConfig'], $method);
        } else {
            return $this->makeDirectRequest($url, $postData, $headers, $method);
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
     * Make direct request to Stripe with enhanced error handling
     */
    private function makeDirectRequest($url, $postData, $headers, $method = 'POST') {
        $ch = curl_init();
        
        $curlOptions = [
            CURLOPT_URL => $url,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_HEADER => true,
            CURLOPT_VERBOSE => false
        ];
        
        // Configure request method
        if ($method === 'POST') {
            $curlOptions[CURLOPT_POST] = true;
            if (!empty($postData)) {
                $curlOptions[CURLOPT_POSTFIELDS] = $postData;
            }
        } else if ($method === 'GET') {
            $curlOptions[CURLOPT_HTTPGET] = true;
            // For GET requests, append data to URL if present
            if (!empty($postData)) {
                $curlOptions[CURLOPT_URL] = $url . '?' . $postData;
            }
            // IMPORTANT: Do NOT set CURLOPT_POSTFIELDS for GET requests
        }
        
        // Log the full request details for debugging
        $this->logMessage("cURL request: $method " . $curlOptions[CURLOPT_URL] . 
                         ($method === 'POST' && !empty($postData) ? " with data: " . substr($postData, 0, 100) : ""));
        
        curl_setopt_array($ch, $curlOptions);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $error = curl_error($ch);
        $info = curl_getinfo($ch);
        
        curl_close($ch);
        
        // Log the response details for debugging
        $this->logMessage("cURL response: HTTP $httpCode" . ($error ? " Error: $error" : ""));
        
        // Enhanced error handling for network issues with detailed logging
        if ($response === false || !empty($error)) {
            $errorMessage = '';
            
            // Categorize the error with detailed information
            if (strpos($error, 'Could not resolve host') !== false) {
                $errorMessage = 'DNS resolution failed: Unable to resolve api.stripe.com. Please check your internet connection. HTTP Status: ' . $httpCode;
            } elseif (strpos($error, 'Connection timed out') !== false) {
                $errorMessage = 'Connection timeout: Unable to connect to Stripe API within timeout period. HTTP Status: ' . $httpCode;
            } elseif (strpos($error, 'SSL') !== false) {
                $errorMessage = 'SSL error: ' . $error . '. Please check your SSL configuration. HTTP Status: ' . $httpCode;
            } elseif (strpos($error, 'Operation timed out') !== false) {
                $errorMessage = 'Request timeout: The request to Stripe API timed out. HTTP Status: ' . $httpCode;
            } else {
                $errorMessage = 'Network error: ' . $error . '. HTTP Status: ' . $httpCode;
            }
            
            // Log detailed error information
            $this->logDetailedNetworkError($url, $postData, $headers, $error, $httpCode, $info);
            
            throw new Exception($errorMessage);
        }
        
        // Handle connection failures
        if ($httpCode === 0) {
            $errorMessage = 'Connection failed: Unable to establish connection to Stripe API. HTTP Status: ' . $httpCode;
            $this->logDetailedNetworkError($url, $postData, $headers, 'Connection failed', $httpCode, $info);
            throw new Exception($errorMessage);
        }
        
        // Separate header and body
        $header = substr($response, 0, $headerSize);
        $body = substr($response, $headerSize);
        
        $decodedResponse = json_decode($body, true);
        
        // Enhanced error handling for HTTP errors
        if ($httpCode >= 400) {
            $errorMessage = $decodedResponse['error']['message'] ?? 'Unknown Stripe error';
            
            // Log the HTTP error with full details
            $this->logDetailedHttpError($url, $postData, $headers, $httpCode, $decodedResponse, $header);
            
            // Include HTTP status and response body in the exception message
            throw new Exception($errorMessage . ' | HTTP Status: ' . $httpCode . ' | Response: ' . json_encode($decodedResponse));
        }
        
        return $decodedResponse;
    }
    
    /**
     * Log detailed network error information
     */
    private function logDetailedNetworkError($url, $postData, $headers, $error, $httpCode, $info) {
        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'type' => 'network_error',
            'url' => $url,
            'http_status' => $httpCode,
            'curl_error' => $error,
            'curl_info' => $info,
            'ip' => $_SERVER['REMOTE_ADDR'],
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
            'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'Unknown'
        ];
        
        file_put_contents($this->logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
        error_log("Stripe Network Error: " . $error . " - HTTP Status: " . $httpCode . " - URL: " . $url);
    }
    
    /**
     * Log detailed HTTP error information
     */
    private function logDetailedHttpError($url, $postData, $headers, $httpCode, $responseBody, $responseHeaders) {
        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'type' => 'http_error',
            'url' => $url,
            'http_status' => $httpCode,
            'response_body' => $responseBody,
            'response_headers' => $responseHeaders,
            'ip' => $_SERVER['REMOTE_ADDR'],
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
            'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'Unknown'
        ];
        
        file_put_contents($this->logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
        error_log("Stripe HTTP Error: HTTP Status " . $httpCode . " - URL: " . $url . " - Response: " . json_encode($responseBody));
    }
    
    /**
     * Make request through proxy
     */
    private function makeProxyRequest($url, $postData, $headers, $proxyConfig, $method = 'POST') {
        $ch = curl_init();
        
        $curlOptions = [
            CURLOPT_URL => $url,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_PROXY => $proxyConfig['host'] . ':' . $proxyConfig['port']
        ];
        
        // Configure request method
        if ($method === 'POST') {
            $curlOptions[CURLOPT_POST] = true;
            if (!empty($postData)) {
                $curlOptions[CURLOPT_POSTFIELDS] = $postData;
            }
        } else if ($method === 'GET') {
            $curlOptions[CURLOPT_HTTPGET] = true;
            // For GET requests, append data to URL if present
            if (!empty($postData)) {
                $curlOptions[CURLOPT_URL] = $url . '?' . $postData;
            }
            // IMPORTANT: Do NOT set CURLOPT_POSTFIELDS for GET requests
        }
        
        // Add proxy authentication if provided
        if (!empty($proxyConfig['username']) && !empty($proxyConfig['password'])) {
            $curlOptions[CURLOPT_PROXYUSERPWD] = $proxyConfig['username'] . ':' . $proxyConfig['password'];
        }
        
        // Log the proxy request details for debugging
        $this->logMessage("Proxy request: $method " . $curlOptions[CURLOPT_URL] . 
                         " via " . $proxyConfig['host'] . ':' . $proxyConfig['port']);
        
        curl_setopt_array($ch, $curlOptions);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        $info = curl_getinfo($ch);
        
        curl_close($ch);
        
        // Log the proxy response details for debugging
        $this->logMessage("Proxy response: HTTP $httpCode" . ($error ? " Error: $error" : ""));
        
        // Enhanced error handling for proxy and network issues
        if ($response === false || !empty($error)) {
            // Categorize the error
            if (strpos($error, 'Could not resolve proxy') !== false) {
                throw new Exception('Proxy resolution failed: Unable to resolve proxy host. Please check your proxy settings.');
            } elseif (strpos($error, 'Could not resolve host') !== false) {
                throw new Exception('DNS resolution failed: Unable to resolve api.stripe.com through proxy.');
            } elseif (strpos($error, 'Connection refused') !== false) {
                throw new Exception('Proxy connection failed: Connection refused by proxy server.');
            } elseif (strpos($error, 'Proxy CONNECT aborted') !== false) {
                throw new Exception('Proxy authentication failed: Please check your proxy credentials.');
            } elseif (strpos($error, 'Connection timed out') !== false) {
                throw new Exception('Proxy timeout: Connection to proxy server timed out.');
            } elseif (strpos($error, 'SSL') !== false) {
                throw new Exception('SSL error through proxy: ' . $error);
            } else {
                throw new Exception('Proxy error: ' . $error);
            }
        }
        
        // Handle connection failures
        if ($httpCode === 0) {
            throw new Exception('Proxy connection failed: Unable to establish connection through proxy.');
        }
        
        $decodedResponse = json_decode($response, true);
        
        if ($httpCode >= 400) {
            $errorMessage = $decodedResponse['error']['message'] ?? 'Unknown Stripe error';
            throw new Exception($errorMessage);
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
     * Process Stripe key - handle both base64 encoded and encrypted keys
     */
    private function processStripeKey($stripeKeyInput) {
        // First, try base64 decoding
        $decodedKey = base64_decode($stripeKeyInput, true);
        if ($decodedKey !== false && $this->isValidStripeKey($decodedKey)) {
            $this->logMessage('Using base64 decoded Stripe key');
            return $decodedKey;
        }
        
        // If base64 decoding fails or doesn't produce a valid key, try decryption
        try {
            $decryptedKey = $this->decryptData($stripeKeyInput);
            if ($this->isValidStripeKey($decryptedKey)) {
                $this->logMessage('Using decrypted Stripe key');
                return $decryptedKey;
            }
        } catch (Exception $e) {
            // Decryption failed, continue to error handling
        }
        
        // If both methods fail, throw an exception
        throw new Exception('Invalid Stripe key format - unable to decode or decrypt');
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
     * Set security headers - suppress errors for testing environments
     */
    private function setSecurityHeaders() {
        // Only set headers if we're in a web environment and headers haven't been sent
        if (!headers_sent()) {
            header('X-Content-Type-Options: nosniff');
            header('X-Frame-Options: DENY');
            header('X-XSS-Protection: 1; mode=block');
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
            header('Content-Security-Policy: default-src \'self\'');
            header('Referrer-Policy: strict-origin-when-cross-origin');
        }
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
     * 
     * FIXES IMPLEMENTED:
     * - Fixed string amount validation (e.g., "2999", "0" now accepted)
     * - Improved numeric validation to accept string numbers
     * - Better error messages for different validation failures
     * - Safer logging for edge cases (arrays, objects)
     */
    private function validateInput($input) {
        $required = ['stripeSecretKey', 'operation', 'amount', 'currency', 'cardData'];
        
        foreach ($required as $field) {
            if (!isset($input[$field])) {
                $this->logError("Validation failed: Missing field '$field'");
                return ['valid' => false, 'error' => "Missing required field: $field"];
            }
            
            // Special handling for amount field - allow numeric strings
            // This fixes the main issue where "2999" and "0" were being rejected
            if ($field === 'amount') {
                if ($input[$field] === null || $input[$field] === false || $input[$field] === '') {
                    $this->logError("Validation failed: Empty/null amount field");
                    return ['valid' => false, 'error' => "Missing required field: $field"];
                }
                // Allow numeric strings (e.g., "0", "2999") and numbers (0, 2999)
                if (!is_numeric($input[$field])) {
                    $amountForLog = is_scalar($input[$field]) ? $input[$field] : gettype($input[$field]);
                    $this->logError("Validation failed: Non-numeric amount '" . $amountForLog . "'");
                    return ['valid' => false, 'error' => "Invalid amount - must be numeric"];
                }
            } else {
                // For other fields, use the original logic
                if (empty($input[$field]) && $input[$field] !== 0) {
                    $this->logError("Validation failed: Empty field '$field'");
                    return ['valid' => false, 'error' => "Missing required field: $field"];
                }
            }
        }
        
        // Validate card data
        $cardRequired = ['cardNumber', 'expiry', 'cvv'];
        foreach ($cardRequired as $field) {
            if (!isset($input['cardData'][$field]) || empty($input['cardData'][$field])) {
                $this->logError("Validation failed: Missing card field '$field'");
                return ['valid' => false, 'error' => "Missing required card field: $field"];
            }
        }
        
        // Validate operation type
        $validOperations = ['auth', 'charge', 'auth_capture'];
        if (!in_array($input['operation'], $validOperations)) {
            $this->logError("Validation failed: Invalid operation type '" . $input['operation'] . "'");
            return ['valid' => false, 'error' => 'Invalid operation type'];
        }
        
        // Additional amount validation (ensure it's not negative)
        if (is_numeric($input['amount']) && $input['amount'] < 0) {
            $amountForLog = is_scalar($input['amount']) ? $input['amount'] : gettype($input['amount']);
            $this->logError("Validation failed: Negative amount '" . $amountForLog . "'");
            return ['valid' => false, 'error' => 'Invalid amount - must be non-negative'];
        }
        
        // Log successful validation
        $this->logMessage("Input validation successful for operation: " . $input['operation']);
        
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
     * Log error - with safer IP address handling
     */
    private function logError($message) {
        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'error' => $message
        ];
        
        // Ensure log directory exists and is writable
        if (is_writable(dirname($this->logFile))) {
            file_put_contents($this->logFile, json_encode($logEntry) . "\n", FILE_APPEND | LOCK_EX);
        }
    }
    
    /**
     * Send success response - with safer header handling
     */
    private function sendSuccessResponse($data) {
        if (!headers_sent()) {
            header('Content-Type: application/json');
        }
        echo json_encode([
            'success' => true,
            'data' => $data,
            'timestamp' => time()
        ]);
    }
    
    /**
     * Send error response - with safer header handling
     */
    private function sendErrorResponse($message, $statusCode = 400) {
        if (!headers_sent()) {
            http_response_code($statusCode);
            header('Content-Type: application/json');
        }
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
        $backend = new EnhancedStripeBackend();
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