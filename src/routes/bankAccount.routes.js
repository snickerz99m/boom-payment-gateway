const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const BankAccountService = require('../services/bankAccount.service');
const { logger } = require('../utils/logger');

const router = express.Router();
const bankAccountService = new BankAccountService();

// Get all bank accounts
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    
    const bankAccounts = await bankAccountService.getBankAccounts({
      status,
      limit,
      offset
    });
    
    res.json({
      success: true,
      data: bankAccounts
    });
  } catch (error) {
    logger.error('Get bank accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get bank account by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const bankAccount = await bankAccountService.getBankAccountById(req.params.id);
    
    res.json({
      success: true,
      data: bankAccount
    });
  } catch (error) {
    logger.error('Get bank account error:', error);
    
    if (error.message === 'Bank account not found') {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new bank account
router.post('/', authenticate, async (req, res) => {
  try {
    const bankAccount = await bankAccountService.createBankAccount(req.body);
    
    res.status(201).json({
      success: true,
      data: bankAccount,
      message: 'Bank account created successfully'
    });
  } catch (error) {
    logger.error('Create bank account error:', error);
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Update bank account
router.put('/:id', authenticate, async (req, res) => {
  try {
    const bankAccount = await bankAccountService.updateBankAccount(req.params.id, req.body);
    
    res.json({
      success: true,
      data: bankAccount,
      message: 'Bank account updated successfully'
    });
  } catch (error) {
    logger.error('Update bank account error:', error);
    
    if (error.message === 'Bank account not found') {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Delete bank account
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await bankAccountService.deleteBankAccount(req.params.id);
    
    res.json({
      success: true,
      message: 'Bank account deleted successfully'
    });
  } catch (error) {
    logger.error('Delete bank account error:', error);
    
    if (error.message === 'Bank account not found') {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Set default bank account
router.post('/:id/set-default', authenticate, async (req, res) => {
  try {
    const bankAccount = await bankAccountService.setDefaultBankAccount(req.params.id);
    
    res.json({
      success: true,
      data: bankAccount,
      message: 'Default bank account set successfully'
    });
  } catch (error) {
    logger.error('Set default bank account error:', error);
    
    if (error.message === 'Bank account not found') {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Verify bank account
router.post('/:id/verify', authenticate, async (req, res) => {
  try {
    const result = await bankAccountService.verifyBankAccount(req.params.id, req.body);
    
    res.json({
      success: true,
      data: result,
      message: 'Bank account verified successfully'
    });
  } catch (error) {
    logger.error('Verify bank account error:', error);
    
    if (error.message === 'Bank account not found') {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get default bank account
router.get('/default/info', authenticate, async (req, res) => {
  try {
    const bankAccount = await bankAccountService.getDefaultBankAccount();
    
    res.json({
      success: true,
      data: bankAccount
    });
  } catch (error) {
    logger.error('Get default bank account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;