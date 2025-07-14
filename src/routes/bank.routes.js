const express = require('express');
const { body, validationResult } = require('express-validator');
const { logger } = require('../utils/logger');
const BankAccount = require('../models/BankAccount');
const Customer = require('../models/Customer');
const authMiddleware = require('../middleware/auth.middleware');
const bankService = require('../services/bank.service');

const router = express.Router();

// Add bank account
router.post('/', [
  body('customer_id').isUUID().withMessage('Valid customer ID is required'),
  body('account_name').isString().isLength({ min: 1 }).withMessage('Account name is required'),
  body('bank_name').isString().isLength({ min: 1 }).withMessage('Bank name is required'),
  body('account_number').isString().isLength({ min: 8, max: 17 }).withMessage('Valid account number is required'),
  body('routing_number').isString().isLength({ min: 9, max: 9 }).withMessage('Valid routing number is required'),
  body('account_type').isIn(['checking', 'savings']).withMessage('Account type must be checking or savings')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verify customer exists
    const customer = await Customer.findByPk(req.body.customer_id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Create bank account
    const bankAccount = await BankAccount.create({
      customerId: req.body.customer_id,
      accountName: req.body.account_name,
      bankName: req.body.bank_name,
      accountType: req.body.account_type || 'checking',
      status: 'pending_verification'
    });

    // Set encrypted account details
    bankAccount.setAccountNumber(req.body.account_number);
    bankAccount.setRoutingNumber(req.body.routing_number);
    await bankAccount.save();

    // Initiate verification process
    await bankService.initiateVerification(bankAccount.id);

    logger.info(`Bank account created successfully: ${bankAccount.id}`);
    
    res.status(201).json({
      success: true,
      bank_account: {
        id: bankAccount.id,
        customer_id: bankAccount.customerId,
        account_name: bankAccount.accountName,
        bank_name: bankAccount.bankName,
        account_type: bankAccount.accountType,
        status: bankAccount.status,
        masked_account_number: bankAccount.getMaskedAccountNumber(),
        created_at: bankAccount.createdAt
      }
    });
  } catch (error) {
    logger.error('Bank account creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Bank account creation failed',
      message: error.message
    });
  }
});

// Get bank account details
router.get('/:id', authMiddleware.authenticate(), async (req, res) => {
  try {
    const bankAccount = await BankAccount.findByPk(req.params.id, {
      include: [{
        model: Customer,
        as: 'customer',
        attributes: ['id', 'first_name', 'last_name', 'email']
      }]
    });
    
    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        error: 'Bank account not found'
      });
    }
    
    res.json({
      success: true,
      bank_account: {
        id: bankAccount.id,
        customer_id: bankAccount.customer_id,
        account_name: bankAccount.account_name,
        bank_name: bankAccount.bank_name,
        account_type: bankAccount.account_type,
        status: bankAccount.status,
        verification_method: bankAccount.verification_method,
        masked_account_number: bankAccount.getMaskedAccountNumber(),
        last_used_at: bankAccount.last_used_at,
        created_at: bankAccount.created_at,
        customer: bankAccount.customer
      }
    });
  } catch (error) {
    logger.error('Failed to retrieve bank account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve bank account',
      message: error.message
    });
  }
});

// Verify bank account
router.post('/:id/verify', [
  authMiddleware.authenticate(),
  body('verification_method').isIn(['micro_deposits', 'instant', 'plaid']).withMessage('Invalid verification method'),
  body('verification_data').isObject().withMessage('Verification data is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const bankAccount = await BankAccount.findByPk(req.params.id);
    
    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        error: 'Bank account not found'
      });
    }

    // Verify account using the specified method
    const verificationResult = await bankService.verifyAccount(
      bankAccount.id,
      req.body.verification_method,
      req.body.verification_data
    );

    if (verificationResult.success) {
      logger.info(`Bank account verified successfully: ${bankAccount.id}`);
      
      res.json({
        success: true,
        message: 'Bank account verified successfully',
        bank_account: {
          id: bankAccount.id,
          status: 'verified',
          verification_method: req.body.verification_method
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Verification failed',
        message: verificationResult.message
      });
    }
  } catch (error) {
    logger.error('Bank account verification failed:', error);
    res.status(500).json({
      success: false,
      error: 'Bank account verification failed',
      message: error.message
    });
  }
});

// List customer's bank accounts
router.get('/customer/:customer_id', authMiddleware.authenticate(), async (req, res) => {
  try {
    const bankAccounts = await BankAccount.findAll({
      where: { customer_id: req.params.customer_id },
      order: [['created_at', 'DESC']]
    });
    
    const accounts = bankAccounts.map(account => ({
      id: account.id,
      account_name: account.account_name,
      bank_name: account.bank_name,
      account_type: account.account_type,
      status: account.status,
      masked_account_number: account.getMaskedAccountNumber(),
      last_used_at: account.last_used_at,
      created_at: account.created_at
    }));
    
    res.json({
      success: true,
      bank_accounts: accounts
    });
  } catch (error) {
    logger.error('Failed to retrieve bank accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve bank accounts',
      message: error.message
    });
  }
});

// Delete bank account
router.delete('/:id', authMiddleware.authenticate(), async (req, res) => {
  try {
    const bankAccount = await BankAccount.findByPk(req.params.id);
    
    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        error: 'Bank account not found'
      });
    }

    await bankAccount.destroy();
    
    logger.info(`Bank account deleted successfully: ${req.params.id}`);
    
    res.json({
      success: true,
      message: 'Bank account deleted successfully'
    });
  } catch (error) {
    logger.error('Bank account deletion failed:', error);
    res.status(500).json({
      success: false,
      error: 'Bank account deletion failed',
      message: error.message
    });
  }
});

module.exports = router;