const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');

// Auth routes
router.post('/login', (req, res) => {
  try {
    // Basic auth implementation for admin access
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }
    
    // Simple admin auth (in production, use proper user management)
    if (username === 'admin' && password === process.env.ADMIN_PASSWORD || 'admin123') {
      const token = require('jsonwebtoken').sign(
        { username, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );
      
      res.json({
        message: 'Login successful',
        token,
        user: { username, role: 'admin' }
      });
    } else {
      res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
  } catch (error) {
    logger.error('Auth error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

module.exports = router;