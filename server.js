#!/usr/bin/env node

/**
 * BOOM Payment Gateway Server
 * A secure, production-ready payment processing system
 */

const { createApp } = require('./src/config/app');
const { sequelize, testConnection } = require('./src/config/database');
const { setupDatabase } = require('./database/setup');
const { logger } = require('./src/utils/logger');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Server configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Check for required environment variables
const checkEnvironment = () => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'ENCRYPTION_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    logger.error('Please create a .env file based on .env.example');
    process.exit(1);
  }
};

// Initialize database
const initializeDatabase = async () => {
  try {
    logger.info('Initializing database...');
    
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }

    // Setup database tables
    await setupDatabase({
      createDb: true,
      dropTables: false,
      runMigrations: true,
      syncModels: true
    });

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

// Start server
const startServer = async () => {
  try {
    logger.info('Starting BOOM Payment Gateway...');
    logger.info(`Environment: ${NODE_ENV}`);

    // Check environment variables
    checkEnvironment();

    // Initialize database
    await initializeDatabase();

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on http://${HOST}:${PORT}`);
      logger.info(`📊 Health check: http://${HOST}:${PORT}/health`);
      logger.info(`🔗 API Base URL: http://${HOST}:${PORT}/api/v1`);
      
      if (NODE_ENV === 'development') {
        logger.info('💳 Payment Gateway is ready to process payments!');
        logger.info('📖 Check the README.md for API documentation');
      }
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      server.close(async (err) => {
        if (err) {
          logger.error('Error during server shutdown:', err);
        }
        
        try {
          await sequelize.close();
          logger.info('Database connection closed');
        } catch (error) {
          logger.error('Error closing database connection:', error);
        }
        
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle startup errors
startServer().catch((error) => {
  logger.error('Server startup failed:', error);
  process.exit(1);
});