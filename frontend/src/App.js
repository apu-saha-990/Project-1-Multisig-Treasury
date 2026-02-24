import { useState } from "react";
import { ethers } from "ethers";
const CONTRACT_ADDRESS = "0x207B13B8ea25E7788f1b2e5c3705a84fDC8508E5";

const ABI = [
  "function getOwners() view returns (address[])",
  "function numConfirmationsRequired() view returns (uint)",
  "function getTransactionCount() view returns (uint)",
  "function getTransaction(uint txIndex) view returns (address to, uint value, bytes data, bool executed, uint numConfirmations)",
  "function isConfirmed(uint txIndex, address owner) view returns (bool)",
  "function submitTransaction(address to, uint value, bytes data)",
  "function confirmTransaction(uint txIndex)",
  "function executeTransaction(uint txIndex)",
  "function revokeConfirmation(uint txIndex)",
  "function addOwner(address owner)",
  "function removeOwner(address owner)",
  "function changeRequirement(uint required)",
  "function paused() view returns (bool)",
  "function pause()",
  "function unpause()"
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
  const [newOwner, setNewOwner] = useState("");
  const [removeOwnerAddr, setRemoveOwnerAddr] = useState("");
  const [newRequired, setNewRequired] = useState("");
  const [isPaused, setIsPaused] = useState(false);
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
      const req = await c.numConfirmationsRequired();
      setRequired(req.toString());
    } catch (e) {
      console.error("required error:", e.message);
    }
    try {
      const pausedStatus = await c.paused();
      setIsPaused(pausedStatus);
    } catch (e) {
      console.error("paused error:", e.message);
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
        const confirmed = await c.isConfirmed(i, acc);
        let txType = "ETH Transfer";
        if (tx.data && tx.data.length > 2) {
        const iface = new ethers.utils.Interface(ABI);
        try {
        const decoded = iface.parseTransaction({ data: tx.data });
        txType = decoded.name;
        } catch (e) {
        txType = "Contract Call";
  }
}
txs.push({ index: i, to: tx.to, value: ethers.utils.formatEther(tx.value), executed: tx.executed, numConfirmations: tx.numConfirmations.toString(), confirmed, txType });
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
  async function revokeTx(index) {
    setLoading(true);
    try {
      const tx = await contract.revokeConfirmation(index);
      await tx.wait();
      alert("Revoked!");
      window.location.reload();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  }
  async function submitAddOwner() {
    if (!newOwner) return;
    setLoading(true);
    try {
      const iface = new ethers.utils.Interface(ABI);
      const data = iface.encodeFunctionData("addOwner", [newOwner]);
      const tx = await contract.submitTransaction(CONTRACT_ADDRESS, 0, data);
      await tx.wait();
      alert("Add owner proposal submitted! Needs approval from other owners.");
      setNewOwner("");
      window.location.reload();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  }
  async function submitRemoveOwner() {
    if (!removeOwnerAddr) return;
    setLoading(true);
    try {
      const iface = new ethers.utils.Interface(ABI);
      const data = iface.encodeFunctionData("removeOwner", [removeOwnerAddr]);
      const tx = await contract.submitTransaction(CONTRACT_ADDRESS, 0, data);
      await tx.wait();
      alert("Remove owner proposal submitted! Needs approval from other owners.");
      setRemoveOwnerAddr("");
      window.location.reload();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  }

  async function submitChangeRequired() {
    if (!newRequired) return;
    setLoading(true);
    try {
      const iface = new ethers.utils.Interface(ABI);
      const data = iface.encodeFunctionData("changeRequirement", [parseInt(newRequired)]);
      const tx = await contract.submitTransaction(CONTRACT_ADDRESS, 0, data);
      await tx.wait();
      alert("Change requirement proposal submitted! Needs approval from other owners.");
      setNewRequired("");
      window.location.reload();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  }
  async function submitPause() {
    setLoading(true);
    try {
      const iface = new ethers.utils.Interface(ABI);
      const data = iface.encodeFunctionData("pause", []);
      const tx = await contract.submitTransaction(CONTRACT_ADDRESS, 0, data);
      await tx.wait();
      alert("Pause proposal submitted! Needs approval from other owners.");
      window.location.reload();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  }

  async function submitUnpause() {
    setLoading(true);
    try {
      const iface = new ethers.utils.Interface(ABI);
      const data = iface.encodeFunctionData("unpause", []);
      const tx = await contract.submitTransaction(CONTRACT_ADDRESS, 0, data);
      await tx.wait();
      alert("Unpause proposal submitted! Needs approval from other owners.");
      window.location.reload();
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
            <p>📍 Contract: {CONTRACT_ADDRESS}</p>
            <p>💰 Contract Balance: {balance} ETH</p>
            <p>👥 Owners: {owners.length} | Required Signatures: {required}</p>
            <p>🔗 Connected: {account}</p>
            <p>🔑 You are {isOwner ? <span style={{ color: "#00ff88" }}>an OWNER</span> : <span style={{ color: "#ff4444" }}>NOT an owner</span>}</p>
<p>⚠️ Contract Status: {isPaused ? <span style={{ color: "#ff4444" }}>PAUSED</span> : <span style={{ color: "#00ff88" }}>ACTIVE</span>}</p>
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

          {isOwner && (
            <div style={{ background: "#111", padding: "15px", marginBottom: "20px", border: "1px solid #333" }}>
    <h3>👥 Owner Management</h3>
    
    <div style={{ marginBottom: "15px" }}>
      <h4 style={{ color: "#00ff88", marginBottom: "10px" }}>Current Owners:</h4>
      {owners.map((owner, i) => (
        <p key={i} style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>{i+1}. {owner}</p>
      ))}
    </div>

    <div style={{ marginBottom: "15px" }}>
      <h4 style={{ color: "#00aaff" }}>Add New Owner</h4>
      <input value={newOwner} onChange={e => setNewOwner(e.target.value)} placeholder="New owner address (0x...)" style={{ width: "100%", padding: "8px", marginBottom: "10px", background: "#222", color: "#00ff88", border: "1px solid #444", fontFamily: "monospace" }} />
      <button onClick={submitAddOwner} disabled={loading} style={{ background: "#00aaff", color: "#fff", border: "none", padding: "10px 20px", cursor: "pointer", fontFamily: "monospace" }}>
        Add Owner
      </button>
    </div>

    <div style={{ marginBottom: "15px" }}>
      <h4 style={{ color: "#ff4444" }}>Remove Owner</h4>
      <input value={removeOwnerAddr} onChange={e => setRemoveOwnerAddr(e.target.value)} placeholder="Owner address to remove (0x...)" style={{ width: "100%", padding: "8px", marginBottom: "10px", background: "#222", color: "#00ff88", border: "1px solid #444", fontFamily: "monospace" }} />
      <button onClick={submitRemoveOwner} disabled={loading} style={{ background: "#ff4444", color: "#fff", border: "none", padding: "10px 20px", cursor: "pointer", fontFamily: "monospace" }}>
        Remove Owner
      </button>
    </div>

    <div>
      <h4 style={{ color: "#ffaa00" }}>Change Required Signatures</h4>
      <input value={newRequired} onChange={e => setNewRequired(e.target.value)} placeholder="New required count" type="number" min="1" style={{ width: "100%", padding: "8px", marginBottom: "10px", background: "#222", color: "#00ff88", border: "1px solid #444", fontFamily: "monospace" }} />
      <button onClick={submitChangeRequired} disabled={loading} style={{ background: "#ffaa00", color: "#0a0a0a", border: "none", padding: "10px 20px", cursor: "pointer", fontFamily: "monospace" }}>
        Change Requirement
      </button>
    </div>
  <div style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #333" }}>
      <h4 style={{ color: "#ff4444" }}>Emergency Controls</h4>
      {!isPaused ? (
        <button onClick={submitPause} disabled={loading} style={{ background: "#ff4444", color: "#fff", border: "none", padding: "10px 20px", cursor: "pointer", fontFamily: "monospace" }}>
          🚨 Pause Contract
        </button>
      ) : (
        <button onClick={submitUnpause} disabled={loading} style={{ background: "#00ff88", color: "#0a0a0a", border: "none", padding: "10px 20px", cursor: "pointer", fontFamily: "monospace" }}>
          ✅ Unpause Contract
        </button>
      )}
      <p style={{ fontSize: "11px", color: "#666", marginTop: "10px" }}>Pausing prevents transaction execution until unpaused</p>
   </div>
  </div>
          )}
<div style={{ background: "#111", padding: "15px", border: "1px solid #333" }}>
            <h3>📋 Transactions ({transactions.length})</h3>
            {transactions.length === 0 && <p style={{ color: "#666" }}>No transactions yet</p>}
            {transactions.map(tx => (
              <div key={tx.index} style={{ borderBottom: "1px solid #222", padding: "15px 0" }}>
               <p>#{tx.index} | Type: <span style={{ color: "#00aaff" }}>{tx.txType}</span></p>
               <p style={{ fontSize: "11px", color: "#666" }}>To: {tx.to}</p>
                <p>Value: {tx.value} ETH | Confirmations: {tx.numConfirmations}/{required}</p>
                <p>Status: {tx.executed ? <span style={{ color: "#00ff88" }}>✅ Executed</span> : <span style={{ color: "#ffaa00" }}>⏳ Pending</span>}</p>
                {!tx.executed && isOwner && (
                  <div style={{ marginTop: "10px" }}>
                    {!tx.confirmed && <button onClick={() => confirmTx(tx.index)} disabled={loading} style={{ background: "#00aaff", color: "#fff", border: "none", padding: "8px 16px", cursor: "pointer", marginRight: "10px", fontFamily: "monospace" }}>✓ Approve</button>}{tx.confirmed && <button onClick={() => revokeTx(tx.index)} disabled={loading} style={{ background: "#ff4444", color: "#fff", border: "none", padding: "8px 16px", cursor: "pointer", marginRight: "10px", fontFamily: "monospace" }}>✗ Revoke</button>}
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

