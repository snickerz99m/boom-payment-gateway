#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { logger } = require('../src/utils/logger');

// Generate secure random key
const generateSecureKey = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate JWT secret
const generateJwtSecret = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Generate encryption key
const generateEncryptionKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate webhook secret
const generateWebhookSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Main function
const main = async () => {
  try {
    console.log('🔐 BOOM Payment Gateway Key Generation');
    console.log('====================================\n');
    
    // Generate keys
    const keys = {
      JWT_SECRET: generateJwtSecret(),
      ENCRYPTION_KEY: generateEncryptionKey(),
      WEBHOOK_SECRET: generateWebhookSecret(),
      GENERATED_AT: new Date().toISOString()
    };
    
    console.log('Generated secure keys:');
    console.log('----------------------');
    console.log(`JWT_SECRET: ${keys.JWT_SECRET}`);
    console.log(`ENCRYPTION_KEY: ${keys.ENCRYPTION_KEY}`);
    console.log(`WEBHOOK_SECRET: ${keys.WEBHOOK_SECRET}`);
    console.log(`Generated at: ${keys.GENERATED_AT}\n`);
    
    // Check if .env file exists
    const envPath = path.join(__dirname, '../.env');
    const envExamplePath = path.join(__dirname, '../.env.example');
    
    if (!fs.existsSync(envPath)) {
      if (fs.existsSync(envExamplePath)) {
        // Copy .env.example to .env
        let envContent = fs.readFileSync(envExamplePath, 'utf8');
        
        // Replace placeholder values with generated keys
        envContent = envContent.replace(
          /JWT_SECRET=.*/,
          `JWT_SECRET=${keys.JWT_SECRET}`
        );
        envContent = envContent.replace(
          /ENCRYPTION_KEY=.*/,
          `ENCRYPTION_KEY=${keys.ENCRYPTION_KEY}`
        );
        envContent = envContent.replace(
          /WEBHOOK_SECRET=.*/,
          `WEBHOOK_SECRET=${keys.WEBHOOK_SECRET}`
        );
        
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Created .env file with generated keys');
      } else {
        console.log('⚠️  .env.example file not found');
      }
    } else {
      console.log('ℹ️  .env file already exists');
      console.log('   You can manually update it with the generated keys above');
    }
    
    // Save keys to a separate file for backup
    const keyFile = path.join(__dirname, '../keys-backup.json');
    fs.writeFileSync(keyFile, JSON.stringify(keys, null, 2));
    console.log(`📄 Keys saved to: ${keyFile}`);
    
    // Security warnings
    console.log('\n🔒 Security Reminders:');
    console.log('=====================');
    console.log('1. Keep these keys secure and never commit them to version control');
    console.log('2. Use different keys for production and development environments');
    console.log('3. Regularly rotate your keys for better security');
    console.log('4. The keys-backup.json file should be stored securely');
    
    logger.info('Security keys generated successfully');
    
  } catch (error) {
    console.error('\n❌ Key generation failed:', error.message);
    logger.error('Key generation failed:', error);
    process.exit(1);
  }
};

// Handle command line help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🔐 BOOM Payment Gateway Key Generation

Usage: node scripts/generate-keys.js [options]

This script generates secure cryptographic keys for your payment gateway:
- JWT secret for authentication tokens
- Encryption key for sensitive data
- Webhook secret for webhook validation

Options:
  --help, -h          Show this help message

The script will:
1. Generate secure random keys
2. Create/update your .env file with the keys
3. Save a backup of the keys to keys-backup.json

Security Note: Keep the generated keys secure and never commit them to version control.
`);
  process.exit(0);
}

// Run the main function
main();