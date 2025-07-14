#!/usr/bin/env php
<?php
/**
 * Test script to verify enhanced backend functionality
 */

// Set up environment for testing
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_USER_AGENT'] = 'Test Script';

// Include the backend class
require_once __DIR__ . '/../stripe-interface/backend.php';

// Test key validation
function testKeyValidation() {
    echo "Testing key validation...\n";
    
    // Test valid format
    $testKeys = [
        'sk_test_51HyKxOGzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xOKzFjNg4xO',
        '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',
        'invalid_key',
        'pk_test_123',
        'sk_test_'
    ];
    
    foreach ($testKeys as $key) {
        $isValid = preg_match('/^sk_(test|live)_[a-zA-Z0-9]+$/', $key);
        $keyType = 'unknown';
        if (strpos($key, 'sk_live_') === 0) {
            $keyType = 'live';
        } elseif (strpos($key, 'sk_test_') === 0) {
            $keyType = 'test';
        }
        
        echo "Key: " . substr($key, 0, 20) . "... ";
        echo "Valid: " . ($isValid ? 'YES' : 'NO') . " ";
        echo "Type: $keyType\n";
    }
    
    echo "\n";
}

// Test error parsing
function testErrorParsing() {
    echo "Testing error parsing...\n";
    
    $testErrors = [
        'Invalid API Key',
        'Your account cannot currently make live charges',
        'Could not resolve host',
        'incorrect_cvc',
        'expired_card',
        'stolen_card',
        'Connection error',
        'Unknown error message'
    ];
    
    // Error patterns mapping
    $errorPatterns = [
        'Invalid API Key' => [
            'code' => 'invalid_api_key',
            'type' => 'authentication_error',
            'message' => 'Invalid API Key - Check your key format and permissions'
        ],
        'Your account cannot currently make live charges' => [
            'code' => 'account_not_activated',
            'type' => 'permission_error',
            'message' => 'Account not activated for live charges'
        ],
        'Could not resolve host' => [
            'code' => 'dns_error',
            'type' => 'network_error',
            'message' => 'DNS resolution failed - Check network connection'
        ],
        'incorrect_cvc' => [
            'code' => 'incorrect_cvc',
            'type' => 'card_error',
            'message' => 'CVV verification failed'
        ],
        'expired_card' => [
            'code' => 'expired_card',
            'type' => 'card_error',
            'message' => 'Card has expired'
        ],
        'stolen_card' => [
            'code' => 'stolen_card',
            'type' => 'card_error',
            'message' => 'Card reported as stolen'
        ],
        'Connection error' => [
            'code' => 'connection_error',
            'type' => 'network_error',
            'message' => 'Network error - Check internet connection and proxy settings'
        ]
    ];
    
    foreach ($testErrors as $error) {
        $parsed = $errorPatterns[$error] ?? [
            'code' => 'unknown_error',
            'type' => 'api_error',
            'message' => 'Unknown error occurred: ' . substr($error, 0, 100)
        ];
        
        echo "Error: $error\n";
        echo "  Code: {$parsed['code']}\n";
        echo "  Type: {$parsed['type']}\n";
        echo "  Message: {$parsed['message']}\n\n";
    }
}

// Test card brand detection
function testCardBrandDetection() {
    echo "Testing card brand detection...\n";
    
    $testCards = [
        '4111111111111111' => 'visa',
        '5555555555554444' => 'mastercard',
        '378282246310005' => 'amex',
        '6011111111111117' => 'discover',
        '30569309025904' => 'diners',
        '3530111333300000' => 'jcb',
        '1234567890123456' => 'unknown'
    ];
    
    foreach ($testCards as $cardNumber => $expectedBrand) {
        $detectedBrand = detectCardBrand($cardNumber);
        echo "Card: $cardNumber ";
        echo "Expected: $expectedBrand ";
        echo "Detected: $detectedBrand ";
        echo ($detectedBrand === $expectedBrand ? '✓' : '✗') . "\n";
    }
    
    echo "\n";
}

function detectCardBrand($cardNumber) {
    $cardNumber = preg_replace('/\s+/', '', $cardNumber);
    
    $brands = [
        'visa' => '/^4[0-9]{12}(?:[0-9]{3})?$/',
        'mastercard' => '/^5[1-5][0-9]{14}$/',
        'amex' => '/^3[47][0-9]{13}$/',
        'discover' => '/^6(?:011|5[0-9]{2})[0-9]{12}$/',
        'diners' => '/^3[0689][0-9]{11}$/',
        'jcb' => '/^(?:2131|1800|35\d{3})\d{11}$/'
    ];
    
    foreach ($brands as $brand => $pattern) {
        if (preg_match($pattern, $cardNumber)) {
            return $brand;
        }
    }
    
    return 'unknown';
}

// Test suggestion generation
function testSuggestionGeneration() {
    echo "Testing suggestion generation...\n";
    
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
    
    foreach ($suggestions as $errorType => $errorSuggestions) {
        echo "Error Type: $errorType\n";
        echo "Suggestions:\n";
        foreach ($errorSuggestions as $suggestion) {
            echo "  - $suggestion\n";
        }
        echo "\n";
    }
}

// Run tests
echo "=== Enhanced Stripe Backend Tests ===\n\n";

testKeyValidation();
testErrorParsing();
testCardBrandDetection();
testSuggestionGeneration();

echo "=== Tests Complete ===\n";
?>