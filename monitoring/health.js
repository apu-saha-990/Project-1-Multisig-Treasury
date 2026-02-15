const { ethers } = require('ethers');

class HealthMonitor {
  constructor(logger, provider, contract) {
    this.logger = logger;
    this.provider = provider;
    this.contract = contract;
    
    this.health = {
      rpcConnected: false,
      contractResponsive: false,
      lastCheck: null,
      consecutiveFailures: 0,
      balance: '0'
    };
  }
  
  async checkRPCHealth() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      this.health.rpcConnected = true;
      this.health.lastBlock = blockNumber;
      this.health.consecutiveFailures = 0;
      return true;
    } catch (error) {
      this.health.rpcConnected = false;
      this.health.consecutiveFailures++;
      this.logger.error('RPC health check failed', { error: error.message });
      return false;
    }
  }
  
  async checkContractHealth() {
    try {
      // Try to read owner count
      const owners = await this.contract.getOwners();
      const txCount = await this.contract.getTransactionCount();
      const balance = await this.provider.getBalance(await this.contract.getAddress());
      
      this.health.contractResponsive = true;
      this.health.ownerCount = owners.length;
      this.health.transactionCount = txCount.toString();
      this.health.balance = ethers.formatEther(balance);
      this.health.consecutiveFailures = 0;
      
      return true;
    } catch (error) {
      this.health.contractResponsive = false;
      this.health.consecutiveFailures++;
      this.logger.error('Contract health check failed', { error: error.message });
      return false;
    }
  }
  
  async performHealthCheck() {
    this.logger.info('Performing health check...');
    
    const rpcHealthy = await this.checkRPCHealth();
    const contractHealthy = await this.checkContractHealth();
    
    this.health.lastCheck = new Date().toISOString();
    this.health.overall = rpcHealthy && contractHealthy ? 'HEALTHY' : 'DEGRADED';
    
    if (!rpcHealthy || !contractHealthy) {
      this.logger.warn('System health degraded', {
        rpc: rpcHealthy,
        contract: contractHealthy,
        failures: this.health.consecutiveFailures
      });
    } else {
      this.logger.success('Health check passed', {
        owners: this.health.ownerCount,
        transactions: this.health.transactionCount,
        balance: this.health.balance
      });
    }
    
    return this.health;
  }
  
  getHealth() {
    return this.health;
  }
  
  isHealthy() {
    return this.health.overall === 'HEALTHY';
  }
  
  needsReconnect() {
    return this.health.consecutiveFailures >= 3;
  }
}

module.exports = HealthMonitor;
