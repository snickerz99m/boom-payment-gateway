const { Sequelize } = require('sequelize');
const winston = require('winston');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'payments',
  username: process.env.DB_USER || 'username',
  password: process.env.DB_PASSWORD || 'password',
  dialect: 'postgres',
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

// Create Sequelize instance
const sequelize = new Sequelize(
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