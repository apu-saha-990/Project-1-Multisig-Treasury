const MultiSigMonitor = require('../monitoring/monitor');

async function main() {
  const monitor = new MultiSigMonitor();
  global.monitor = monitor;
  
  await monitor.start();
  
  // Keep process running
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
