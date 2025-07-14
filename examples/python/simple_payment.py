#!/usr/bin/env python3
"""
Simple Python Example for BOOM Payment Gateway
A basic example showing how to process payments using Python
"""

import requests
import json
from datetime import datetime
import uuid

# Configuration
API_BASE_URL = "http://localhost:3000"  # Change this to your server IP for remote access
API_VERSION = "v1"
API_KEY = ""  # Optional: use for secure endpoint

def process_payment_simple():
    """
    Simple payment processing example
    """
    # Payment data
    payment_data = {
        "amount": 2999,  # $29.99 in cents
        "currency": "USD",
        "cardData": {
            "cardNumber": "4111111111111111",  # Test Visa card
            "expiryDate": "12/25",
            "cvv": "123",
            "cardholderName": "John Doe"
        },
        "customerInfo": {
            "email": "customer@example.com",
            "firstName": "John",
            "lastName": "Doe"
        },
        "orderId": f"ORDER-{uuid.uuid4()}",
        "description": "Test payment from Python"
    }
    
    # API endpoint
    endpoint = f"{API_BASE_URL}/api/{API_VERSION}/payments/process"
    
    # Headers
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Python-Payment-Client/1.0"
    }
    
    # Add API key if using secure endpoint
    if API_KEY:
        headers["X-API-Key"] = API_KEY
        endpoint = f"{API_BASE_URL}/api/{API_VERSION}/payments/process-secure"
    
    try:
        print("Processing payment...")
        print(f"Endpoint: {endpoint}")
        print(f"Amount: ${payment_data['amount']/100:.2f}")
        print(f"Card: ****{payment_data['cardData']['cardNumber'][-4:]}")
        
        # Make request
        response = requests.post(
            endpoint,
            json=payment_data,
            headers=headers,
            timeout=30
        )
        
        # Parse response
        result = response.json()
        
        if response.status_code == 200 and result.get("success"):
            print("✅ Payment successful!")
            print(f"Transaction ID: {result['data']['transaction']['id']}")
            print(f"Status: {result['data']['transaction']['status']}")
            print(f"Amount: ${result['data']['transaction']['amount']:.2f}")
            print(f"Response: {result['data']['gateway']['responseMessage']}")
        else:
            print("❌ Payment failed!")
            print(f"Error: {result.get('message', 'Unknown error')}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    except json.JSONDecodeError:
        print("❌ Invalid response format")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

def test_connection():
    """
    Test connection to the payment gateway
    """
    try:
        print("Testing connection...")
        response = requests.get(f"{API_BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Connection successful!")
            print(f"Service: {data.get('service', 'Unknown')}")
            print(f"Status: {data.get('status', 'Unknown')}")
            return True
        else:
            print(f"❌ Connection failed: HTTP {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection failed: {e}")
        return False

def main():
    """
    Main function
    """
    print("=== BOOM Payment Gateway - Python Example ===\n")
    
    # Test connection first
    if test_connection():
        print("\n" + "="*50)
        process_payment_simple()
    else:
        print("\n❌ Cannot connect to payment gateway.")
        print("Make sure the server is running and accessible.")

if __name__ == "__main__":
    main()