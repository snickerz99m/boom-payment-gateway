const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authValidators } = require('../validators/auth.validator');
const { validate } = require('../middleware/validation.middleware');
const { logger } = require('../utils/logger');

const router = express.Router();

// Default admin credentials (change in production)
const DEFAULT_ADMIN = {
  username: 'admin',
  password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 'password'
  role: 'admin'
};

// Login endpoint
router.post('/login', validate(authValidators.login), async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // For now, use default admin credentials
    // In production, this should query a proper users table
    if (email !== 'admin@boom-payments.com' && email !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    const isValidPassword = await bcrypt.compare(password, DEFAULT_ADMIN.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        username: DEFAULT_ADMIN.username,
        email: 'admin@boom-payments.com',
        role: DEFAULT_ADMIN.role 
      },
      process.env.JWT_SECRET || 'default-secret',
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '24h' 
      }
    );
    
    logger.info(`User ${email} logged in successfully`);
    
    res.json({
      success: true,
      token,
      user: {
        username: DEFAULT_ADMIN.username,
        email: 'admin@boom-payments.com',
        role: DEFAULT_ADMIN.role
      }
    });
    
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify token endpoint
router.post('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    
    res.json({
      success: true,
      user: {
        username: decoded.username,
        email: decoded.email,
        role: decoded.role
      }
    });
    
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  // For JWT, logout is handled client-side by removing the token
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;