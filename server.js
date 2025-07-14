const { createApp } = require('./src/config/app');
const { testConnection, initializeDatabase } = require('./src/config/database');
const { logger } = require('./src/utils/logger');
const path = require('path');

require('dotenv').config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      logger.error('Database connection failed. Please check your database configuration.');
      process.exit(1);
    }
    
    // Initialize database
    logger.info('Initializing database...');
    await initializeDatabase();
    
    // Create Express app
    const app = createApp();
    
    // Redirect root to admin panel
    app.get('/', (req, res) => {
      res.redirect('/admin');
    });
    
    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 BOOM Payment Gateway server is running on port ${PORT}`);
      logger.info(`📊 Admin Panel: http://localhost:${PORT}/admin`);
      logger.info(`🔌 API Base URL: http://localhost:${PORT}/api/v1`);
      logger.info(`💳 Payment Endpoint: http://localhost:${PORT}/api/v1/payments/process`);
      logger.info(`🔐 Default Admin Login: admin@boom-payments.com / password`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();