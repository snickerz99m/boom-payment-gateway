const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
require('dotenv').config();

// Import middleware
const authMiddleware = require('../middleware/auth.middleware');
const errorMiddleware = require('../middleware/error.middleware');
const rateLimitMiddleware = require('../middleware/rateLimit.middleware');

// Import routes
const paymentRoutes = require('../routes/payment.routes');
const transactionRoutes = require('../routes/transaction.routes');
const customerRoutes = require('../routes/customer.routes');
const webhookRoutes = require('../routes/webhook.routes');
const authRoutes = require('../routes/auth.routes');

const createApp = () => {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: process.env.HELMET_CSP_ENABLED === 'true',
    hsts: process.env.HELMET_HSTS_ENABLED === 'true'
  }));

  // CORS configuration
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  app.use('/api/', limiter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'boom-payment-gateway',
      version: process.env.npm_package_version || '1.0.0'
    });
  });

  // API routes
  const apiVersion = process.env.API_VERSION || 'v1';
  app.use(`/api/${apiVersion}/auth`, authRoutes);
  app.use(`/api/${apiVersion}/payments`, paymentRoutes);
  app.use(`/api/${apiVersion}/transactions`, transactionRoutes);
  app.use(`/api/${apiVersion}/customers`, customerRoutes);
  app.use(`/api/${apiVersion}/webhooks`, webhookRoutes);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Route not found',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      code: 'ROUTE_NOT_FOUND'
    });
  });

  // Error handling middleware (must be last)
  app.use(errorMiddleware);

  return app;
};

module.exports = { createApp };