const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const Transaction = require('../models/Transaction');
const { logger } = require('../utils/logger');

const router = express.Router();

// Get all transactions with pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, customerId, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    
    if (status) whereClause.status = status;
    if (customerId) whereClause.customerId = customerId;
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.$gte = new Date(startDate);
      if (endDate) whereClause.createdAt.$lte = new Date(endDate);
    }
    
    const { count, rows } = await Transaction.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: require('../models/Customer'), as: 'customer' },
        { model: require('../models/PaymentMethod'), as: 'paymentMethod' }
      ]
    });
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
    
  } catch (error) {
    logger.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get transaction by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const transaction = await Transaction.findByPk(req.params.id, {
      include: [
        { model: require('../models/Customer'), as: 'customer' },
        { model: require('../models/PaymentMethod'), as: 'paymentMethod' },
        { model: require('../models/Refund'), as: 'refunds' }
      ]
    });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }
    
    res.json({
      success: true,
      data: transaction
    });
    
  } catch (error) {
    logger.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get transaction statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const whereClause = {};
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.$gte = new Date(startDate);
      if (endDate) whereClause.createdAt.$lte = new Date(endDate);
    }
    
    const { sequelize } = require('../config/database');
    
    // Get totals
    const totals = await Transaction.findOne({
      where: whereClause,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransactions'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'totalRevenue'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('customer_id'))), 'totalCustomers']
      ],
      raw: true
    });
    
    // Get success rate
    const successCount = await Transaction.count({
      where: { ...whereClause, status: 'completed' }
    });
    
    const totalCount = await Transaction.count({ where: whereClause });
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        totalTransactions: totals.totalTransactions || 0,
        totalRevenue: (totals.totalRevenue || 0) / 100, // Convert from cents
        totalCustomers: totals.totalCustomers || 0,
        successRate: successRate
      }
    });
    
  } catch (error) {
    logger.error('Get transaction stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get transaction statistics summary
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const whereClause = {};
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.$gte = new Date(startDate);
      if (endDate) whereClause.createdAt.$lte = new Date(endDate);
    }
    
    const { sequelize } = require('../config/database');
    const stats = await Transaction.findAll({
      where: whereClause,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
        [sequelize.fn('AVG', sequelize.col('amount')), 'avg_amount']
      ],
      group: ['status'],
      raw: true
    });
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Get transaction stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Search transactions
router.get('/search/:query', authenticate, async (req, res) => {
  try {
    const { query } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const { sequelize } = require('../config/database');
    const { Op } = require('sequelize');
    
    const whereClause = {
      [Op.or]: [
        { transactionId: { [Op.iLike]: `%${query}%` } },
        { description: { [Op.iLike]: `%${query}%` } },
        { gatewayTransactionId: { [Op.iLike]: `%${query}%` } },
        { orderId: { [Op.iLike]: `%${query}%` } }
      ]
    };
    
    const { count, rows } = await Transaction.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: require('../models/Customer'), as: 'customer' },
        { model: require('../models/PaymentMethod'), as: 'paymentMethod' }
      ]
    });
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
    
  } catch (error) {
    logger.error('Search transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;