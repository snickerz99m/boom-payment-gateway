const { logger } = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');
const BankAccount = require('../models/BankAccount');
const Transaction = require('../models/Transaction');
const { TRANSACTION_STATUS } = require('../config/constants');
const { fromCents, toCents } = require('../utils/helpers');
const notificationService = require('./notification.service');

/**
 * Enhanced Bank Account Service
 * Handles bank account management and payout processing
 */
class BankAccountService {
  constructor() {
    this.encryptionFields = ['accountNumber', 'routingNumber'];
    this.minimumPayoutAmount = 100; // $1.00 in cents
    this.maximumPayoutAmount = 10000000; // $100,000 in cents
    this.payoutSchedule = {
      daily: { enabled: true, cutoffTime: '23:59' },
      weekly: { enabled: true, dayOfWeek: 5, cutoffTime: '23:59' }, // Friday
      monthly: { enabled: true, dayOfMonth: 1, cutoffTime: '23:59' }
    };
  }

  /**
   * Create a new bank account
   * @param {object} accountData - Bank account data
   * @returns {object} - Created bank account
   */
  async createBankAccount(accountData) {
    try {
      // Validate required fields
      const requiredFields = ['bankName', 'accountNumber', 'routingNumber', 'accountHolderName'];
      for (const field of requiredFields) {
        if (!accountData[field]) {
          throw new Error(`${field} is required`);
        }
      }

      // Validate routing number (US format)
      if (!/^\d{9}$/.test(accountData.routingNumber)) {
        throw new Error('Invalid routing number format');
      }

      // Validate account number
      if (accountData.accountNumber.length < 4 || accountData.accountNumber.length > 20) {
        throw new Error('Account number must be between 4 and 20 characters');
      }

      // Check for duplicate account
      const existingAccount = await BankAccount.findOne({
        where: {
          accountNumber: encrypt(accountData.accountNumber),
          routingNumber: encrypt(accountData.routingNumber)
        }
      });

      if (existingAccount) {
        throw new Error('Bank account already exists');
      }

      // Encrypt sensitive data
      const encryptedData = { ...accountData };
      for (const field of this.encryptionFields) {
        if (encryptedData[field]) {
          encryptedData[field] = encrypt(encryptedData[field]);
        }
      }

      // Create bank account
      const bankAccount = await BankAccount.create(encryptedData);

      logger.info(`Bank account created: ${bankAccount.id}`);

      return this.formatBankAccountResponse(bankAccount);
    } catch (error) {
      logger.error('Failed to create bank account:', error);
      throw error;
    }
  }

  /**
   * Get all bank accounts
   * @param {object} options - Query options
   * @returns {array} - Bank accounts
   */
  async getBankAccounts(options = {}) {
    try {
      const { status, limit = 20, offset = 0 } = options;

      const whereClause = {};
      if (status) {
        whereClause.status = status;
      }

      const bankAccounts = await BankAccount.findAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      return bankAccounts.map(account => this.formatBankAccountResponse(account));
    } catch (error) {
      logger.error('Failed to get bank accounts:', error);
      throw error;
    }
  }

  /**
   * Get bank account by ID
   * @param {string} accountId - Bank account ID
   * @returns {object} - Bank account
   */
  async getBankAccountById(accountId) {
    try {
      const bankAccount = await BankAccount.findByPk(accountId);
      
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      return this.formatBankAccountResponse(bankAccount);
    } catch (error) {
      logger.error('Failed to get bank account:', error);
      throw error;
    }
  }

  /**
   * Update bank account
   * @param {string} accountId - Bank account ID
   * @param {object} updateData - Update data
   * @returns {object} - Updated bank account
   */
  async updateBankAccount(accountId, updateData) {
    try {
      const bankAccount = await BankAccount.findByPk(accountId);
      
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      // Encrypt sensitive data if provided
      const encryptedData = { ...updateData };
      for (const field of this.encryptionFields) {
        if (encryptedData[field]) {
          encryptedData[field] = encrypt(encryptedData[field]);
        }
      }

      await bankAccount.update(encryptedData);

      logger.info(`Bank account updated: ${accountId}`);

      return this.formatBankAccountResponse(bankAccount);
    } catch (error) {
      logger.error('Failed to update bank account:', error);
      throw error;
    }
  }

