const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const path = require('path');
require('dotenv').config();

// Import middleware
const authMiddleware = require('../middleware/auth.middleware');
const { errorHandler } = require('../middleware/error.middleware');
const rateLimitMiddleware = require('../middleware/rateLimit.middleware');

// Import routes
const paymentRoutes = require('../routes/payment.routes');
const transactionRoutes = require('../routes/transaction.routes');
const customerRoutes = require('../routes/customer.routes');
const webhookRoutes = require('../routes/webhook.routes');
const authRoutes = require('../routes/auth.routes');
const systemRoutes = require('../routes/system.routes');
const bankAccountRoutes = require('../routes/bankAccount.routes');

const createApp = () => {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"]
      }
    },
    hsts: process.env.HELMET_HSTS_ENABLED === 'true'
  }));

  // CORS configuration - Enhanced for cross-PC connectivity
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      
      // Parse allowed origins from environment
      const allowedOrigins = process.env.CORS_ORIGIN ? 
        process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : 
        ['http://localhost:3000'];
      
      // Allow all origins in development mode
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      
      // Allow localhost variants for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'X-API-Key',
      'X-Webhook-Signature',
      'Accept',
      'Origin',
      'User-Agent'
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count']
  };
  
  app.use(cors(corsOptions));

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
  app.use(`/api/${apiVersion}/system`, systemRoutes);
  app.use(`/api/${apiVersion}/bank-accounts`, bankAccountRoutes);

  // Static file serving for admin panel
  app.use('/admin', express.static(path.join(__dirname, '../../public/admin')));

  // Static file serving for demo
  app.use('/demo', express.static(path.join(__dirname, '../../public/demo')));

  // Static file serving for stripe integration
  app.use('/stripe-integration', express.static(path.join(__dirname, '../../public/stripe-integration')));

  // Redirect root to admin panel
  app.get('/', (req, res) => {
    res.redirect('/admin');
  });

  // Stripe interface route
  const stripeInterfaceRouter = require('../../stripe-interface/routes');
  app.use('/stripe', stripeInterfaceRouter);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Route not found',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      code: 'ROUTE_NOT_FOUND'
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
};

module.exports = { createApp };