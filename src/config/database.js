const { Sequelize } = require('sequelize');
const winston = require('winston');
const path = require('path');
require('dotenv').config();

// Database configuration
const dbDialect = process.env.DB_DIALECT || 'sqlite';
const dbConfig = {
  dialect: dbDialect,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
};

// Configure database based on dialect
if (dbDialect === 'sqlite') {
  dbConfig.storage = process.env.DB_PATH || path.join(__dirname, '../../data/payments.db');
  dbConfig.database = 'payments';
} else if (dbDialect === 'postgres') {
  dbConfig.host = process.env.DB_HOST || 'localhost';
  dbConfig.port = process.env.DB_PORT || 5432;
  dbConfig.database = process.env.DB_NAME || 'payments';
  dbConfig.username = process.env.DB_USER || 'username';
  dbConfig.password = process.env.DB_PASSWORD || 'password';
}

// Create Sequelize instance
const sequelize = dbDialect === 'sqlite' 
  ? new Sequelize({
      ...dbConfig,
      storage: dbConfig.storage
    })
  : new Sequelize(
      dbConfig.database,
      dbConfig.username,
      dbConfig.password,
      dbConfig
    );

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    winston.info('Database connection established successfully');
    return true;
  } catch (error) {
    winston.error('Unable to connect to database:', error);
    return false;
  }
};

// Initialize database
const initializeDatabase = async () => {
  try {
    await sequelize.sync({ alter: false });
    winston.info('Database synchronized successfully');
  } catch (error) {
    winston.error('Database synchronization failed:', error);
    throw error;
  }
};

// Close database connection
const closeConnection = async () => {
  try {
    await sequelize.close();
    winston.info('Database connection closed');
  } catch (error) {
    winston.error('Error closing database connection:', error);
  }
};

module.exports = {
  sequelize,
  testConnection,
  initializeDatabase,
  closeConnection,
  dbConfig
};