  /**
   * Delete bank account
   * @param {string} accountId - Bank account ID
   * @returns {boolean} - Success status
   */
  async deleteBankAccount(accountId) {
    try {
      const bankAccount = await BankAccount.findByPk(accountId);
      
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      // Check if it's the default account
      if (bankAccount.isDefault) {
        throw new Error('Cannot delete default bank account');
      }

      await bankAccount.destroy();

      logger.info(`Bank account deleted: ${accountId}`);

      return true;
    } catch (error) {
      logger.error('Failed to delete bank account:', error);
      throw error;
    }
  }

  /**
   * Set default bank account
   * @param {string} accountId - Bank account ID
   * @returns {object} - Updated bank account
   */
  async setDefaultBankAccount(accountId) {
    try {
      const bankAccount = await BankAccount.findByPk(accountId);
      
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      if (bankAccount.status !== 'active') {
        throw new Error('Only active bank accounts can be set as default');
      }

      await BankAccount.setDefault(accountId);

      logger.info(`Default bank account set: ${accountId}`);

      return this.formatBankAccountResponse(await BankAccount.findByPk(accountId));
    } catch (error) {
      logger.error('Failed to set default bank account:', error);
      throw error;
    }
  }

  /**
   * Verify bank account
   * @param {string} accountId - Bank account ID
   * @param {object} verificationData - Verification data
   * @returns {object} - Verification result
   */
  async verifyBankAccount(accountId, verificationData) {
    try {
      const bankAccount = await BankAccount.findByPk(accountId);
      
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      // Simulate verification process
      // In real implementation, this would integrate with ACH verification service
      const verificationResult = {
        status: 'verified',
        verificationMethod: 'micro_deposits',
        verifiedAt: new Date(),
        details: verificationData
      };

      await bankAccount.update({
        verificationStatus: verificationResult.status,
        verificationDate: verificationResult.verifiedAt,
        verificationDetails: verificationResult.details,
        status: 'active'
      });

      logger.info(`Bank account verified: ${accountId}`);

      return {
        success: true,
        bankAccount: this.formatBankAccountResponse(bankAccount),
        verification: verificationResult
      };
    } catch (error) {
      logger.error('Failed to verify bank account:', error);
      throw error;
    }
  }

  /**
   * Get default bank account
   * @returns {object} - Default bank account
   */
  async getDefaultBankAccount() {
    try {
      const bankAccount = await BankAccount.findDefault();
      
      if (!bankAccount) {
        return null;
      }

      return this.formatBankAccountResponse(bankAccount);
    } catch (error) {
      logger.error('Failed to get default bank account:', error);
      throw error;
    }
  }

  /**
   * Calculate available payout amount
   * @param {string} bankAccountId - Bank account ID (optional)
   * @returns {object} - Payout calculation
   */
  async calculateAvailablePayout(bankAccountId = null) {
    try {
      // Get completed transactions that haven't been paid out
      const completedTransactions = await Transaction.findAll({
        where: {
          status: TRANSACTION_STATUS.COMPLETED,
          // Add condition to check if transaction hasn't been paid out
          // This would require a payoutId field in Transaction model
        }
      });

      let totalRevenue = 0;
      let totalFees = 0;
      let transactionCount = 0;

      for (const transaction of completedTransactions) {
        totalRevenue += transaction.amount;
        totalFees += transaction.processingFee;
        transactionCount++;
      }

      const availableAmount = totalRevenue - totalFees;

      return {
        availableAmount: availableAmount,
        formattedAmount: fromCents(availableAmount),
        totalTransactions: transactionCount,
        totalRevenue: fromCents(totalRevenue),
        totalFees: fromCents(totalFees),
        canPayout: availableAmount >= this.minimumPayoutAmount,
        minimumPayout: fromCents(this.minimumPayoutAmount),
        maximumPayout: fromCents(this.maximumPayoutAmount)
      };
    } catch (error) {
      logger.error('Failed to calculate available payout:', error);
      throw error;
    }
  }

