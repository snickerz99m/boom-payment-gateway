const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const bankAccountService = require('../services/bankAccount.service');
const { logger } = require('../utils/logger');

const router = express.Router();

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

// Calculate available payout
router.get('/payout/available', authenticate, async (req, res) => {
  try {
    const calculation = await bankAccountService.calculateAvailablePayout(req.query.bankAccountId);
    
    res.json({
      success: true,
      data: calculation
    });
  } catch (error) {
    logger.error('Calculate available payout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate available payout'
    });
  }
});

// Process payout
router.post('/payout/process', authenticate, async (req, res) => {
  try {
    const result = await bankAccountService.processPayout(req.body);
    
    res.json({
      success: true,
      data: result,
      message: 'Payout processed successfully'
    });
  } catch (error) {
    logger.error('Process payout error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to process payout'
    });
  }
});

// Schedule automatic payout
router.post('/payout/schedule', authenticate, async (req, res) => {
  try {
    const result = await bankAccountService.scheduleAutomaticPayout(req.body);
    
    res.json({
      success: true,
      data: result,
      message: 'Automatic payout scheduled successfully'
    });
  } catch (error) {
    logger.error('Schedule payout error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to schedule payout'
    });
  }
});

// Get payout history
router.get('/payout/history', authenticate, async (req, res) => {
  try {
    const history = await bankAccountService.getPayoutHistory(req.query);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Get payout history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payout history'
    });
  }
});

module.exports = router;