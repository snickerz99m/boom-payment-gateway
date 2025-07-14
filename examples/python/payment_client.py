#!/usr/bin/env python3
"""
BOOM Payment Gateway - Python Client Library
A comprehensive Python client for integrating with the BOOM Payment Gateway API
"""

import requests
import json
import logging
from typing import Dict, Optional, Any
from datetime import datetime
import uuid


class PaymentGatewayClient:
    """
    Python client for BOOM Payment Gateway API
    
    Usage:
        client = PaymentGatewayClient("http://localhost:3000")
        result = client.process_payment({
            "amount": 2999,
            "currency": "USD",
            "cardData": {
                "cardNumber": "4111111111111111",
                "expiryDate": "12/25",
                "cvv": "123",
                "cardholderName": "John Doe"
            }
        })
    """
    
    def __init__(self, base_url: str, api_key: Optional[str] = None, api_version: str = "v1"):
        """
        Initialize the payment gateway client
        
        Args:
            base_url: Base URL of the payment gateway (e.g., "http://localhost:3000")
            api_key: API key for authentication (optional for development)
            api_version: API version (default: "v1")
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.api_version = api_version
        self.session = requests.Session()
        
        # Configure logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Set default headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'BOOM-Payment-Gateway-Python-Client/1.0'
        })
        
        if api_key:
            self.session.headers.update({
                'X-API-Key': api_key
            })
    
    def _get_endpoint(self, path: str) -> str:
        """Get full API endpoint URL"""
        return f"{self.base_url}/api/{self.api_version}{path}"
    
    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """
        Make HTTP request to the API
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint path
            data: Request payload
            
        Returns:
            API response as dictionary
            
        Raises:
            Exception: On API errors
        """
        try:
            url = self._get_endpoint(endpoint)
            self.logger.info(f"Making {method} request to {url}")
            
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                timeout=30
            )
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Request failed: {e}")
            raise Exception(f"API request failed: {e}")
        except json.JSONDecodeError:
            self.logger.error("Invalid JSON response")
            raise Exception("Invalid response format")
    
    def health_check(self) -> Dict:
        """
        Check API health status
        
        Returns:
            Health status response
        """
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            self.logger.error(f"Health check failed: {e}")
            raise
    
    def process_payment(self, payment_data: Dict) -> Dict:
        """
        Process a payment transaction
        
        Args:
            payment_data: Payment details including card data and amount
            
        Returns:
            Payment processing result
            
        Example:
            payment_data = {
                "amount": 2999,  # Amount in cents
                "currency": "USD",
                "cardData": {
                    "cardNumber": "4111111111111111",
                    "expiryDate": "12/25",
                    "cvv": "123",
                    "cardholderName": "John Doe"
                },
                "customerInfo": {
                    "email": "customer@example.com",
                    "firstName": "John",
                    "lastName": "Doe"
                },
                "orderData": {
                    "orderId": "ORDER-123",
                    "description": "Product purchase"
                }
            }
        """
        # Use secure endpoint if API key is provided
        endpoint = "/payments/process-secure" if self.api_key else "/payments/process"
        
        # Add metadata
        payment_data["metadata"] = payment_data.get("metadata", {})
        payment_data["metadata"]["clientLibrary"] = "python"
        payment_data["metadata"]["timestamp"] = datetime.now().isoformat()
        
        return self._make_request("POST", endpoint, payment_data)
    
    def get_transaction(self, transaction_id: str, auth_token: str) -> Dict:
        """
        Get transaction details by ID
        
        Args:
            transaction_id: Transaction ID
            auth_token: Authentication token
            
        Returns:
            Transaction details
        """
        headers = {'Authorization': f'Bearer {auth_token}'}
        old_headers = self.session.headers.copy()
        self.session.headers.update(headers)
        
        try:
            return self._make_request("GET", f"/transactions/{transaction_id}")
        finally:
            self.session.headers = old_headers
    
    def authenticate(self, email: str, password: str) -> Dict:
        """
        Authenticate with the admin API
        
        Args:
            email: Admin email
            password: Admin password
            
        Returns:
            Authentication response with token
        """
        return self._make_request("POST", "/auth/login", {
            "email": email,
            "password": password
        })
    
    def create_payment_form_data(self, amount: int, currency: str = "USD", 
                                order_id: Optional[str] = None) -> Dict:
        """
        Create payment form data for frontend integration
        
        Args:
            amount: Payment amount in cents
            currency: Currency code (default: USD)
            order_id: Optional order ID
            
        Returns:
            Form data for frontend
        """
        return {
            "amount": amount,
            "currency": currency,
            "orderId": order_id or str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "apiUrl": self._get_endpoint("/payments/process")
        }


def main():
    """Example usage of the PaymentGatewayClient"""
    
    # Initialize client
    client = PaymentGatewayClient("http://localhost:3000")
    
    # Test health check
    try:
        health = client.health_check()
        print("✅ Health Check:", health)
    except Exception as e:
        print("❌ Health Check Failed:", e)
        return
    
    # Example payment data
    payment_data = {
        "amount": 2999,  # $29.99
        "currency": "USD",
        "cardData": {
            "cardNumber": "4111111111111111",
            "expiryDate": "12/25",
            "cvv": "123",
            "cardholderName": "John Doe"
        },
        "customerData": {
            "email": "customer@example.com",
            "firstName": "John",
            "lastName": "Doe"
        },
        "orderData": {
            "orderId": f"ORDER-{uuid.uuid4()}",
            "description": "Test payment from Python"
        }
    }
    
    # Process payment
    try:
        result = client.process_payment(payment_data)
        print("✅ Payment Result:", json.dumps(result, indent=2))
    except Exception as e:
        print("❌ Payment Failed:", e)


if __name__ == "__main__":
    main()