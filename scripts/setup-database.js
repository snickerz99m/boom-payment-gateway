#!/usr/bin/env node

/**
 * Database Setup Script
 * Initializes the SQLite database with all required tables
 */

const { setupDatabase } = require('../database/setup');
const { logger } = require('../src/utils/logger');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  createDb: args.includes('--create-db') || args.includes('-c'),
  dropTables: args.includes('--drop-tables') || args.includes('-d'),
  runMigrations: !args.includes('--no-migrations'),
  syncModels: !args.includes('--no-sync'),
  seedData: args.includes('--seed') || args.includes('-s'),
  force: args.includes('--force') || args.includes('-f')
};

// Help message
const showHelp = () => {
  console.log(`
BOOM Payment Gateway - Database Setup Script

Usage: node scripts/setup-database.js [options]

Options:
  -c, --create-db      Create database if it doesn't exist
  -d, --drop-tables    Drop all existing tables (USE WITH CAUTION!)
  -s, --seed           Seed database with development data
  -f, --force          Force operation without confirmation
  --no-migrations      Skip running migrations
  --no-sync           Skip model synchronization
  -h, --help          Show this help message

Examples:
  node scripts/setup-database.js                    # Standard setup
  node scripts/setup-database.js --create-db        # Create database and setup
  node scripts/setup-database.js --drop-tables -f   # Drop and recreate tables
  node scripts/setup-database.js --seed             # Setup and seed data
`);
};

// Confirmation prompt
const confirm = (message) => {
  if (options.force) return true;
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
};

// Seed development data
const seedDatabase = async () => {
  try {
    logger.info('Seeding database with development data...');
    
    const seedPath = path.join(__dirname, '..', 'database', 'seeds', 'dev_data.js');
    if (fs.existsSync(seedPath)) {
      const seedScript = require(seedPath);
      await seedScript();
      logger.info('Database seeded successfully');
    } else {
      logger.warn('Seed file not found, skipping...');
    }
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
};

// Main setup function
const main = async () => {
  try {
    // Show help if requested
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      return;
    }

    logger.info('🚀 Starting database setup...');
    logger.info(`Database will be created at: ${process.env.DATABASE_PATH || './database/data/payments.db'}`);

    // Confirm destructive operations
    if (options.dropTables) {
      const confirmed = await confirm('⚠️  This will DROP ALL TABLES and DATA. Are you sure?');
      if (!confirmed) {
        logger.info('Operation cancelled');
        return;
      }
    }

    // Run database setup
    await setupDatabase({
      createDb: options.createDb,
      dropTables: options.dropTables,
      runMigrations: options.runMigrations,
      syncModels: options.syncModels
    });

    // Seed database if requested
    if (options.seedData) {
      await seedDatabase();
    }

    logger.info('✅ Database setup completed successfully!');
    logger.info('💳 Your payment gateway is ready to process payments!');
    
  } catch (error) {
    logger.error('❌ Database setup failed:', error);
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

module.exports = { main, seedDatabase };