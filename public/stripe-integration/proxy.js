/**
 * Proxy Support Module for Stripe Payment Gateway
 * Handles proxy configuration and request routing
 */

class ProxyManager {
    constructor() {
        this.proxyConfigs = new Map();
        this.proxyRotationIndex = 0;
        this.rateLimiter = new Map();
        this.maxRequestsPerMinute = 60;
        this.requestQueue = [];
        this.isProcessingQueue = false;
        
        this.init();
    }

    init() {
        this.setupProxyRotation();
        this.setupRateLimiting();
        this.startQueueProcessor();
    }

    /**
     * Add proxy configuration
     * @param {string} id - Proxy identifier
     * @param {Object} config - Proxy configuration
     */
    addProxyConfig(id, config) {
        const proxyConfig = {
            id,
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
            protocol: config.protocol || 'http',
            timeout: config.timeout || 30000,
            isActive: true,
            lastUsed: null,
            failCount: 0,
            maxFails: 3,
            ...config
        };

        this.proxyConfigs.set(id, proxyConfig);
        console.log(`Proxy added: ${id} - ${config.host}:${config.port}`);
    }

    /**
     * Get next available proxy using round-robin
     * @returns {Object|null} Proxy configuration or null if none available
     */
    getNextProxy() {
        const activeProxies = Array.from(this.proxyConfigs.values())
            .filter(proxy => proxy.isActive && proxy.failCount < proxy.maxFails);

        if (activeProxies.length === 0) {
            console.warn('No active proxies available');
            return null;
        }

        const proxy = activeProxies[this.proxyRotationIndex % activeProxies.length];
        this.proxyRotationIndex++;
        
        proxy.lastUsed = new Date();
        return proxy;
    }

    /**
     * Make HTTP request through proxy
     * @param {string} url - Target URL
     * @param {Object} options - Request options
     * @param {Object} proxyConfig - Proxy configuration
     * @returns {Promise} Request promise
     */
    async makeProxyRequest(url, options = {}, proxyConfig = null) {
        if (!proxyConfig) {
            proxyConfig = this.getNextProxy();
        }

        if (!proxyConfig) {
            throw new Error('No proxy available for request');
        }

        // Check rate limits
        await this.checkRateLimit(proxyConfig.id);

        const requestConfig = {
            method: options.method || 'GET',
            headers: {
                'User-Agent': this.getRandomUserAgent(),
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options.headers
            },
            body: options.body || null,
            timeout: proxyConfig.timeout
        };

        try {
            const response = await this.executeProxyRequest(url, requestConfig, proxyConfig);
            
            // Reset fail count on successful request
            proxyConfig.failCount = 0;
            
            return response;
        } catch (error) {
            console.error(`Proxy request failed for ${proxyConfig.id}:`, error.message);
            
            // Increment fail count
            proxyConfig.failCount++;
            
            // Disable proxy if too many failures
            if (proxyConfig.failCount >= proxyConfig.maxFails) {
                proxyConfig.isActive = false;
                console.warn(`Proxy ${proxyConfig.id} disabled due to ${proxyConfig.failCount} failures`);
            }
            
            throw error;
        }
    }

    /**
     * Execute proxy request (to be implemented with actual proxy library)
     * @param {string} url - Target URL
     * @param {Object} requestConfig - Request configuration
     * @param {Object} proxyConfig - Proxy configuration
     * @returns {Promise} Request promise
     */
    async executeProxyRequest(url, requestConfig, proxyConfig) {
        // In a real implementation, this would use a proxy library like:
        // - HttpsProxyAgent for Node.js
        // - Browser proxy extensions
        // - SOCKS proxy libraries
        
        // For demonstration, we'll simulate a proxy request
        console.log(`Making request through proxy: ${proxyConfig.host}:${proxyConfig.port}`);
        
        // Simulate proxy request delay
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        // Use fetch with proxy headers for demo
        const proxyHeaders = {
            ...requestConfig.headers,
            'X-Proxy-Host': proxyConfig.host,
            'X-Proxy-Port': proxyConfig.port.toString(),
            'X-Proxy-Auth': proxyConfig.username ? 
                btoa(`${proxyConfig.username}:${proxyConfig.password}`) : null
        };

        return fetch(url, {
            ...requestConfig,
            headers: proxyHeaders
        });
    }

