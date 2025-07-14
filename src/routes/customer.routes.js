const express = require('express');
const { body, validationResult } = require('express-validator');
const { logger } = require('../utils/logger');
const Customer = require('../models/Customer');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Create customer
router.post('/', [
  body('first_name').isString().isLength({ min: 1 }).withMessage('First name is required'),
  body('last_name').isString().isLength({ min: 1 }).withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().isString().withMessage('Phone must be a string'),
  body('address').optional().isObject().withMessage('Address must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Generate customer ID
    const customerId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Map snake_case to camelCase for model
    const customerData = {
      customerId: customerId,
      firstName: req.body.first_name,
      lastName: req.body.last_name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address
    };

    const customer = await Customer.create(customerData);
    
    logger.info(`Customer created successfully: ${customer.id}`);
    
    res.status(201).json({
      success: true,
      customer: {
        id: customer.id,
        customer_id: customer.customerId,
        first_name: customer.firstName,
        last_name: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        created_at: customer.created_at
      }
    });
  } catch (error) {
    logger.error('Customer creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Customer creation failed',
      message: error.message
    });
  }
});

// Get customer details
router.get('/:id', authMiddleware.authenticate(), async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      include: ['paymentMethods', 'transactions']
    });
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      customer
    });
  } catch (error) {
    logger.error('Failed to retrieve customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve customer',
      message: error.message
    });
  }
});

// Update customer
router.put('/:id', [
  authMiddleware.authenticate(),
  body('first_name').optional().isString().withMessage('First name must be a string'),
  body('last_name').optional().isString().withMessage('Last name must be a string'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().isString().withMessage('Phone must be a string'),
  body('address').optional().isObject().withMessage('Address must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const customer = await Customer.findByPk(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    await customer.update(req.body);
    
    logger.info(`Customer updated successfully: ${customer.id}`);
    
    res.json({
      success: true,
      customer
    });
  } catch (error) {
    logger.error('Customer update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Customer update failed',
      message: error.message
    });
  }
});

module.exports = router;