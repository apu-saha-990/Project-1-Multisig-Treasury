const fs = require('fs');
const path = require('path');

class Logger {
  constructor(logDir = './logs') {
    this.logDir = logDir;
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    this.logFile = path.join(logDir, `monitor-${this.getDateString()}.log`);
  }
  
  getDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  
  getTimestamp() {
    return new Date().toISOString();
  }
  
  formatMessage(level, message, data = null) {
    const timestamp = this.getTimestamp();
    let logEntry = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      logEntry += ` ${JSON.stringify(data)}`;
    }
    
    return logEntry;
  }
  
  writeToFile(message) {
    fs.appendFileSync(this.logFile, message + '\n');
  }
  
  info(message, data = null) {
    const formatted = this.formatMessage('INFO', message, data);
    console.log('\x1b[36m%s\x1b[0m', formatted); // Cyan
    this.writeToFile(formatted);
  }
  
  warn(message, data = null) {
    const formatted = this.formatMessage('WARN', message, data);
    console.log('\x1b[33m%s\x1b[0m', formatted); // Yellow
    this.writeToFile(formatted);
  }
  
  error(message, data = null) {
    const formatted = this.formatMessage('ERROR', message, data);
    console.log('\x1b[31m%s\x1b[0m', formatted); // Red
    this.writeToFile(formatted);
  }
  
  success(message, data = null) {
    const formatted = this.formatMessage('SUCCESS', message, data);
    console.log('\x1b[32m%s\x1b[0m', formatted); // Green
    this.writeToFile(formatted);
  }
  
  critical(message, data = null) {
    const formatted = this.formatMessage('CRITICAL', message, data);
    console.log('\x1b[41m\x1b[37m%s\x1b[0m', formatted); // Red background, white text
    this.writeToFile(formatted);
  }
}

module.exports = Logger;
