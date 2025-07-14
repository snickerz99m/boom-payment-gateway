// Proxy Service for Secure Anonymous Routing
// Features: HTTP/HTTPS proxy support, authentication, rotation, security headers

const https = require('https');
const http = require('http');
const url = require('url');
const crypto = require('crypto');

class ProxyService {
    constructor() {
        this.proxyList = [];
        this.currentProxyIndex = 0;
        this.proxyHealth = new Map();
        this.rateLimiter = new Map();
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
        
        this.init();
    }
    
    init() {
        this.loadProxyConfiguration();
        this.startHealthChecks();
        this.setupRateLimiting();
    }
    
    loadProxyConfiguration() {
        // Load proxy configuration from environment or config file
        const proxyConfig = process.env.PROXY_CONFIG || '[]';
        try {
            this.proxyList = JSON.parse(proxyConfig);
        } catch (error) {
            console.warn('Invalid proxy configuration, using fallback');
            this.proxyList = [
                {
                    host: 'proxy1.example.com',
                    port: 8080,
                    username: null,
                    password: null,
                    protocol: 'http'
                },
                {
                    host: 'proxy2.example.com',
                    port: 3128,
                    username: null,
                    password: null,
                    protocol: 'http'
                }
            ];
        }
        
        // Initialize health status
        this.proxyList.forEach(proxy => {
            this.proxyHealth.set(this.getProxyKey(proxy), {
                healthy: true,
                lastCheck: Date.now(),
                failureCount: 0
            });
        });
    }
    
    getProxyKey(proxy) {
        return `${proxy.host}:${proxy.port}`;
    }
    
