#!/usr/bin/env node

const { setupDatabase } = require('../database/setup');
const { logger } = require('../src/utils/logger');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Main setup function
const main = async () => {
  try {
    console.log('🚀 BOOM Payment Gateway Database Setup');
    console.log('=====================================\n');
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const isInteractive = !args.includes('--non-interactive');
    
    let options = {
      createDb: args.includes('--create-db'),
      dropTables: args.includes('--drop-tables'),
      runMigrations: !args.includes('--no-migrations'),
      syncModels: !args.includes('--no-sync')
    };
    
    if (isInteractive) {
      console.log('This script will set up your payment gateway database.');
      console.log('SQLite will be used - no server installation required!\n');
      
      // Ask user for preferences
      if (!options.createDb) {
        const createDb = await askQuestion('Create database if it doesn\'t exist? (y/n) [y]: ');
        options.createDb = createDb.toLowerCase() !== 'n';
      }
      
      if (!options.dropTables && !args.includes('--no-drop')) {
        const dropTables = await askQuestion('Drop existing tables? (y/n) [n]: ');
        options.dropTables = dropTables.toLowerCase() === 'y';
      }
      
      console.log('\n⚡ Starting database setup...\n');
    }
    
    // Run database setup
    await setupDatabase(options);
    
    console.log('\n✅ Database setup completed successfully!');
    console.log('\nYour payment gateway is ready to use.');
    console.log('Run "npm start" to start the server.\n');
    
  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    logger.error('Database setup failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
};

// Handle command line help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🚀 BOOM Payment Gateway Database Setup

Usage: node scripts/setup-database.js [options]

Options:
  --create-db          Create database if it doesn't exist
  --drop-tables        Drop existing tables before setup
  --no-migrations      Skip running migrations
  --no-sync           Skip model synchronization
  --non-interactive   Run without user prompts
  --help, -h          Show this help message

Examples:
  node scripts/setup-database.js
  node scripts/setup-database.js --create-db --drop-tables
  node scripts/setup-database.js --non-interactive --create-db
`);
  process.exit(0);
}

// Run the main function
main();