const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { generateApiResponse, generateErrorResponse } = require('../utils/helpers');
const BankAccount = require('../models/BankAccount');
const Payout = require('../models/Payout');

// Get all bank accounts
router.get('/', async (req, res) => {
  try {
    const accounts = await BankAccount.getActiveAccounts();
    
    // Return accounts with masked account numbers
    const maskedAccounts = accounts.map(account => ({
      id: account.id,
      accountId: account.accountId,
      accountNumber: account.getMaskedAccountNumber(),
      accountType: account.accountType,
      accountHolderName: account.accountHolderName,
      accountHolderType: account.accountHolderType,
      bankName: account.bankName,
      status: account.status,
      isDefault: account.isDefault,
      verificationStatus: account.verificationStatus,
      autoPayoutEnabled: account.autoPayoutEnabled,
      payoutSchedule: account.payoutSchedule,
      minimumPayoutAmount: account.minimumPayoutAmount,
      totalPayouts: account.totalPayouts,
      totalPayoutAmount: account.totalPayoutAmount,
      lastPayoutDate: account.lastPayoutDate,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    }));
    
    res.json(generateApiResponse(true, { accounts: maskedAccounts }));
  } catch (error) {
    logger.error('Failed to fetch bank accounts:', error);
    res.status(500).json(generateErrorResponse('Failed to fetch bank accounts', 'FETCH_ERROR'));
  }
});

// Get default bank account
router.get('/default', async (req, res) => {
  try {
    const account = await BankAccount.getDefaultAccount();
    
    if (!account) {
      return res.status(404).json(generateErrorResponse('No default bank account found', 'NOT_FOUND'));
    }
    
    res.json(generateApiResponse(true, {
      account: {
        id: account.id,
        accountId: account.accountId,
        accountNumber: account.getMaskedAccountNumber(),
        accountType: account.accountType,
        accountHolderName: account.accountHolderName,
        bankName: account.bankName,
        status: account.status,
        verificationStatus: account.verificationStatus,
        autoPayoutEnabled: account.autoPayoutEnabled,
        payoutSchedule: account.payoutSchedule,
        minimumPayoutAmount: account.minimumPayoutAmount
      }
    }));
  } catch (error) {
    logger.error('Failed to fetch default bank account:', error);
    res.status(500).json(generateErrorResponse('Failed to fetch default bank account', 'FETCH_ERROR'));
  }
});

// Add new bank account
router.post('/', async (req, res) => {
  try {
    const {
      accountNumber,
      routingNumber,
      accountType,
      accountHolderName,
      accountHolderType,
      bankName,
      address,
      city,
      state,
      zipCode,
      country,
      isDefault,
      autoPayoutEnabled,
      payoutSchedule,
      minimumPayoutAmount
    } = req.body;
    
    // Validate required fields
    if (!accountNumber || !routingNumber || !accountHolderName || !bankName) {
      return res.status(400).json(generateErrorResponse(
        'Account number, routing number, account holder name, and bank name are required',
        'VALIDATION_ERROR'
      ));
    }
    
    // Create bank account
    const account = await BankAccount.create({
      accountNumber,
      routingNumber,
      accountType: accountType || 'checking',
      accountHolderName,
      accountHolderType: accountHolderType || 'individual',
      bankName,
      address,
      city,
      state,
      zipCode,
      country: country || 'US',
      isDefault: isDefault || false,
      autoPayoutEnabled: autoPayoutEnabled || false,
      payoutSchedule: payoutSchedule || 'daily',
      minimumPayoutAmount: minimumPayoutAmount || 1000
    });
    
    logger.info(`Bank account created: ${account.accountId}`);
    
    res.status(201).json(generateApiResponse(true, {
      account: {
        id: account.id,
        accountId: account.accountId,
        accountNumber: account.getMaskedAccountNumber(),
        accountType: account.accountType,
        accountHolderName: account.accountHolderName,
        bankName: account.bankName,
        status: account.status,
        verificationStatus: account.verificationStatus,
        isDefault: account.isDefault
      }
    }, 'Bank account added successfully'));
  } catch (error) {
    logger.error('Failed to create bank account:', error);
    res.status(500).json(generateErrorResponse('Failed to create bank account', 'CREATE_ERROR'));
  }
});

// Update bank account
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const account = await BankAccount.findByPk(id);
    if (!account) {
      return res.status(404).json(generateErrorResponse('Bank account not found', 'NOT_FOUND'));
    }
    
    // Update allowed fields
    const allowedFields = [
      'accountHolderName', 'bankName', 'address', 'city', 'state', 
      'zipCode', 'isDefault', 'autoPayoutEnabled', 'payoutSchedule', 
      'minimumPayoutAmount'
    ];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        account[field] = updates[field];
      }
    }
    
    await account.save();
    
    logger.info(`Bank account updated: ${account.accountId}`);
    
    res.json(generateApiResponse(true, {
      account: {
        id: account.id,
        accountId: account.accountId,
        accountNumber: account.getMaskedAccountNumber(),
        accountType: account.accountType,
        accountHolderName: account.accountHolderName,
        bankName: account.bankName,
        status: account.status,
        isDefault: account.isDefault,
        autoPayoutEnabled: account.autoPayoutEnabled,
        payoutSchedule: account.payoutSchedule,
        minimumPayoutAmount: account.minimumPayoutAmount
      }
    }, 'Bank account updated successfully'));
  } catch (error) {
    logger.error('Failed to update bank account:', error);
    res.status(500).json(generateErrorResponse('Failed to update bank account', 'UPDATE_ERROR'));
  }
});

// Delete bank account
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const account = await BankAccount.findByPk(id);
    if (!account) {
      return res.status(404).json(generateErrorResponse('Bank account not found', 'NOT_FOUND'));
    }
    
    // Check if it's the default account
    if (account.isDefault) {
      return res.status(400).json(generateErrorResponse(
        'Cannot delete default bank account. Set another account as default first.',
        'VALIDATION_ERROR'
      ));
    }
    
    await account.destroy();
    
    logger.info(`Bank account deleted: ${account.accountId}`);
    
    res.json(generateApiResponse(true, null, 'Bank account deleted successfully'));
  } catch (error) {
    logger.error('Failed to delete bank account:', error);
    res.status(500).json(generateErrorResponse('Failed to delete bank account', 'DELETE_ERROR'));
  }
});

// Set as default bank account
router.post('/:id/default', async (req, res) => {
  try {
    const { id } = req.params;
    
    const account = await BankAccount.findByPk(id);
    if (!account) {
      return res.status(404).json(generateErrorResponse('Bank account not found', 'NOT_FOUND'));
    }
    
    if (account.status !== 'active') {
      return res.status(400).json(generateErrorResponse(
        'Only active bank accounts can be set as default',
        'VALIDATION_ERROR'
      ));
    }
    
    account.isDefault = true;
    await account.save();
    
    logger.info(`Bank account set as default: ${account.accountId}`);
    
    res.json(generateApiResponse(true, null, 'Bank account set as default successfully'));
  } catch (error) {
    logger.error('Failed to set bank account as default:', error);
    res.status(500).json(generateErrorResponse('Failed to set bank account as default', 'UPDATE_ERROR'));
  }
});

module.exports = router;