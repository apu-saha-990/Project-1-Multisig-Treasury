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
  startServer(port = 9090) {
    const http = require('http');
    
    this.server = http.createServer((req, res) => {
      if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
        res.end(this.getPrometheusMetrics());
      } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: this.getMetrics().uptimeFormatted }));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    this.server.listen(port, () => {
      this.logger.info(`Prometheus metrics available at http://localhost:${port}/metrics`);
    });
  }

  stopServer() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = MetricsCollector;
