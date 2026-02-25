const { ethers } = require('ethers');

class AlertSystem {
  constructor(logger, config) {
    this.logger = logger;
    this.config = config;
    this.alertHistory = [];
  }
  
  evaluateTransaction(txData) {
    const alerts = [];
    
    // Check for large transactions
    const valueInEth = txData.value || "0";  // Already formatted by monitor
    const threshold = parseFloat(this.config.alerts.largeTransactionThreshold);
    
    if (parseFloat(valueInEth) > threshold) {
      alerts.push({
        level: 'CRITICAL',
        type: 'LARGE_TRANSACTION',
        message: `Large transaction detected: ${valueInEth} ETH`,
        data: txData
      });
    }
    
    return alerts;
  }
  
  evaluateEvent(eventName, eventData) {  
    const alerts = [];
    
    // Critical events
    if (this.config.alerts.criticalEvents.includes(eventName)) {
      alerts.push({
        level: 'CRITICAL',
        type: 'GOVERNANCE_CHANGE',
        message: `Critical governance event: ${eventName}`,
        data: eventData
      });
    }
    
    // Warning events
    if (this.config.alerts.warningEvents.includes(eventName)) {
      alerts.push({
        level: 'WARNING',
        type: 'TRANSACTION_SUBMITTED',
        message: `New transaction submitted`,
        data: eventData
      });
    }
    return alerts;
  }
  
  async sendAlert(alert) {
    // Log the alert
    switch(alert.level) {
      case 'CRITICAL':
        this.logger.critical(`🚨 ${alert.message}`, alert.data);
        break;
      case 'WARNING':
        this.logger.warn(`⚠️ ${alert.message}`, alert.data);
        break;
      case 'INFO':
        this.logger.info(`ℹ️ ${alert.message}`, alert.data);
        break;
    }
    
    // Send to Discord if enabled
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL || this.config.alerts.discord?.webhookUrl;
if (this.config.alerts.discord?.enabled && webhookUrl) {
      try {
        const embed = {
          title: `🚨 ${alert.type} Alert`,
          description: alert.message,
          color: this.getAlertColor(alert.level),
          fields: Object.entries(alert.data).map(([key, value]) => ({
            name: key,
            value: String(value),
            inline: true
          })),
          timestamp: new Date().toISOString()
        };
        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] })
        });
        
        if (response.ok) {
          this.logger.success('Alert sent to Discord');
        } else {
          this.logger.error('Discord webhook failed', { status: response.status });
        }
      } catch (error) {
        this.logger.error('Failed to send Discord alert', { error: error.message });
      }
    }
    
    // Store in history
    this.alertHistory.push({
      timestamp: new Date().toISOString(),
      ...alert
    });
    
    // Keep only last 100 alerts in memory
    if (this.alertHistory.length > 100) {
      this.alertHistory = this.alertHistory.slice(-100);
    }
  }
  
  getAlertColor(severity) {
    const colors = {
      'CRITICAL': 15158332, // Red
      'WARNING': 16776960,  // Yellow
      'INFO': 3447003      // Blue
    };
    return colors[severity] || colors.INFO;
  }
  
  processAlerts(alerts) {
    alerts.forEach(alert => this.sendAlert(alert));
  }
  
  getRecentAlerts(count = 10) {
    return this.alertHistory.slice(-count);
  }
  
  getCriticalAlerts() {
    return this.alertHistory.filter(alert => alert.level === 'CRITICAL');
  }
}

module.exports = AlertSystem;
