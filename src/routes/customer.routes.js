const express = require('express');
const { customerValidators } = require('../validators/customer.validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const Customer = require('../models/Customer');
const { logger } = require('../utils/logger');

const router = express.Router();

// Create customer
router.post('/', validate(customerValidators.createCustomer), async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    
    res.status(201).json({
      success: true,
      data: customer
    });
    
  } catch (error) {
    logger.error('Create customer error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Customer creation failed'
    });
  }
});

// Get all customers with pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    
    if (search) {
      const { Op } = require('sequelize');
      whereClause[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    const { count, rows } = await Customer.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        { model: require('../models/PaymentMethod'), as: 'paymentMethods' },
        { model: require('../models/Transaction'), as: 'transactions', limit: 5 }
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
    logger.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get customer by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      include: [
        { model: require('../models/PaymentMethod'), as: 'paymentMethods' },
        { model: require('../models/Transaction'), as: 'transactions' },
        { model: require('../models/Refund'), as: 'refunds' }
      ]
    });
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      data: customer
    });
    
  } catch (error) {
    logger.error('Get customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update customer
router.put('/:id', authenticate, validate(customerValidators.updateCustomer), async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    await customer.update(req.body);
    
    res.json({
      success: true,
      data: customer
    });
    
  } catch (error) {
    logger.error('Update customer error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Customer update failed'
    });
  }
});

// Delete customer
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    await customer.destroy();
    
    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
    
  } catch (error) {
    logger.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get customer statistics
router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    const stats = {
      totalTransactions: customer.totalTransactions,
      successfulTransactions: customer.successfulTransactions,
      failedTransactions: customer.failedTransactions,
      totalAmount: customer.totalAmount,
      lifetimeValue: customer.lifetimeValue,
      averageTransactionAmount: customer.totalTransactions > 0 ? customer.totalAmount / customer.totalTransactions : 0,
      successRate: customer.totalTransactions > 0 ? (customer.successfulTransactions / customer.totalTransactions) * 100 : 0
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Get customer stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;