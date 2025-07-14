const { logger } = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');
const BankAccount = require('../models/BankAccount');

/**
 * Bank Account Service
 * Handles bank account management for payouts
 */
class BankAccountService {
  constructor() {
    this.encryptionFields = ['accountNumber', 'routingNumber'];
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
   * Format bank account response
   * @param {object} bankAccount - Bank account model
   * @returns {object} - Formatted response
   */
  formatBankAccountResponse(bankAccount) {
    const response = bankAccount.toJSON();
    
    // Add additional computed fields
    response.maskedAccountNumber = bankAccount.getMaskedAccountNumber();
    response.canReceivePayouts = bankAccount.canReceivePayouts();
    
    return response;
  }
}

module.exports = BankAccountService;