#!/usr/bin/env node

/**
 * Generate Security Keys Script
 * Creates secure JWT and encryption keys for the payment gateway
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { logger } = require('../src/utils/logger');

// Generate a secure random string
const generateSecureKey = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate a JWT secret
const generateJWTSecret = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Generate encryption key (32 bytes for AES-256)
const generateEncryptionKey = () => {
  return crypto.randomBytes(32).toString('hex').substring(0, 32);
};

// Generate webhook secret
const generateWebhookSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Create or update .env file
const updateEnvFile = (keys) => {
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  let envContent = '';
  
  // Read existing .env file or use .env.example as template
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    logger.info('Updating existing .env file...');
  } else if (fs.existsSync(envExamplePath)) {
    envContent = fs.readFileSync(envExamplePath, 'utf8');
    logger.info('Creating .env file from .env.example template...');
  } else {
    logger.warn('No .env.example template found, creating basic .env file...');
    envContent = `# BOOM Payment Gateway Configuration
# Generated on ${new Date().toISOString()}

# Database Configuration (SQLite)
DATABASE_PATH=./database/data/payments.db

# Security Configuration
JWT_SECRET=
JWT_EXPIRES_IN=24h
ENCRYPTION_KEY=
ENCRYPTION_ALGORITHM=aes-256-gcm

# Business Configuration
BUSINESS_NAME=BOOM Payment Gateway
BUSINESS_EMAIL=admin@boom-payments.com
CURRENCY=USD
PAYMENT_MODE=development

# Server Configuration
PORT=3000
NODE_ENV=development
API_VERSION=v1

# Webhooks
WEBHOOK_SECRET=
`;
  }
  
  // Update or add security keys
  Object.entries(keys).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  });
  
  // Write updated content
  fs.writeFileSync(envPath, envContent);
  logger.info(`✅ Updated .env file with new security keys`);
};

// Main function
const main = async () => {
  try {
    logger.info('🔐 Generating security keys for BOOM Payment Gateway...');
    
    // Generate all required keys
    const keys = {
      JWT_SECRET: generateJWTSecret(),
      ENCRYPTION_KEY: generateEncryptionKey(),
      WEBHOOK_SECRET: generateWebhookSecret()
    };
    
    // Display generated keys (for development purposes)
    logger.info('Generated keys:');
    Object.entries(keys).forEach(([key, value]) => {
      logger.info(`${key}: ${value.substring(0, 10)}...`);
    });
    
    // Update .env file
    updateEnvFile(keys);
    
    logger.info('✅ Security keys generated successfully!');
    logger.info('🔒 Your payment gateway is now secured with strong encryption');
    logger.info('⚠️  Keep your .env file secure and never commit it to version control');
    
  } catch (error) {
    logger.error('❌ Key generation failed:', error);
    process.exit(1);
  }
};

// Handle script execution
if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch((error) => {
    logger.error('Script execution failed:', error);
    process.exit(1);
  });
}

module.exports = { 
  main, 
  generateSecureKey, 
  generateJWTSecret, 
  generateEncryptionKey, 
  generateWebhookSecret 
};