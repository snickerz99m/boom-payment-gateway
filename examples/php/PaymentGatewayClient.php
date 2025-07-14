<?php
/**
 * BOOM Payment Gateway - PHP Client Library
 * A comprehensive PHP client for integrating with the BOOM Payment Gateway API
 */

class PaymentGatewayClient {
    private $baseUrl;
    private $apiKey;
    private $apiVersion;
    private $timeout;
    
    /**
     * Initialize the payment gateway client
     * 
     * @param string $baseUrl Base URL of the payment gateway
     * @param string|null $apiKey API key for authentication
     * @param string $apiVersion API version
     * @param int $timeout Request timeout in seconds
     */
    public function __construct($baseUrl, $apiKey = null, $apiVersion = 'v1', $timeout = 30) {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->apiKey = $apiKey;
        $this->apiVersion = $apiVersion;
        $this->timeout = $timeout;
    }
    
    /**
     * Get full API endpoint URL
     * 
     * @param string $path Endpoint path
     * @return string Full URL
     */
    private function getEndpoint($path) {
        return "{$this->baseUrl}/api/{$this->apiVersion}{$path}";
    }
    
    /**
     * Make HTTP request to the API
     * 
     * @param string $method HTTP method
     * @param string $endpoint API endpoint path
     * @param array|null $data Request payload
     * @return array API response
     * @throws Exception On API errors
     */
    private function makeRequest($method, $endpoint, $data = null) {
        $url = $this->getEndpoint($endpoint);
        
        // Initialize cURL
        $ch = curl_init();
        
        // Set cURL options
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_HTTPHEADER => $this->getHeaders(),
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_SSL_VERIFYPEER => false, // For development only
            CURLOPT_FOLLOWLOCATION => true,
        ]);
        
        // Add data for POST/PUT requests
        if ($data && in_array($method, ['POST', 'PUT', 'PATCH'])) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        // Execute request
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);
        
        // Check for cURL errors
        if ($error) {
            throw new Exception("Request failed: " . $error);
        }
        
        // Decode JSON response
        $decodedResponse = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Invalid JSON response: " . json_last_error_msg());
        }
        
        // Check HTTP status
        if ($httpCode >= 400) {
            $message = isset($decodedResponse['message']) ? $decodedResponse['message'] : 'Unknown error';
            throw new Exception("API error (HTTP {$httpCode}): " . $message);
        }
        
        return $decodedResponse;
    }
    
    /**
     * Get HTTP headers for requests
     * 
     * @return array Headers array
     */
    private function getHeaders() {
        $headers = [
            'Content-Type: application/json',
            'User-Agent: BOOM-Payment-Gateway-PHP-Client/1.0',
            'Accept: application/json'
        ];
        
        if ($this->apiKey) {
            $headers[] = 'X-API-Key: ' . $this->apiKey;
        }
        
        return $headers;
    }
    
    /**
     * Check API health status
     * 
     * @return array Health status response
     */
    public function healthCheck() {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $this->baseUrl . '/health',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        curl_close($ch);
        
        if ($error) {
            throw new Exception("Health check failed: " . $error);
        }
        
        if ($httpCode !== 200) {
            throw new Exception("Health check failed: HTTP " . $httpCode);
        }
        
        return json_decode($response, true);
    }
    
    /**
     * Process a payment transaction
     * 
     * @param array $paymentData Payment details
     * @return array Payment processing result
     * 
     * Example:
     * $paymentData = [
     *     'amount' => 2999,  // Amount in cents
     *     'currency' => 'USD',
     *     'cardData' => [
     *         'cardNumber' => '4111111111111111',
     *         'expiryDate' => '12/25',
     *         'cvv' => '123',
     *         'cardholderName' => 'John Doe'
     *     ],
     *     'customerInfo' => [
     *         'email' => 'customer@example.com',
     *         'firstName' => 'John',
     *         'lastName' => 'Doe'
     *     ],
     *     'orderId' => 'ORDER-123',
     *     'description' => 'Product purchase'
     * ];
     */
    public function processPayment($paymentData) {
        // Use secure endpoint if API key is provided
        $endpoint = $this->apiKey ? '/payments/process-secure' : '/payments/process';
        
        // Add metadata
        if (!isset($paymentData['metadata'])) {
            $paymentData['metadata'] = [];
        }
        
        $paymentData['metadata']['clientLibrary'] = 'php';
        $paymentData['metadata']['timestamp'] = date('c');
        
        return $this->makeRequest('POST', $endpoint, $paymentData);
    }
    
    /**
     * Get transaction details by ID
     * 
     * @param string $transactionId Transaction ID
     * @param string $authToken Authentication token
     * @return array Transaction details
     */
    public function getTransaction($transactionId, $authToken) {
        // Temporarily add auth header
        $originalHeaders = $this->getHeaders();
        $headers = array_merge($originalHeaders, ['Authorization: Bearer ' . $authToken]);
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $this->getEndpoint("/transactions/{$transactionId}"),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_SSL_VERIFYPEER => false,
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception("Failed to get transaction: HTTP " . $httpCode);
        }
        
        return json_decode($response, true);
    }
    
    /**
     * Authenticate with the admin API
     * 
     * @param string $email Admin email
     * @param string $password Admin password
     * @return array Authentication response with token
     */
    public function authenticate($email, $password) {
        return $this->makeRequest('POST', '/auth/login', [
            'email' => $email,
            'password' => $password
        ]);
    }
    
    /**
     * Create payment form data for frontend integration
     * 
     * @param int $amount Payment amount in cents
     * @param string $currency Currency code
     * @param string|null $orderId Optional order ID
     * @return array Form data for frontend
     */
    public function createPaymentFormData($amount, $currency = 'USD', $orderId = null) {
        return [
            'amount' => $amount,
            'currency' => $currency,
            'orderId' => $orderId ?: uniqid('ORDER-'),
            'timestamp' => date('c'),
            'apiUrl' => $this->getEndpoint('/payments/process')
        ];
    }
}

// Example usage
function exampleUsage() {
    echo "=== BOOM Payment Gateway - PHP Example ===\n";
    
    // Initialize client
    $client = new PaymentGatewayClient('http://localhost:3000');
    
    // Test health check
    try {
        $health = $client->healthCheck();
        echo "✅ Health Check: " . json_encode($health) . "\n";
    } catch (Exception $e) {
        echo "❌ Health Check Failed: " . $e->getMessage() . "\n";
        return;
    }
    
    // Example payment data
    $paymentData = [
        'amount' => 2999,  // $29.99
        'currency' => 'USD',
        'cardData' => [
            'cardNumber' => '4111111111111111',
            'expiryDate' => '12/25',
            'cvv' => '123',
            'cardholderName' => 'John Doe'
        ],
        'customerInfo' => [
            'email' => 'customer@example.com',
            'firstName' => 'John',
            'lastName' => 'Doe'
        ],
        'orderId' => 'ORDER-' . uniqid(),
        'description' => 'Test payment from PHP'
    ];
    
    // Process payment
    try {
        $result = $client->processPayment($paymentData);
        echo "✅ Payment Result: " . json_encode($result, JSON_PRETTY_PRINT) . "\n";
    } catch (Exception $e) {
        echo "❌ Payment Failed: " . $e->getMessage() . "\n";
    }
}

// Run example if called directly
if (basename(__FILE__) === basename($_SERVER['PHP_SELF'])) {
    exampleUsage();
}
?>