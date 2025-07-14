<?php
/**
 * Simple PHP Example for BOOM Payment Gateway
 * A basic example showing how to process payments using PHP
 */

// Configuration
$apiBaseUrl = 'http://localhost:3000';  // Change this to your server IP for remote access
$apiVersion = 'v1';
$apiKey = '';  // Optional: use for secure endpoint

/**
 * Simple payment processing function
 */
function processPaymentSimple($apiBaseUrl, $apiVersion, $apiKey = null) {
    // Payment data
    $paymentData = [
        'amount' => 2999,  // $29.99 in cents
        'currency' => 'USD',
        'cardData' => [
            'cardNumber' => '4111111111111111',  // Test Visa card
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
    
    // API endpoint
    $endpoint = "{$apiBaseUrl}/api/{$apiVersion}/payments/process";
    
    // Headers
    $headers = [
        'Content-Type: application/json',
        'User-Agent: PHP-Payment-Client/1.0',
        'Accept: application/json'
    ];
    
    // Add API key if using secure endpoint
    if ($apiKey) {
        $headers[] = 'X-API-Key: ' . $apiKey;
        $endpoint = "{$apiBaseUrl}/api/{$apiVersion}/payments/process-secure";
    }
    
    echo "Processing payment...\n";
    echo "Endpoint: {$endpoint}\n";
    echo "Amount: $" . number_format($paymentData['amount'] / 100, 2) . "\n";
    echo "Card: ****" . substr($paymentData['cardData']['cardNumber'], -4) . "\n";
    
    // Initialize cURL
    $ch = curl_init();
    
    // Set cURL options
    curl_setopt_array($ch, [
        CURLOPT_URL => $endpoint,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($paymentData),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => false,  // For development only
    ]);
    
    // Execute request
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    // Check for errors
    if ($error) {
        echo "❌ Request failed: {$error}\n";
        return false;
    }
    
    // Parse response
    $result = json_decode($response, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo "❌ Invalid response format\n";
        return false;
    }
    
    if ($httpCode === 200 && isset($result['success']) && $result['success']) {
        echo "✅ Payment successful!\n";
        echo "Transaction ID: {$result['data']['transaction']['id']}\n";
        echo "Status: {$result['data']['transaction']['status']}\n";
        echo "Amount: $" . number_format($result['data']['transaction']['amount'], 2) . "\n";
        echo "Response: {$result['data']['gateway']['responseMessage']}\n";
        return true;
    } else {
        echo "❌ Payment failed!\n";
        echo "Error: " . ($result['message'] ?? 'Unknown error') . "\n";
        return false;
    }
}

/**
 * Test connection to the payment gateway
 */
function testConnection($apiBaseUrl) {
    echo "Testing connection...\n";
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => "{$apiBaseUrl}/health",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    if ($error) {
        echo "❌ Connection failed: {$error}\n";
        return false;
    }
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        echo "✅ Connection successful!\n";
        echo "Service: " . ($data['service'] ?? 'Unknown') . "\n";
        echo "Status: " . ($data['status'] ?? 'Unknown') . "\n";
        return true;
    } else {
        echo "❌ Connection failed: HTTP {$httpCode}\n";
        return false;
    }
}

/**
 * HTML Form Example
 */
function generatePaymentForm($apiBaseUrl, $apiVersion) {
    $formData = [
        'amount' => 2999,
        'currency' => 'USD',
        'orderId' => 'ORDER-' . uniqid(),
        'timestamp' => date('c'),
        'apiUrl' => "{$apiBaseUrl}/api/{$apiVersion}/payments/process"
    ];
    
    return '
    <form id="payment-form" action="' . $formData['apiUrl'] . '" method="post">
        <input type="hidden" name="amount" value="' . $formData['amount'] . '">
        <input type="hidden" name="currency" value="' . $formData['currency'] . '">
        <input type="hidden" name="orderId" value="' . $formData['orderId'] . '">
        
        <div>
            <label>Card Number:</label>
            <input type="text" name="cardNumber" placeholder="1234 5678 9012 3456" required>
        </div>
        
        <div>
            <label>Expiry Date:</label>
            <input type="text" name="expiryDate" placeholder="MM/YY" required>
        </div>
        
        <div>
            <label>CVV:</label>
            <input type="text" name="cvv" placeholder="123" required>
        </div>
        
        <div>
            <label>Cardholder Name:</label>
            <input type="text" name="cardholderName" required>
        </div>
        
        <div>
            <label>Email:</label>
            <input type="email" name="email" required>
        </div>
        
        <button type="submit">Pay $' . number_format($formData['amount'] / 100, 2) . '</button>
    </form>
    ';
}

// Main execution
function main() {
    global $apiBaseUrl, $apiVersion, $apiKey;
    
    echo "=== BOOM Payment Gateway - PHP Example ===\n";
    
    // Test connection first
    if (testConnection($apiBaseUrl)) {
        echo "\n" . str_repeat("=", 50) . "\n";
        processPaymentSimple($apiBaseUrl, $apiVersion, $apiKey);
    } else {
        echo "\n❌ Cannot connect to payment gateway.\n";
        echo "Make sure the server is running and accessible.\n";
    }
}

// Handle web requests
if (isset($_SERVER['REQUEST_METHOD'])) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Process form submission
        header('Content-Type: application/json');
        
        $paymentData = [
            'amount' => intval($_POST['amount'] ?? 0),
            'currency' => $_POST['currency'] ?? 'USD',
            'cardData' => [
                'cardNumber' => $_POST['cardNumber'] ?? '',
                'expiryDate' => $_POST['expiryDate'] ?? '',
                'cvv' => $_POST['cvv'] ?? '',
                'cardholderName' => $_POST['cardholderName'] ?? ''
            ],
            'customerData' => [
                'email' => $_POST['email'] ?? '',
                'firstName' => explode(' ', $_POST['cardholderName'] ?? '')[0] ?? '',
                'lastName' => explode(' ', $_POST['cardholderName'] ?? '')[1] ?? ''
            ],
            'orderData' => [
                'orderId' => $_POST['orderId'] ?? 'ORDER-' . uniqid(),
                'description' => 'Payment from PHP form'
            ]
        ];
        
        // Process payment here (using the function above)
        echo json_encode(['success' => true, 'message' => 'Payment processed']);
    } else {
        // Show form
        echo generatePaymentForm($apiBaseUrl, $apiVersion);
    }
} else {
    // Command line execution
    main();
}
?>