    async makeRequest(targetUrl, options = {}) {
        const maxRetries = 3;
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const proxy = this.getNextHealthyProxy();
                if (!proxy) {
                    throw new Error('No healthy proxies available');
                }
                
                const response = await this.executeProxyRequest(targetUrl, proxy, options);
                
                // Mark proxy as healthy on success
                this.markProxyHealthy(proxy);
                
                return response;
                
            } catch (error) {
                lastError = error;
                console.warn(`Proxy request attempt ${attempt + 1} failed:`, error.message);
                
                if (attempt < maxRetries - 1) {
                    await this.delay(1000 * (attempt + 1)); // Exponential backoff
                }
            }
        }
        
        throw lastError;
    }
    
    async executeProxyRequest(targetUrl, proxy, options) {
        return new Promise((resolve, reject) => {
            const parsedUrl = url.parse(targetUrl);
            const isHttps = parsedUrl.protocol === 'https:';
            const targetPort = parsedUrl.port || (isHttps ? 443 : 80);
            
            const requestOptions = {
                hostname: proxy.host,
                port: proxy.port,
                method: options.method || 'GET',
                headers: {
                    'Host': parsedUrl.hostname,
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    ...options.headers
                },
                timeout: options.timeout || 30000
            };
            
            // Add proxy authentication if required
            if (proxy.username && proxy.password) {
                const auth = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
                requestOptions.headers['Proxy-Authorization'] = `Basic ${auth}`;
            }
            
            // For HTTPS targets through HTTP proxy
            if (isHttps && proxy.protocol === 'http') {
                requestOptions.method = 'CONNECT';
                requestOptions.path = `${parsedUrl.hostname}:${targetPort}`;
            } else {
                requestOptions.path = targetUrl;
            }
            
            const httpModule = proxy.protocol === 'https' ? https : http;
            
            const req = httpModule.request(requestOptions, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = {
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: data,
                            json: () => JSON.parse(data)
                        };
                        
                        resolve(response);
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                this.markProxyUnhealthy(proxy);
                reject(new Error(`Proxy request failed: ${error.message}`));
            });
            
            req.on('timeout', () => {
                req.destroy();
                this.markProxyUnhealthy(proxy);
                reject(new Error('Proxy request timeout'));
            });
            
            // Send request body if provided
            if (options.body) {
                req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
            }
            
            req.end();
        });
    }
    
    getNextHealthyProxy() {
        const healthyProxies = this.proxyList.filter(proxy => {
            const health = this.proxyHealth.get(this.getProxyKey(proxy));
            return health && health.healthy;
        });
        
        if (healthyProxies.length === 0) {
            return null;
        }
        
        // Round-robin selection
        const proxy = healthyProxies[this.currentProxyIndex % healthyProxies.length];
        this.currentProxyIndex++;
        
        return proxy;
    }
    
    markProxyHealthy(proxy) {
        const key = this.getProxyKey(proxy);
        const health = this.proxyHealth.get(key);
        if (health) {
            health.healthy = true;
            health.failureCount = 0;
            health.lastCheck = Date.now();
        }
    }
    
    markProxyUnhealthy(proxy) {
        const key = this.getProxyKey(proxy);
        const health = this.proxyHealth.get(key);
        if (health) {
            health.failureCount++;
            health.lastCheck = Date.now();
            
            // Mark as unhealthy after 3 failures
            if (health.failureCount >= 3) {
                health.healthy = false;
                console.warn(`Proxy ${key} marked as unhealthy after ${health.failureCount} failures`);
            }
        }
    }
    
    startHealthChecks() {
        // Check proxy health every 5 minutes
        setInterval(() => {
            this.checkProxyHealth();
        }, 300000);
    }
    
    async checkProxyHealth() {
        console.log('Checking proxy health...');
        
        const healthCheckPromises = this.proxyList.map(async (proxy) => {
            try {
                const testUrl = 'https://httpbin.org/ip';
                const response = await this.executeProxyRequest(testUrl, proxy, {
                    method: 'GET',
                    timeout: 10000
                });
                
                if (response.statusCode === 200) {
                    this.markProxyHealthy(proxy);
                } else {
                    this.markProxyUnhealthy(proxy);
                }
            } catch (error) {
                this.markProxyUnhealthy(proxy);
            }
        });
        
        await Promise.allSettled(healthCheckPromises);
        
        const healthyCount = Array.from(this.proxyHealth.values()).filter(h => h.healthy).length;
        console.log(`Health check complete: ${healthyCount}/${this.proxyList.length} proxies healthy`);
    }
    
    setupRateLimiting() {
        // Clean up rate limiting data every minute
        setInterval(() => {
            const now = Date.now();
            for (const [key, data] of this.rateLimiter.entries()) {
                if (now - data.lastRequest > 60000) { // 1 minute
                    this.rateLimiter.delete(key);
                }
            }
        }, 60000);
    }
    
    isRateLimited(identifier) {
        const now = Date.now();
        const limit = this.rateLimiter.get(identifier);
        
        if (!limit) {
            this.rateLimiter.set(identifier, {
                count: 1,
                lastRequest: now,
                resetTime: now + 60000 // 1 minute window
            });
            return false;
        }
        
        if (now > limit.resetTime) {
            // Reset window
            limit.count = 1;
            limit.lastRequest = now;
            limit.resetTime = now + 60000;
            return false;
        }
        
        if (limit.count >= 100) { // 100 requests per minute
            return true;
        }
        
        limit.count++;
        limit.lastRequest = now;
        return false;
    }
    
    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }
    
    generateRequestId() {
        return crypto.randomBytes(16).toString('hex');
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Public API for making secure requests
    async get(url, options = {}) {
        return this.makeRequest(url, {
            method: 'GET',
            ...options
        });
    }
    
    async post(url, data, options = {}) {
        return this.makeRequest(url, {
            method: 'POST',
            body: data,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
    }
    
    async put(url, data, options = {}) {
        return this.makeRequest(url, {
            method: 'PUT',
            body: data,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
    }
    
    async delete(url, options = {}) {
        return this.makeRequest(url, {
            method: 'DELETE',
            ...options
        });
    }
    
    // Get proxy statistics
    getStats() {
        const stats = {
            totalProxies: this.proxyList.length,
            healthyProxies: 0,
            unhealthyProxies: 0,
            rateLimitedRequests: this.rateLimiter.size
        };
        
        for (const health of this.proxyHealth.values()) {
            if (health.healthy) {
                stats.healthyProxies++;
            } else {
                stats.unhealthyProxies++;
            }
        }
        
        return stats;
    }
}

// Export for use in other modules
module.exports = ProxyService;

// If running as standalone module
if (require.main === module) {
    const proxy = new ProxyService();
    
    // Example usage
    async function testProxy() {
        try {
            const response = await proxy.get('https://httpbin.org/ip');
            console.log('Proxy test successful:', response.data);
        } catch (error) {
            console.error('Proxy test failed:', error.message);
        }
    }
    
    testProxy();
    
    // Log stats every 30 seconds
    setInterval(() => {
        console.log('Proxy Stats:', proxy.getStats());
    }, 30000);
}