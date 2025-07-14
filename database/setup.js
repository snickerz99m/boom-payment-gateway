const { sequelize } = require('../src/config/database');
const { logger } = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

// Import models to ensure they're registered
const Customer = require('../src/models/Customer');
const PaymentMethod = require('../src/models/PaymentMethod');
const Transaction = require('../src/models/Transaction');
const Refund = require('../src/models/Refund');

// Define associations
const setupAssociations = () => {
  // Customer has many PaymentMethods
  Customer.hasMany(PaymentMethod, {
    foreignKey: 'customerId',
    as: 'paymentMethods'
  });
  PaymentMethod.belongsTo(Customer, {
    foreignKey: 'customerId',
    as: 'customer'
  });

  // Customer has many Transactions
  Customer.hasMany(Transaction, {
    foreignKey: 'customerId',
    as: 'transactions'
  });
  Transaction.belongsTo(Customer, {
    foreignKey: 'customerId',
    as: 'customer'
  });

  // PaymentMethod has many Transactions
  PaymentMethod.hasMany(Transaction, {
    foreignKey: 'paymentMethodId',
    as: 'transactions'
  });
  Transaction.belongsTo(PaymentMethod, {
    foreignKey: 'paymentMethodId',
    as: 'paymentMethod'
  });

  // Transaction has many Refunds
  Transaction.hasMany(Refund, {
    foreignKey: 'transactionId',
    as: 'refunds'
  });
  Refund.belongsTo(Transaction, {
    foreignKey: 'transactionId',
    as: 'transaction'
  });

  // Customer has many Refunds
  Customer.hasMany(Refund, {
    foreignKey: 'customerId',
    as: 'refunds'
  });
  Refund.belongsTo(Customer, {
    foreignKey: 'customerId',
    as: 'customer'
  });

  logger.info('Database associations set up successfully');
};

// Run migrations
const runMigrations = async () => {
  try {
    const migrationsPath = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.js'))
      .sort();

    logger.info(`Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      const migration = require(path.join(migrationsPath, file));
      logger.info(`Running migration: ${file}`);
      
      try {
        await migration.up(sequelize.getQueryInterface());
        logger.info(`Migration ${file} completed successfully`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          logger.warn(`Migration ${file} already applied, skipping`);
        } else {
          throw error;
        }
      }
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
};

// Initialize database
const initializeDatabase = async () => {
  try {
    logger.info('Starting database initialization...');

    // Test connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Run migrations
    await runMigrations();

    // Set up associations
    setupAssociations();

    // Don't sync models for SQLite, use migrations only
    logger.info('Database models associations set up successfully');

    logger.info('Database initialization completed successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

// Drop all tables (for development/testing)
const dropAllTables = async () => {
  try {
    logger.warn('Dropping all tables...');
    
    // Drop tables in reverse order to avoid foreign key constraints
    const tables = ['refunds', 'transactions', 'payment_methods', 'customers'];
    
    for (const table of tables) {
      try {
        await sequelize.getQueryInterface().dropTable(table);
        logger.info(`Dropped table: ${table}`);
      } catch (error) {
        if (error.message.includes('does not exist')) {
          logger.warn(`Table ${table} does not exist, skipping`);
        } else {
          throw error;
        }
      }
    }
    
    logger.warn('All tables dropped successfully');
  } catch (error) {
    logger.error('Failed to drop tables:', error);
    throw error;
  }
};

// Create database if it doesn't exist (SQLite automatically creates the file)
const createDatabase = async () => {
  try {
    const path = require('path');
    const fs = require('fs');
    
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'payments.db');
    const dbDir = path.dirname(dbPath);
    
    // Ensure database directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      logger.info(`Created database directory: ${dbDir}`);
    }
    
    // SQLite will create the database file automatically when we first connect
    logger.info(`SQLite database will be created at: ${dbPath}`);
    
  } catch (error) {
    logger.error('Database creation failed:', error);
    throw error;
  }
};

// Main setup function
const setupDatabase = async (options = {}) => {
  try {
    const { 
      createDb = false, 
      dropTables = false, 
      runMigrations = true,
      syncModels = true
    } = options;

    if (createDb) {
      await createDatabase();
    }

    if (dropTables) {
      await dropAllTables();
    }

    if (runMigrations || syncModels) {
      await initializeDatabase();
    }

    logger.info('Database setup completed successfully');
  } catch (error) {
    logger.error('Database setup failed:', error);
    process.exit(1);
  }
};

// Export functions
module.exports = {
  setupDatabase,
  initializeDatabase,
  runMigrations,
  dropAllTables,
  createDatabase,
  setupAssociations
};

// Run setup if this script is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    createDb: args.includes('--create-db'),
    dropTables: args.includes('--drop-tables'),
    runMigrations: !args.includes('--no-migrations'),
    syncModels: !args.includes('--no-sync')
  };

  setupDatabase(options).then(() => {
    logger.info('Database setup script completed');
    process.exit(0);
  }).catch((error) => {
    logger.error('Database setup script failed:', error);
    process.exit(1);
  });
}