    /**
     * Check rate limits for proxy
     * @param {string} proxyId - Proxy identifier
     * @returns {Promise} Rate limit check promise
     */
    async checkRateLimit(proxyId) {
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute
        
        if (!this.rateLimiter.has(proxyId)) {
            this.rateLimiter.set(proxyId, []);
        }
        
        const requests = this.rateLimiter.get(proxyId);
        
        // Remove old requests outside the window
        while (requests.length > 0 && requests[0] < now - windowMs) {
            requests.shift();
        }
        
        // Check if we're at the limit
        if (requests.length >= this.maxRequestsPerMinute) {
            const oldestRequest = requests[0];
            const waitTime = windowMs - (now - oldestRequest);
            
            console.log(`Rate limit reached for proxy ${proxyId}, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        // Add current request
        requests.push(now);
    }

    /**
     * Queue request for processing
     * @param {Object} request - Request object
     * @returns {Promise} Request promise
     */
    queueRequest(request) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                ...request,
                resolve,
                reject,
                timestamp: Date.now()
            });
        });
    }

    /**
     * Start queue processor
     */
    startQueueProcessor() {
        if (this.isProcessingQueue) return;
        
        this.isProcessingQueue = true;
        
        const processQueue = async () => {
            while (this.requestQueue.length > 0) {
                const request = this.requestQueue.shift();
                
                try {
                    const response = await this.makeProxyRequest(
                        request.url,
                        request.options,
                        request.proxyConfig
                    );
                    
                    request.resolve(response);
                } catch (error) {
                    request.reject(error);
                }
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Continue processing after a short delay
            setTimeout(processQueue, 1000);
        };
        
        processQueue();
    }

    /**
     * Setup proxy rotation
     */
    setupProxyRotation() {
        // Add some default proxy configurations (for demonstration)
        // In production, these would be loaded from configuration
        const defaultProxies = [
            {
                id: 'proxy1',
                host: 'proxy1.example.com',
                port: 8080,
                username: '',
                password: ''
            },
            {
                id: 'proxy2',
                host: 'proxy2.example.com',
                port: 3128,
                username: '',
                password: ''
            }
        ];
        
        // Only add if not already configured
        defaultProxies.forEach(proxy => {
            if (!this.proxyConfigs.has(proxy.id)) {
                this.addProxyConfig(proxy.id, proxy);
            }
        });
    }

    /**
     * Setup rate limiting
     */
    setupRateLimiting() {
        // Clean up old rate limit data periodically
        setInterval(() => {
            const now = Date.now();
            const windowMs = 60 * 1000;
            
            for (const [proxyId, requests] of this.rateLimiter) {
                while (requests.length > 0 && requests[0] < now - windowMs) {
                    requests.shift();
                }
                
                if (requests.length === 0) {
                    this.rateLimiter.delete(proxyId);
                }
            }
        }, 60000); // Clean up every minute
    }

    /**
     * Get random user agent
     * @returns {string} Random user agent string
     */
    getRandomUserAgent() {
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0',
            'Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0'
        ];
        
        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }

    /**
     * Get proxy statistics
     * @returns {Object} Proxy statistics
     */
    getProxyStats() {
        const stats = {
            total: this.proxyConfigs.size,
            active: 0,
            inactive: 0,
            proxies: []
        };
        
        for (const [id, config] of this.proxyConfigs) {
            if (config.isActive) {
                stats.active++;
            } else {
                stats.inactive++;
            }
            
            stats.proxies.push({
                id,
                host: config.host,
                port: config.port,
                isActive: config.isActive,
                failCount: config.failCount,
                lastUsed: config.lastUsed
            });
        }
        
        return stats;
    }

    /**
     * Test proxy connection
     * @param {string} proxyId - Proxy identifier
     * @returns {Promise<boolean>} Test result
     */
    async testProxy(proxyId) {
        const proxy = this.proxyConfigs.get(proxyId);
        if (!proxy) {
            throw new Error(`Proxy ${proxyId} not found`);
        }
        
        try {
            const testUrl = 'https://httpbin.org/ip';
            const response = await this.makeProxyRequest(testUrl, {
                method: 'GET',
                timeout: 10000
            }, proxy);
            
            if (response.ok) {
                proxy.isActive = true;
                proxy.failCount = 0;
                console.log(`Proxy ${proxyId} test successful`);
                return true;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error(`Proxy ${proxyId} test failed:`, error.message);
            proxy.failCount++;
            return false;
        }
    }

    /**
     * Remove proxy configuration
     * @param {string} proxyId - Proxy identifier
     */
    removeProxy(proxyId) {
        if (this.proxyConfigs.has(proxyId)) {
            this.proxyConfigs.delete(proxyId);
            console.log(`Proxy ${proxyId} removed`);
        }
    }

    /**
     * Enable/disable proxy
     * @param {string} proxyId - Proxy identifier
     * @param {boolean} isActive - Active state
     */
    setProxyActive(proxyId, isActive) {
        const proxy = this.proxyConfigs.get(proxyId);
        if (proxy) {
            proxy.isActive = isActive;
            if (isActive) {
                proxy.failCount = 0;
            }
            console.log(`Proxy ${proxyId} ${isActive ? 'enabled' : 'disabled'}`);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProxyManager;
} else {
    window.ProxyManager = ProxyManager;
}