const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { logger } = require('./src/utils/logger');
const { testConnection, initializeDatabase } = require('./src/config/database');
const { setupDatabase } = require('./database/setup');
const errorMiddleware = require('./src/middleware/error.middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'BOOM Payment Gateway',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/v1/payments', require('./src/routes/payment.routes'));
app.use('/api/v1/customers', require('./src/routes/customer.routes'));
app.use('/api/v1/bank-accounts', require('./src/routes/bank.routes'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to BOOM Payment Gateway',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health'
  });
});

// Error handling middleware
app.use(errorMiddleware);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found.',
    path: req.originalUrl
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    logger.info('Starting BOOM Payment Gateway...');
    
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    
    // Setup database
    await setupDatabase({
      createDb: true,
      dropTables: false,
      runMigrations: true,
      syncModels: true
    });
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;