import { useState } from "react";
import { ethers } from "ethers";
const CONTRACT_ADDRESS = "0xdc8d6F7aF51120af2D6c5de861dfdC187eFE70a2";

const ABI = [
  "function getOwners() view returns (address[])",
  "function required() view returns (uint)",
  "function getTransactionCount() view returns (uint)",
  "function getTransaction(uint txIndex) view returns (address to, uint value, bytes data, bool executed, uint numConfirmations)",
  "function isConfirmed(uint txIndex, address owner) view returns (bool)",
  "function submitTransaction(address to, uint value, bytes data)",
  "function confirmTransaction(uint txIndex)",
  "function executeTransaction(uint txIndex)",
  "function revokeConfirmation(uint txIndex)"
];
export default function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [owners, setOwners] = useState([]);
  const [required, setRequired] = useState(0);
  const [balance, setBalance] = useState("0");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
async function connectWallet() {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
      }
      const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
      await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
if (network.chainId !== 11155111) {
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xaa36a7" }],
  });
}
const signer = provider.getSigner();
      const address = await signer.getAddress();
      const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setAccount(address);
      setContract(c);
      loadData(c, address, provider);
    } catch (e) {
      console.error("Connection error:", e);
      alert("Connection failed: " + e.message);
    }
  }
async function loadData(c, acc, provider) {
    try {
      const ownersData = await c.getOwners();
      const ownerCheck = ownersData.map(o => o.toLowerCase()).includes(acc.toLowerCase());
      console.log("Owners:", ownersData);
      console.log("Is owner:", ownerCheck);
      setOwners(ownersData);
      setIsOwner(ownerCheck);
    } catch (e) {
      console.error("loadData error:", e.message);
    }

    try {
      const req = await c.required();
      setRequired(req.toString());
    } catch (e) {
      console.error("required error:", e.message);
    }

    try {
      const bal = await provider.getBalance(CONTRACT_ADDRESS);
      setBalance(ethers.utils.formatEther(bal));
    } catch (e) {
      console.error("balance error:", e.message);
    }

    try {
      const txCount = await c.getTransactionCount();
      const txs = [];
      for (let i = 0; i < txCount; i++) {
        const tx = await c.getTransaction(i);
        txs.push({ index: i, to: tx.to, value: ethers.utils.formatEther(tx.value), executed: tx.executed, numConfirmations: tx.numConfirmations.toString(), confirmed: false });
      }
      setTransactions(txs.reverse());
    } catch (e) {
      console.error("transactions error:", e.message);
    }
  }
async function submitTx() {
    if (!toAddress || !amount) return;
    setLoading(true);
    try {
      const tx = await contract.submitTransaction(toAddress, ethers.utils.parseEther(amount), "0x");
      await tx.wait();
      alert("Transaction submitted!");
      setToAddress("");
      setAmount("");
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  }

  async function confirmTx(index) {
    setLoading(true);
    try {
      const tx = await contract.confirmTransaction(index);
      await tx.wait();
      alert("Confirmed!");
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  }

  async function executeTx(index) {
    setLoading(true);
    try {
      const tx = await contract.executeTransaction(index);
      await tx.wait();
      alert("Executed!");
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  }
return (
    <div style={{ fontFamily: "monospace", background: "#0a0a0a", minHeight: "100vh", color: "#00ff88", padding: "20px" }}>
      <h1 style={{ borderBottom: "1px solid #00ff88", paddingBottom: "10px" }}>⚡ MultiSig Treasury</h1>

      {!account ? (
        <button onClick={connectWallet} style={{ background: "#00ff88", color: "#0a0a0a", border: "none", padding: "12px 24px", cursor: "pointer", fontFamily: "monospace", fontSize: "16px" }}>
          Connect MetaMask
        </button>
      ) : (
        <div>
          <div style={{ background: "#111", padding: "15px", marginBottom: "20px", border: "1px solid #333" }}>
            <p>🔗 Connected: {account}</p>
            <p>💰 Contract Balance: {balance} ETH</p>
            <p>👥 Owners: {owners.length} | Required Signatures: {required}</p>
            <p>🔑 You are {isOwner ? <span style={{ color: "#00ff88" }}>an OWNER</span> : <span style={{ color: "#ff4444" }}>NOT an owner</span>}</p>
          </div>
{isOwner && (
            <div style={{ background: "#111", padding: "15px", marginBottom: "20px", border: "1px solid #333" }}>
              <h3>📤 Submit New Transaction</h3>
              <input value={toAddress} onChange={e => setToAddress(e.target.value)} placeholder="To address (0x...)" style={{ width: "100%", padding: "8px", marginBottom: "10px", background: "#222", color: "#00ff88", border: "1px solid #444", fontFamily: "monospace" }} />
              <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount in ETH" style={{ width: "100%", padding: "8px", marginBottom: "10px", background: "#222", color: "#00ff88", border: "1px solid #444", fontFamily: "monospace" }} />
              <button onClick={submitTx} disabled={loading} style={{ background: "#00ff88", color: "#0a0a0a", border: "none", padding: "10px 20px", cursor: "pointer", fontFamily: "monospace" }}>
                {loading ? "Processing..." : "Submit Transaction"}
              </button>
            </div>
          )}
<div style={{ background: "#111", padding: "15px", border: "1px solid #333" }}>
            <h3>📋 Transactions ({transactions.length})</h3>
            {transactions.length === 0 && <p style={{ color: "#666" }}>No transactions yet</p>}
            {transactions.map(tx => (
              <div key={tx.index} style={{ borderBottom: "1px solid #222", padding: "15px 0" }}>
                <p>#{tx.index} → {tx.to}</p>
                <p>Value: {tx.value} ETH | Confirmations: {tx.numConfirmations}/{required}</p>
                <p>Status: {tx.executed ? <span style={{ color: "#00ff88" }}>✅ Executed</span> : <span style={{ color: "#ffaa00" }}>⏳ Pending</span>}</p>
                {!tx.executed && isOwner && (
                  <div style={{ marginTop: "10px" }}>
                    {!tx.confirmed && <button onClick={() => confirmTx(tx.index)} disabled={loading} style={{ background: "#00aaff", color: "#fff", border: "none", padding: "8px 16px", cursor: "pointer", marginRight: "10px", fontFamily: "monospace" }}>✓ Approve</button>}
                    {tx.numConfirmations >= required && <button onClick={() => executeTx(tx.index)} disabled={loading} style={{ background: "#00ff88", color: "#0a0a0a", border: "none", padding: "8px 16px", cursor: "pointer", fontFamily: "monospace" }}>⚡ Execute</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

