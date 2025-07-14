const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');

// Get all customers
router.get('/', async (req, res) => {
  try {
    // Simulate customer list
    const customers = [
      {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        created_at: new Date().toISOString()
      }
    ];
    
    res.json({ customers });
  } catch (error) {
    logger.error('Customer fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch customers',
      code: 'FETCH_ERROR'
    });
  }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Simulate customer lookup
    const customer = {
      id,
      name: 'John Doe',
      email: 'john@example.com',
      created_at: new Date().toISOString()
    };
    
    res.json(customer);
  } catch (error) {
    logger.error('Customer lookup error:', error);
    res.status(500).json({
      error: 'Customer not found',
      code: 'NOT_FOUND'
    });
  }
});

module.exports = router;