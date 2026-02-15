const fs = require('fs');
const path = require('path');

class MetricsCollector {
  constructor(logger) {
    this.logger = logger;
    this.metrics = {
      transactionCount: 0,
      confirmationCount: 0,
      executionCount: 0,
      ownerChanges: 0,
      totalValue: 0,
      startTime: Date.now(),
      events: {}
    };
    
    this.metricsFile = path.join('./logs', 'metrics.json');
  }
  
  recordEvent(eventName, data = {}) {
    // Increment event counter
    if (!this.metrics.events[eventName]) {
      this.metrics.events[eventName] = 0;
    }
    this.metrics.events[eventName]++;
    
    // Update specific metrics based on event type
    switch(eventName) {
      case 'SubmitTransaction':
        this.metrics.transactionCount++;
        if (data.value) {
          this.metrics.totalValue += parseFloat(data.value);
        }
        break;
      case 'ConfirmTransaction':
        this.metrics.confirmationCount++;
        break;
      case 'ExecuteTransaction':
        this.metrics.executionCount++;
        break;
      case 'OwnerAdded':
      case 'OwnerRemoved':
      case 'RequirementChanged':
        this.metrics.ownerChanges++;
        break;
    }
    
    this.logger.info(`Metric recorded: ${eventName}`, { count: this.metrics.events[eventName] });
  }
  
  getMetrics() {
    const uptime = Math.floor((Date.now() - this.metrics.startTime) / 1000);
    
    return {
      ...this.metrics,
      uptime: uptime,
      uptimeFormatted: this.formatUptime(uptime),
      timestamp: new Date().toISOString()
    };
  }
  
  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours}h ${minutes}m ${secs}s`;
  }
  
  exportMetrics() {
    const metrics = this.getMetrics();
    
    // Write to file
    fs.writeFileSync(this.metricsFile, JSON.stringify(metrics, null, 2));
    
    this.logger.info('Metrics exported', { 
      transactions: metrics.transactionCount,
      executions: metrics.executionCount,
      uptime: metrics.uptimeFormatted
    });
    
    return metrics;
  }
  
  // Prometheus-compatible format
  getPrometheusMetrics() {
    const metrics = this.getMetrics();
    
    let output = '';
    output += `# HELP multisig_transactions_total Total number of transactions submitted\n`;
    output += `# TYPE multisig_transactions_total counter\n`;
    output += `multisig_transactions_total ${metrics.transactionCount}\n\n`;
    
    output += `# HELP multisig_confirmations_total Total number of confirmations\n`;
    output += `# TYPE multisig_confirmations_total counter\n`;
    output += `multisig_confirmations_total ${metrics.confirmationCount}\n\n`;
    
    output += `# HELP multisig_executions_total Total number of executions\n`;
    output += `# TYPE multisig_executions_total counter\n`;
    output += `multisig_executions_total ${metrics.executionCount}\n\n`;
    
    output += `# HELP multisig_uptime_seconds Monitor uptime in seconds\n`;
    output += `# TYPE multisig_uptime_seconds gauge\n`;
    output += `multisig_uptime_seconds ${metrics.uptime}\n\n`;
    
    return output;
  }
}

module.exports = MetricsCollector;
