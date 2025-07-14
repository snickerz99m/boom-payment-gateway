const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { logger } = require('../utils/logger');

const router = express.Router();

// System status tracking
let systemStatus = {
  status: 'online',
  pausedAt: null,
  restartedAt: null,
  uptime: process.uptime()
};

// Get system status
router.get('/status', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        ...systemStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    });
  } catch (error) {
    logger.error('Get system status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Pause system
router.post('/pause', authenticate, async (req, res) => {
  try {
    systemStatus.status = 'paused';
    systemStatus.pausedAt = new Date();
    
    logger.warn('System paused by admin');
    
    res.json({
      success: true,
      message: 'System paused successfully'
    });
  } catch (error) {
    logger.error('Pause system error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Restart system
router.post('/restart', authenticate, async (req, res) => {
  try {
    systemStatus.status = 'online';
    systemStatus.restartedAt = new Date();
    systemStatus.pausedAt = null;
    
    logger.info('System restarted by admin');
    
    res.json({
      success: true,
      message: 'System restarted successfully'
    });
  } catch (error) {
    logger.error('Restart system error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get system health
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: systemStatus.status,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Get system health error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;