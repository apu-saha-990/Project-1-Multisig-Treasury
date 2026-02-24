require('dotenv').config();
const hre = require("hardhat");
const Logger = require('./logger');
const MetricsCollector = require('./metrics');
const AlertSystem = require('./alerts');
const HealthMonitor = require('./health');
const config = require('../config/monitor.config.json');

class MultiSigMonitor {
  constructor() {
    this.logger = new Logger('./logs');
    this.metrics = new MetricsCollector(this.logger);
    this.alerts = new AlertSystem(this.logger, config);
    
    this.running = false;
    this.reconnectAttempts = 0;
  }
  
  async initialize() {
    this.logger.info('🚀 Initializing MultiSig Monitor...');
    
    try {
      // Get contract instance
      const artifactPath = require('path').join(__dirname, '../artifacts/contracts/MultiSigWallet.sol/MultiSigWallet.json');
      const artifact = require(artifactPath);
      // Create Sepolia provider first
this.provider = new hre.ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || config.rpc.url);

// Create contract connected to Sepolia provider
this.contract = new hre.ethers.Contract(config.contract.address, artifact.abi, this.provider);
      
            
      // Initialize health monitor
      this.health = new HealthMonitor(this.logger, this.provider, this.contract);
      
      // Initial health check
      await this.health.performHealthCheck();
      
      this.logger.success('✅ Monitor initialized successfully');
      this.logger.info('📋 Monitoring contract:', { address: config.contract.address });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize monitor', { error: error.message });
      return false;
    }
  }
  
  setupEventListeners() {
    this.logger.info('👂 Setting up event listeners...');
    
    // Listen for Deposit events
    this.contract.on("Deposit", (sender, amount, balance, event) => {
      const data = {
        sender,
        amount: hre.ethers.formatEther(amount),
        balance: hre.ethers.formatEther(balance),
        txHash: event.log.transactionHash
      };
      
      this.logger.info('💰 Deposit received', data);
      this.metrics.recordEvent('Deposit', data);
    });
    
    // Listen for SubmitTransaction events
    this.contract.on("SubmitTransaction", (owner, txIndex, to, value, data, event) => {
      const txData = {
        owner,
        txIndex: txIndex.toString(),
        to,
        value: hre.ethers.formatEther(value),
        txHash: event.log.transactionHash
      };
      
      this.logger.warn('📝 Transaction submitted', txData);
      this.metrics.recordEvent('SubmitTransaction', txData);
      
      // Check alerts
      const alerts = this.alerts.evaluateTransaction(txData);
      alerts.push(...this.alerts.evaluateEvent('SubmitTransaction', txData));
      this.alerts.processAlerts(alerts);
    });
    
    // Listen for ConfirmTransaction events
    this.contract.on("ConfirmTransaction", (owner, txIndex, event) => {
      const data = {
        owner,
        txIndex: txIndex.toString(),
        txHash: event.log.transactionHash
      };
      
      this.logger.info('✅ Transaction confirmed', data);
      this.metrics.recordEvent('ConfirmTransaction', data);
    });
    
    // Listen for ExecuteTransaction events
    this.contract.on("ExecuteTransaction", (owner, txIndex, event) => {
      const data = {
        owner,
        txIndex: txIndex.toString(),
        txHash: event.log.transactionHash
      };
      
      this.logger.success('🚀 Transaction executed', data);
      this.metrics.recordEvent('ExecuteTransaction', data);
    });
    
    // Listen for RevokeConfirmation events
    this.contract.on("RevokeConfirmation", (owner, txIndex, event) => {
      const data = {
        owner,
        txIndex: txIndex.toString(),
        txHash: event.log.transactionHash
      };
      
      this.logger.warn('❌ Confirmation revoked', data);
      this.metrics.recordEvent('RevokeConfirmation', data);
    });
    
    // Listen for OwnerAdded events
    this.contract.on("OwnerAdded", (owner, event) => {
      const data = {
        owner,
        txHash: event.log.transactionHash
      };
      
      this.logger.critical('🆕 Owner added', data);
      this.metrics.recordEvent('OwnerAdded', data);
      
      const alerts = this.alerts.evaluateEvent('OwnerAdded', data);
      this.alerts.processAlerts(alerts);
    });
    
    // Listen for OwnerRemoved events
    this.contract.on("OwnerRemoved", (owner, event) => {
      const data = {
        owner,
        txHash: event.log.transactionHash
      };
      
      this.logger.critical('🗑️  Owner removed', data);
      this.metrics.recordEvent('OwnerRemoved', data);
      
      const alerts = this.alerts.evaluateEvent('OwnerRemoved', data);
      this.alerts.processAlerts(alerts);
    });
    
    // Listen for RequirementChanged events
    this.contract.on("RequirementChanged", (requirement, event) => {
      const data = {
        newRequirement: requirement.toString(),
        txHash: event.log.transactionHash
      };
      
      this.logger.critical('🔄 Requirement changed', data);
      this.metrics.recordEvent('RequirementChanged', data);
      
      const alerts = this.alerts.evaluateEvent('RequirementChanged', data);
      this.alerts.processAlerts(alerts);
    });
    
    this.logger.success('✅ Event listeners active');
  }
  
  startHealthChecks() {
    this.logger.info('💓 Starting health check routine...');
    
    this.healthCheckInterval = setInterval(async () => {
      await this.health.performHealthCheck();
      
      // Check if reconnect needed
      if (this.health.needsReconnect()) {
        this.logger.error('⚠️  Multiple health check failures - attempting reconnect...');
        await this.reconnect();
      }
    }, config.monitoring.checkInterval);
  }
  
  startMetricsExport() {
    if (!config.metrics.enabled) return;
    
    this.logger.info('📊 Starting metrics export...');
    
    this.metricsInterval = setInterval(() => {
      this.metrics.exportMetrics();
    }, config.metrics.exportInterval);
  }
  
  async reconnect() {
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > config.monitoring.reconnectAttempts) {
      this.logger.critical('❌ Max reconnect attempts reached - stopping monitor');
      this.stop();
      return;
    }
    
    this.logger.warn(`Reconnect attempt ${this.reconnectAttempts}/${config.monitoring.reconnectAttempts}`);
    
    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, config.monitoring.reconnectDelay));
    
    // Try to reinitialize
    const success = await this.initialize();
    
    if (success) {
      this.reconnectAttempts = 0;
      this.logger.success('✅ Reconnected successfully');
    }
  }
  
  async start() {
    this.logger.info('');
    this.logger.info('═══════════════════════════════════════════════════════════');
    this.logger.info('       MultiSig Infrastructure Monitoring System          ');
    this.logger.info('═══════════════════════════════════════════════════════════');
    this.logger.info('');
    
    const initialized = await this.initialize();
    
    if (!initialized) {
      this.logger.error('Failed to start monitor');
      return;
    }
    
    this.setupEventListeners();
    this.startHealthChecks();
    this.startMetricsExport();
    this.metrics.startServer(9090);
    
    this.running = true;
    
    this.logger.success('');
    this.logger.success('🚀 Monitor is now running...');
    this.logger.success('   Press Ctrl+C to stop');
    this.logger.success('');
  }
  
  stop() {
    this.logger.info('Stopping monitor...');
    
    // Remove all listeners
    this.contract.removeAllListeners();
    
    // Clear intervals
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    
    // Final metrics export
    this.metrics.exportMetrics();
    
    this.running = false;
    this.logger.success('✅ Monitor stopped gracefully');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT - shutting down gracefully...');
  if (global.monitor) {
    global.monitor.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\nReceived SIGTERM - shutting down gracefully...');
  if (global.monitor) {
    global.monitor.stop();
  }
  process.exit(0);
});

module.exports = MultiSigMonitor;
