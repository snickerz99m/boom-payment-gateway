// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.apiBase = '/api/v1';
        this.authToken = localStorage.getItem('authToken');
        this.currentUser = null;
        this.currentPage = 'dashboard';
        this.systemStatus = 'online';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthentication();
        this.loadDashboard();
    }

    setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', this.toggleSidebar);
        
        // Login form
        document.getElementById('loginForm').addEventListener('submit', this.handleLogin.bind(this));
        
        // Auto-refresh data every 30 seconds
        setInterval(() => {
            if (this.currentPage === 'dashboard') {
                this.loadDashboard();
            }
        }, 30000);
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const content = document.getElementById('content');
        
        sidebar.classList.toggle('collapsed');
        content.classList.toggle('expanded');
    }

    async checkAuthentication() {
        if (!this.authToken) {
            this.showLoginModal();
            return;
        }

        try {
            const response = await this.apiCall('GET', '/auth/verify');
            if (response.success) {
                this.currentUser = response.user;
                this.hideLoginModal();
            } else {
                this.showLoginModal();
            }
        } catch (error) {
            this.showLoginModal();
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await this.apiCall('POST', '/auth/login', {
                email,
                password
            });

            if (response.success) {
                this.authToken = response.token;
                this.currentUser = response.user;
                localStorage.setItem('authToken', this.authToken);
                this.hideLoginModal();
                this.loadDashboard();
            } else {
                this.showAlert('Login failed: ' + response.message, 'danger');
            }
        } catch (error) {
            this.showAlert('Login failed: ' + error.message, 'danger');
        }
    }

    showLoginModal() {
        const modal = new bootstrap.Modal(document.getElementById('loginModal'));
        modal.show();
    }

    hideLoginModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (modal) {
            modal.hide();
        }
    }

    async apiCall(method, endpoint, data = null) {
        const url = this.apiBase + endpoint;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (this.authToken) {
            options.headers.Authorization = `Bearer ${this.authToken}`;
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        
        if (response.status === 401) {
            this.logout();
            return;
        }

        const result = await response.json();
        return result;
    }

    async loadPage(page) {
        this.currentPage = page;
        
        // Update active menu item
        document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
        event.target.classList.add('active');

        // Show loading
        document.getElementById('page-content').innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        try {
            switch (page) {
                case 'dashboard':
                    await this.loadDashboard();
                    break;
                case 'transactions':
                    await this.loadTransactions();
                    break;
                case 'customers':
                    await this.loadCustomers();
                    break;
                case 'orders':
                    await this.loadOrders();
                    break;
                case 'payouts':
                    await this.loadPayouts();
                    break;
                case 'refunds':
                    await this.loadRefunds();
                    break;
                case 'banks':
                    await this.loadBankAccounts();
                    break;
                case 'users':
                    await this.loadUsers();
                    break;
                case 'settings':
                    await this.loadSettings();
                    break;
                case 'logs':
                    await this.loadLogs();
                    break;
                case 'analytics':
                    await this.loadAnalytics();
                    break;
            }
        } catch (error) {
            this.showAlert('Error loading page: ' + error.message, 'danger');
        }
    }

    async loadDashboard() {
        try {
            const [stats, recentTransactions] = await Promise.all([
                this.apiCall('GET', '/transactions/stats'),
                this.apiCall('GET', '/transactions?limit=5&sort=created_at:desc')
            ]);

            const content = `
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="system-status ${this.systemStatus}">
                            <div class="status-indicator"></div>
                            <strong>System Status: ${this.systemStatus.charAt(0).toUpperCase() + this.systemStatus.slice(1)}</strong>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-lg-3 col-md-6">
                        <div class="stats-card">
                            <div class="card-icon text-primary">
                                <i class="fas fa-dollar-sign"></i>
                            </div>
                            <h3>$${(stats.data?.totalRevenue || 0).toLocaleString()}</h3>
                            <p>Total Revenue</p>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <div class="stats-card">
                            <div class="card-icon text-success">
                                <i class="fas fa-credit-card"></i>
                            </div>
                            <h3>${(stats.data?.totalTransactions || 0).toLocaleString()}</h3>
                            <p>Total Transactions</p>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <div class="stats-card">
                            <div class="card-icon text-warning">
                                <i class="fas fa-users"></i>
                            </div>
                            <h3>${(stats.data?.totalCustomers || 0).toLocaleString()}</h3>
                            <p>Total Customers</p>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <div class="stats-card">
                            <div class="card-icon text-info">
                                <i class="fas fa-percentage"></i>
                            </div>
                            <h3>${(stats.data?.successRate || 0).toFixed(1)}%</h3>
                            <p>Success Rate</p>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-lg-8">
                        <div class="chart-container">
                            <h5>Revenue Trend</h5>
                            <canvas id="revenueChart"></canvas>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="chart-container">
                            <h5>Transaction Status</h5>
                            <canvas id="statusChart"></canvas>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-12">
                        <div class="table-container">
                            <h5>Recent Transactions</h5>
                            <div class="table-responsive">
                                <table class="table table-striped">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Customer</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                            <th>Date</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${this.renderTransactionRows(recentTransactions.data || [])}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('page-content').innerHTML = content;
            this.initializeCharts();
        } catch (error) {
            this.showAlert('Error loading dashboard: ' + error.message, 'danger');
        }
    }

    renderTransactionRows(transactions) {
        return transactions.map(transaction => `
            <tr>
                <td>${transaction.transaction_id}</td>
                <td>${transaction.customer_info?.firstName || 'Guest'} ${transaction.customer_info?.lastName || ''}</td>
                <td>$${(transaction.amount / 100).toFixed(2)}</td>
                <td><span class="badge status-${transaction.status}">${transaction.status}</span></td>
                <td>${new Date(transaction.created_at).toLocaleString()}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="viewTransaction('${transaction.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="refundTransaction('${transaction.id}')">
                        <i class="fas fa-undo"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    initializeCharts() {
        // Revenue Chart
        const revenueCtx = document.getElementById('revenueChart');
        if (revenueCtx) {
            new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Revenue',
                        data: [12000, 19000, 15000, 25000, 22000, 30000],
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        // Status Chart
        const statusCtx = document.getElementById('statusChart');
        if (statusCtx) {
            new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Completed', 'Pending', 'Failed'],
                    datasets: [{
                        data: [75, 15, 10],
                        backgroundColor: [
                            '#28a745',
                            '#ffc107',
                            '#dc3545'
                        ]
                    }]
                },
                options: {
                    responsive: true
                }
            });
        }
    }

    async loadTransactions() {
        try {
            const transactions = await this.apiCall('GET', '/transactions');
            
            const content = `
                <div class="search-filter-container">
                    <div class="row">
                        <div class="col-md-4">
                            <input type="text" class="form-control" placeholder="Search transactions..." id="searchTransactions">
                        </div>
                        <div class="col-md-2">
                            <select class="form-control" id="statusFilter">
                                <option value="">All Status</option>
                                <option value="completed">Completed</option>
                                <option value="pending">Pending</option>
                                <option value="failed">Failed</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-primary" onclick="exportTransactions()">
                                <i class="fas fa-download"></i> Export
                            </button>
                        </div>
                    </div>
                </div>

                <div class="table-container">
                    <h5>All Transactions</h5>
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Customer</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderTransactionRows(transactions.data || [])}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            document.getElementById('page-content').innerHTML = content;
        } catch (error) {
            this.showAlert('Error loading transactions: ' + error.message, 'danger');
        }
    }

    async loadCustomers() {
        const content = `
            <div class="table-container">
                <h5>Customer Management</h5>
                <button class="btn btn-primary mb-3" onclick="addCustomer()">
                    <i class="fas fa-plus"></i> Add Customer
                </button>
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Total Transactions</th>
                                <th>Total Amount</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colspan="6" class="text-center">Loading customers...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('page-content').innerHTML = content;
    }

    async loadBankAccounts() {
        try {
            const bankAccounts = await this.apiCall('GET', '/bank-accounts');
            
            const content = `
                <div class="form-container">
                    <h5>Bank Account Management</h5>
                    <button class="btn btn-primary mb-3" onclick="showAddBankAccountModal()">
                        <i class="fas fa-plus"></i> Add Bank Account
                    </button>
                    
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Bank Name</th>
                                    <th>Account Number</th>
                                    <th>Account Type</th>
                                    <th>Status</th>
                                    <th>Verification</th>
                                    <th>Default</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderBankAccountRows(bankAccounts.data || [])}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Add Bank Account Modal -->
                <div class="modal fade" id="addBankAccountModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Add Bank Account</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <form id="addBankAccountForm">
                                    <div class="mb-3">
                                        <label class="form-label">Bank Name</label>
                                        <input type="text" class="form-control" name="bankName" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Account Holder Name</label>
                                        <input type="text" class="form-control" name="accountHolderName" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Account Number</label>
                                        <input type="text" class="form-control" name="accountNumber" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Routing Number</label>
                                        <input type="text" class="form-control" name="routingNumber" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Account Type</label>
                                        <select class="form-control" name="accountType" required>
                                            <option value="checking">Checking</option>
                                            <option value="savings">Savings</option>
                                            <option value="business">Business</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Country</label>
                                        <select class="form-control" name="country">
                                            <option value="US">United States</option>
                                            <option value="CA">Canada</option>
                                            <option value="GB">United Kingdom</option>
                                        </select>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" onclick="addBankAccount()">Add Account</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('page-content').innerHTML = content;
        } catch (error) {
            this.showAlert('Error loading bank accounts: ' + error.message, 'danger');
        }
    }

    renderBankAccountRows(bankAccounts) {
        return bankAccounts.map(account => `
            <tr>
                <td>${account.bankName}</td>
                <td>${account.maskedAccountNumber}</td>
                <td>${account.accountType.charAt(0).toUpperCase() + account.accountType.slice(1)}</td>
                <td>
                    <span class="badge ${this.getStatusBadgeClass(account.status)}">${account.status}</span>
                </td>
                <td>
                    <span class="badge ${this.getVerificationBadgeClass(account.verificationStatus)}">${account.verificationStatus}</span>
                </td>
                <td>
                    ${account.isDefault ? '<i class="fas fa-check text-success"></i>' : ''}
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editBankAccount('${account.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${!account.isDefault ? `
                        <button class="btn btn-sm btn-success" onclick="setDefaultBankAccount('${account.id}')">
                            <i class="fas fa-star"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-warning" onclick="verifyBankAccount('${account.id}')">
                        <i class="fas fa-check-circle"></i>
                    </button>
                    ${!account.isDefault ? `
                        <button class="btn btn-sm btn-danger" onclick="deleteBankAccount('${account.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }

    getStatusBadgeClass(status) {
        const classes = {
            'active': 'bg-success',
            'inactive': 'bg-secondary',
            'pending_verification': 'bg-warning',
            'suspended': 'bg-danger'
        };
        return classes[status] || 'bg-secondary';
    }

    getVerificationBadgeClass(status) {
        const classes = {
            'verified': 'bg-success',
            'unverified': 'bg-secondary',
            'pending': 'bg-warning',
            'failed': 'bg-danger'
        };
        return classes[status] || 'bg-secondary';
    }

    async loadSettings() {
        const content = `
            <div class="row">
                <div class="col-md-6">
                    <div class="form-container">
                        <h5>General Settings</h5>
                        <form id="generalSettings">
                            <div class="mb-3">
                                <label class="form-label">Business Name</label>
                                <input type="text" class="form-control" value="BOOM Payment Gateway">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Business Email</label>
                                <input type="email" class="form-control" value="admin@boom-payments.com">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Default Currency</label>
                                <select class="form-control">
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary">Save Settings</button>
                        </form>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="form-container">
                        <h5>Payment Gateway Configuration</h5>
                        <form id="paymentSettings">
                            <div class="mb-3">
                                <label class="form-label">Stripe API Key</label>
                                <input type="password" class="form-control" placeholder="sk_live_...">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">PayPal Client ID</label>
                                <input type="text" class="form-control" placeholder="PayPal Client ID">
                            </div>
                            <div class="mb-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="requireCVV">
                                    <label class="form-check-label" for="requireCVV">
                                        Require CVV
                                    </label>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary">Save Settings</button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('page-content').innerHTML = content;
    }

    async pauseSystem() {
        try {
            await this.apiCall('POST', '/system/pause');
            this.systemStatus = 'paused';
            this.showAlert('System paused successfully', 'warning');
            this.loadDashboard();
        } catch (error) {
            this.showAlert('Error pausing system: ' + error.message, 'danger');
        }
    }

    async restartSystem() {
        try {
            await this.apiCall('POST', '/system/restart');
            this.systemStatus = 'online';
            this.showAlert('System restarted successfully', 'success');
            this.loadDashboard();
        } catch (error) {
            this.showAlert('Error restarting system: ' + error.message, 'danger');
        }
    }

    logout() {
        localStorage.removeItem('authToken');
        this.authToken = null;
        this.currentUser = null;
        this.showLoginModal();
    }

    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.querySelector('main').insertBefore(alert, document.getElementById('page-content'));
        
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }
}

// Initialize admin panel
const adminPanel = new AdminPanel();

// Global functions for onclick events
function loadPage(page) {
    adminPanel.loadPage(page);
}

function pauseSystem() {
    adminPanel.pauseSystem();
}

function restartSystem() {
    adminPanel.restartSystem();
}

function logout() {
    adminPanel.logout();
}

function viewTransaction(id) {
    alert('View transaction: ' + id);
}

function refundTransaction(id) {
    alert('Refund transaction: ' + id);
}

function exportTransactions() {
    alert('Export transactions');
}

function addCustomer() {
    alert('Add customer');
}

function addBankAccount() {
    const form = document.getElementById('addBankAccountForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    adminPanel.apiCall('POST', '/bank-accounts', data)
        .then(response => {
            if (response.success) {
                adminPanel.showAlert('Bank account added successfully', 'success');
                const modal = bootstrap.Modal.getInstance(document.getElementById('addBankAccountModal'));
                modal.hide();
                adminPanel.loadBankAccounts();
            } else {
                adminPanel.showAlert('Failed to add bank account: ' + response.message, 'danger');
            }
        })
        .catch(error => {
            adminPanel.showAlert('Error adding bank account: ' + error.message, 'danger');
        });
}

function showAddBankAccountModal() {
    const modal = new bootstrap.Modal(document.getElementById('addBankAccountModal'));
    modal.show();
}

function editBankAccount(id) {
    alert('Edit bank account: ' + id);
}

function setDefaultBankAccount(id) {
    if (confirm('Set this bank account as default?')) {
        adminPanel.apiCall('POST', `/bank-accounts/${id}/set-default`)
            .then(response => {
                if (response.success) {
                    adminPanel.showAlert('Default bank account set successfully', 'success');
                    adminPanel.loadBankAccounts();
                } else {
                    adminPanel.showAlert('Failed to set default bank account: ' + response.message, 'danger');
                }
            })
            .catch(error => {
                adminPanel.showAlert('Error setting default bank account: ' + error.message, 'danger');
            });
    }
}

function verifyBankAccount(id) {
    if (confirm('Verify this bank account?')) {
        adminPanel.apiCall('POST', `/bank-accounts/${id}/verify`, {
            verificationMethod: 'manual',
            verifiedBy: 'admin'
        })
            .then(response => {
                if (response.success) {
                    adminPanel.showAlert('Bank account verified successfully', 'success');
                    adminPanel.loadBankAccounts();
                } else {
                    adminPanel.showAlert('Failed to verify bank account: ' + response.message, 'danger');
                }
            })
            .catch(error => {
                adminPanel.showAlert('Error verifying bank account: ' + error.message, 'danger');
            });
    }
}

function deleteBankAccount(id) {
    if (confirm('Are you sure you want to delete this bank account?')) {
        adminPanel.apiCall('DELETE', `/bank-accounts/${id}`)
            .then(response => {
                if (response.success) {
                    adminPanel.showAlert('Bank account deleted successfully', 'success');
                    adminPanel.loadBankAccounts();
                } else {
                    adminPanel.showAlert('Failed to delete bank account: ' + response.message, 'danger');
                }
            })
            .catch(error => {
                adminPanel.showAlert('Error deleting bank account: ' + error.message, 'danger');
            });
    }
}