  /**
   * Process payout to bank account
   * @param {object} payoutData - Payout data
   * @returns {object} - Payout result
   */
  async processPayout(payoutData) {
    try {
      const { bankAccountId, amount, description = 'Payout' } = payoutData;

      // Validate bank account
      const bankAccount = await BankAccount.findByPk(bankAccountId);
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      if (bankAccount.status !== 'active' || bankAccount.verificationStatus !== 'verified') {
        throw new Error('Bank account must be active and verified for payouts');
      }

      // Validate amount
      const amountInCents = toCents(amount);
      if (amountInCents < this.minimumPayoutAmount) {
        throw new Error(`Minimum payout amount is ${fromCents(this.minimumPayoutAmount)}`);
      }

      if (amountInCents > this.maximumPayoutAmount) {
        throw new Error(`Maximum payout amount is ${fromCents(this.maximumPayoutAmount)}`);
      }

      // Check available balance
      const availablePayout = await this.calculateAvailablePayout(bankAccountId);
      if (amountInCents > availablePayout.availableAmount) {
        throw new Error('Insufficient funds for payout');
      }

      // Simulate payout processing
      const payoutResult = await this.simulatePayoutProcessing(bankAccount, amountInCents, description);

      // Update bank account payout statistics
      await bankAccount.update({
        totalPayouts: bankAccount.totalPayouts + 1,
        totalPayoutAmount: bankAccount.totalPayoutAmount + amountInCents,
        lastPayoutDate: new Date()
      });

      logger.info(`Payout processed: ${payoutResult.payoutId} - ${fromCents(amountInCents)} to ${bankAccount.bankName}`);

      return {
        success: true,
        payout: payoutResult,
        bankAccount: this.formatBankAccountResponse(bankAccount)
      };
    } catch (error) {
      logger.error('Failed to process payout:', error);
      throw error;
    }
  }

  /**
   * Simulate payout processing
   * @param {object} bankAccount - Bank account
   * @param {number} amountInCents - Amount in cents
   * @param {string} description - Payout description
   * @returns {object} - Payout result
   */
  async simulatePayoutProcessing(bankAccount, amountInCents, description) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // In a real implementation, this would integrate with ACH/wire transfer services
    const payoutResult = {
      payoutId: payoutId,
      amount: amountInCents,
      formattedAmount: fromCents(amountInCents),
      currency: 'USD',
      status: 'pending',
      description: description,
      bankAccount: {
        id: bankAccount.id,
        bankName: bankAccount.bankName,
        accountNumberMask: bankAccount.getMaskedAccountNumber(),
        accountType: bankAccount.accountType
      },
      estimatedArrival: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
      processingFee: Math.round(amountInCents * 0.001), // 0.1% processing fee
      createdAt: new Date(),
      payoutMethod: 'ach_transfer'
    };

    return payoutResult;
  }

  /**
   * Schedule automatic payout
   * @param {object} scheduleData - Schedule data
   * @returns {object} - Schedule result
   */
  async scheduleAutomaticPayout(scheduleData) {
    try {
      const { bankAccountId, frequency, minimumAmount, enabled = true } = scheduleData;

      // Validate bank account
      const bankAccount = await BankAccount.findByPk(bankAccountId);
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      // Validate frequency
      if (!this.payoutSchedule[frequency]) {
        throw new Error('Invalid payout frequency');
      }

      // Update bank account with schedule
      await bankAccount.update({
        automaticPayouts: enabled,
        payoutSchedule: {
          frequency: frequency,
          minimumAmount: toCents(minimumAmount),
          enabled: enabled,
          ...this.payoutSchedule[frequency]
        }
      });

      logger.info(`Automatic payout scheduled: ${bankAccountId} - ${frequency}`);

      return {
        success: true,
        schedule: {
          frequency: frequency,
          minimumAmount: fromCents(toCents(minimumAmount)),
          enabled: enabled,
          bankAccount: this.formatBankAccountResponse(bankAccount)
        }
      };
    } catch (error) {
      logger.error('Failed to schedule automatic payout:', error);
      throw error;
    }
  }

  /**
   * Get payout history
   * @param {object} options - Query options
   * @returns {array} - Payout history
   */
  async getPayoutHistory(options = {}) {
    try {
      const { bankAccountId, limit = 20, offset = 0 } = options;

      // In a real implementation, this would query a payouts table
      // For now, return mock data
      const mockPayouts = [
        {
          payoutId: 'payout_123',
          amount: 10000,
          formattedAmount: '$100.00',
          status: 'completed',
          bankAccount: {
            bankName: 'Test Bank',
            accountNumberMask: '****1234'
          },
          completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      ];

      return mockPayouts;
    } catch (error) {
      logger.error('Failed to get payout history:', error);
      throw error;
    }
  }

  /**
   * Format bank account response
   * @param {object} bankAccount - Bank account model
   * @returns {object} - Formatted response
   */
  formatBankAccountResponse(bankAccount) {
    const response = bankAccount.toJSON();
    
    // Add additional computed fields
    response.maskedAccountNumber = bankAccount.getMaskedAccountNumber();
    response.canReceivePayouts = bankAccount.canReceivePayouts();
    response.formattedTotalPayoutAmount = fromCents(bankAccount.totalPayoutAmount);
    
    return response;
  }
}

module.exports = new BankAccountService();