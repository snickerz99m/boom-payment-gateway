const { Sequelize } = require('sequelize');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Ensure database directory exists
const dbDir = path.join(__dirname, '..', '..', 'database');
const dataDir = path.join(dbDir, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Database configuration for SQLite
const dbConfig = {
  dialect: 'sqlite',
  storage: process.env.DATABASE_PATH || path.join(dataDir, 'payments.db'),
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
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

// Create Sequelize instance
const sequelize = new Sequelize(dbConfig);

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