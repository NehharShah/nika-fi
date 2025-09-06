#!/usr/bin/env node

/**
 * Nika Referral System Monitoring Script
 * 
 * Simple monitoring dashboard that checks system health,
 * performance metrics, and business KPIs.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class NikaMonitor {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      apiKey: config.apiKey || process.env.WEBHOOK_API_KEY || 'nika-webhook-secret-key',
      checkInterval: config.checkInterval || 30000, // 30 seconds
      alertThresholds: {
        responseTime: 1000, // 1 second
        errorRate: 0.05, // 5%
        cpuUsage: 0.8, // 80%
        memoryUsage: 0.8, // 80%
        dbConnections: 100,
      },
      ...config,
    };
    
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTimes: [],
      uptime: Date.now(),
      alerts: [],
    };
  }

  async start() {
    console.log('🔍 Starting Nika Referral System Monitor...');
    console.log(`Base URL: ${this.config.baseUrl}`);
    console.log(`Check Interval: ${this.config.checkInterval / 1000}s`);
    console.log('─'.repeat(60));

    // Initial system check
    await this.performHealthCheck();
    
    // Start monitoring loop
    setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);

    // Performance dashboard update
    setInterval(() => {
      this.displayDashboard();
    }, 10000); // Every 10 seconds

    // Generate reports
    setInterval(() => {
      this.generateReport();
    }, 300000); // Every 5 minutes
  }

  async performHealthCheck() {
    const startTime = Date.now();
    
    try {
      // Health endpoint check
      const response = await axios.get(`${this.config.baseUrl}/health`, {
        timeout: 5000,
      });
      
      const responseTime = Date.now() - startTime;
      this.metrics.requests++;
      this.metrics.responseTimes.push(responseTime);
      
      // Keep only last 100 response times
      if (this.metrics.responseTimes.length > 100) {
        this.metrics.responseTimes.shift();
      }

      const healthData = response.data;
      
      // Check response time threshold
      if (responseTime > this.config.alertThresholds.responseTime) {
        this.createAlert('HIGH_RESPONSE_TIME', `Response time: ${responseTime}ms`);
      }

      // Check API endpoints
      await this.checkApiEndpoints();
      
      // Check business metrics
      await this.checkBusinessMetrics();

      console.log(`✅ Health check passed (${responseTime}ms)`);
      
    } catch (error) {
      this.metrics.errors++;
      this.createAlert('HEALTH_CHECK_FAILED', error.message);
      console.log(`❌ Health check failed: ${error.message}`);
    }
  }

  async checkApiEndpoints() {
    const endpoints = [
      { path: '/api/docs', method: 'GET', expected: 200 },
      { path: '/api/referral/validate-code/NIKATEST', method: 'GET', expected: 200 },
    ];

    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now();
        const response = await axios({
          method: endpoint.method,
          url: `${this.config.baseUrl}${endpoint.path}`,
          timeout: 3000,
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.status !== endpoint.expected) {
          this.createAlert('ENDPOINT_ERROR', `${endpoint.path} returned ${response.status}`);
        }
        
      } catch (error) {
        this.createAlert('ENDPOINT_FAILED', `${endpoint.path}: ${error.message}`);
      }
    }
  }

  async checkBusinessMetrics() {
    try {
      // This would typically require admin authentication
      // For demo purposes, we'll simulate business metrics
      
      const metrics = {
        totalUsers: Math.floor(Math.random() * 1000) + 500,
        activeReferrers: Math.floor(Math.random() * 100) + 50,
        totalCommissions: (Math.random() * 50000) + 10000,
        dailyTrades: Math.floor(Math.random() * 500) + 100,
      };

      // Check for anomalies
      if (metrics.dailyTrades < 50) {
        this.createAlert('LOW_TRADE_VOLUME', `Only ${metrics.dailyTrades} trades today`);
      }

      if (metrics.activeReferrers < 10) {
        this.createAlert('LOW_REFERRER_ACTIVITY', `Only ${metrics.activeReferrers} active referrers`);
      }

      this.metrics.businessMetrics = metrics;
      
    } catch (error) {
      this.createAlert('BUSINESS_METRICS_FAILED', error.message);
    }
  }

  createAlert(type, message) {
    const alert = {
      type,
      message,
      timestamp: new Date().toISOString(),
      id: Math.random().toString(36).substr(2, 9),
    };

    this.metrics.alerts.unshift(alert);
    
    // Keep only last 50 alerts
    if (this.metrics.alerts.length > 50) {
      this.metrics.alerts.pop();
    }

    console.log(`🚨 ALERT [${type}]: ${message}`);
    
    // In production, send to alerting system (PagerDuty, Slack, etc.)
    this.sendAlert(alert);
  }

  async sendAlert(alert) {
    // Example: Send to Slack webhook
    try {
      if (process.env.SLACK_WEBHOOK_URL) {
        await axios.post(process.env.SLACK_WEBHOOK_URL, {
          text: `🚨 Nika Referral System Alert`,
          attachments: [{
            color: 'danger',
            fields: [{
              title: alert.type,
              value: alert.message,
              short: false,
            }],
            ts: Math.floor(Date.now() / 1000),
          }],
        });
      }
    } catch (error) {
      console.error('Failed to send alert to Slack:', error.message);
    }
  }

  displayDashboard() {
    console.clear();
    
    const uptime = Date.now() - this.metrics.uptime;
    const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    
    const avgResponseTime = this.metrics.responseTimes.length > 0
      ? Math.round(this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length)
      : 0;
    
    const errorRate = this.metrics.requests > 0
      ? (this.metrics.errors / this.metrics.requests * 100).toFixed(2)
      : 0;

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  🚀 NIKA REFERRAL MONITOR                   ║
╠══════════════════════════════════════════════════════════════╣
║ System Status: ${this.getSystemStatus()}                                        ║
║ Uptime: ${uptimeHours}h ${uptimeMinutes}m                                           ║
║ Base URL: ${this.config.baseUrl.padEnd(45)} ║
╠══════════════════════════════════════════════════════════════╣
║                       📊 METRICS                            ║
╠══════════════════════════════════════════════════════════════╣
║ Total Requests: ${this.metrics.requests.toString().padEnd(43)} ║
║ Total Errors: ${this.metrics.errors.toString().padEnd(45)} ║
║ Error Rate: ${(errorRate + '%').padEnd(47)} ║
║ Avg Response Time: ${(avgResponseTime + 'ms').padEnd(40)} ║
╠══════════════════════════════════════════════════════════════╣
║                    💼 BUSINESS METRICS                      ║
╠══════════════════════════════════════════════════════════════╣`);

    if (this.metrics.businessMetrics) {
      const bm = this.metrics.businessMetrics;
      console.log(`║ Total Users: ${bm.totalUsers.toString().padEnd(46)} ║
║ Active Referrers: ${bm.activeReferrers.toString().padEnd(43)} ║
║ Total Commissions: $${bm.totalCommissions.toFixed(2).padEnd(39)} ║
║ Daily Trades: ${bm.dailyTrades.toString().padEnd(45)} ║`);
    }

    console.log(`╠══════════════════════════════════════════════════════════════╣
║                      🚨 RECENT ALERTS                       ║
╠══════════════════════════════════════════════════════════════╣`);

    if (this.metrics.alerts.length === 0) {
      console.log('║ No alerts - All systems operational! ✅                    ║');
    } else {
      this.metrics.alerts.slice(0, 5).forEach(alert => {
        const time = new Date(alert.timestamp).toLocaleTimeString();
        const message = `${time} [${alert.type}]: ${alert.message}`;
        const truncated = message.length > 58 ? message.substr(0, 55) + '...' : message;
        console.log(`║ ${truncated.padEnd(60)} ║`);
      });
    }

    console.log(`╚══════════════════════════════════════════════════════════════╝`);
    console.log(`Last updated: ${new Date().toLocaleString()}`);
  }

  getSystemStatus() {
    const errorRate = this.metrics.requests > 0
      ? this.metrics.errors / this.metrics.requests
      : 0;
    
    const avgResponseTime = this.metrics.responseTimes.length > 0
      ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
      : 0;

    const recentAlerts = this.metrics.alerts.filter(
      alert => Date.now() - new Date(alert.timestamp).getTime() < 300000 // Last 5 minutes
    );

    if (recentAlerts.length > 5) return '🔴 CRITICAL';
    if (errorRate > this.config.alertThresholds.errorRate) return '🟡 WARNING';
    if (avgResponseTime > this.config.alertThresholds.responseTime) return '🟡 WARNING';
    if (recentAlerts.length > 0) return '🟡 WARNING';
    
    return '🟢 HEALTHY';
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.metrics.uptime,
      metrics: {
        totalRequests: this.metrics.requests,
        totalErrors: this.metrics.errors,
        errorRate: this.metrics.requests > 0 ? this.metrics.errors / this.metrics.requests : 0,
        averageResponseTime: this.metrics.responseTimes.length > 0
          ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
          : 0,
        recentAlerts: this.metrics.alerts.slice(0, 10),
      },
      businessMetrics: this.metrics.businessMetrics,
      systemStatus: this.getSystemStatus(),
    };

    // Save report to file
    const reportsDir = path.join(__dirname, '../logs/reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filename = `report_${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(reportsDir, filename);
    
    try {
      let existingReports = [];
      if (fs.existsSync(filepath)) {
        existingReports = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      }
      
      existingReports.push(report);
      fs.writeFileSync(filepath, JSON.stringify(existingReports, null, 2));
      
      console.log(`📄 Report saved: ${filename}`);
    } catch (error) {
      console.error('Failed to save report:', error.message);
    }
  }
}

// CLI interface
if (require.main === module) {
  const config = {
    baseUrl: process.argv[2] || 'http://localhost:3000',
    checkInterval: parseInt(process.argv[3]) || 30000,
  };

  const monitor = new NikaMonitor(config);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down monitor...');
    process.exit(0);
  });

  monitor.start().catch(error => {
    console.error('Monitor failed to start:', error);
    process.exit(1);
  });
}

module.exports = NikaMonitor;
