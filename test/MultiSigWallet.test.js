import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("MultiSigWallet", function () {
  let multiSigWallet;
  let owner1, owner2, owner3, addr1, addr2;
  
  // This runs BEFORE each test
  beforeEach(async function () {
    // Get test accounts from Hardhat
    [owner1, owner2, owner3, addr1, addr2] = await ethers.getSigners();
    
    // Deploy the contract
    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    multiSigWallet = await MultiSigWallet.deploy(
      [owner1.address, owner2.address, owner3.address], // 3 owners
      2  // Require 2 confirmations
    );
  });
  
  // ============ DEPLOYMENT TESTS ============
  
  describe("Deployment", function () {
    it("Should set the right owners", async function () {
      const owners = await multiSigWallet.getOwners();
      expect(owners.length).to.equal(3);
      expect(owners[0]).to.equal(owner1.address);
      expect(owners[1]).to.equal(owner2.address);
      expect(owners[2]).to.equal(owner3.address);
    });
    
    it("Should set the right number of confirmations required", async function () {
      expect(await multiSigWallet.numConfirmationsRequired()).to.equal(2);
    });
    
    it("Should fail if no owners provided", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(
        MultiSigWallet.deploy([], 1)
      ).to.be.revertedWith("Owners required");
    });
    
    it("Should fail if invalid confirmations required", async function () {
      const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
      await expect(
        MultiSigWallet.deploy([owner1.address, owner2.address], 3)
      ).to.be.revertedWith("Invalid number of required confirmations");
    });
  });
  
  // ============ DEPOSIT TESTS ============
  
  describe("Deposits", function () {
    it("Should receive and store ETH", async function () {
      const depositAmount = ethers.parseEther("1.0"); // 1 ETH
      
      await expect(
        owner1.sendTransaction({
          to: await multiSigWallet.getAddress(),
          value: depositAmount
        })
      ).to.changeEtherBalance(multiSigWallet, depositAmount);
    });
    
    it("Should emit Deposit event", async function () {
      const depositAmount = ethers.parseEther("1.0");
      
      await expect(
        owner1.sendTransaction({
          to: await multiSigWallet.getAddress(),
          value: depositAmount
        })
      ).to.emit(multiSigWallet, "Deposit");
    });
  });
  
  // ============ TRANSACTION SUBMISSION TESTS ============
  
  describe("Submit Transaction", function () {
    it("Should allow owner to submit transaction", async function () {
      await expect(
        multiSigWallet.submitTransaction(
          addr1.address,
          ethers.parseEther("0.5"),
          "0x"
        )
      ).to.emit(multiSigWallet, "SubmitTransaction")
        .withArgs(owner1.address, 0, addr1.address, ethers.parseEther("0.5"), "0x");
    });
    
    it("Should fail if non-owner submits transaction", async function () {
      await expect(
        multiSigWallet.connect(addr1).submitTransaction(
          addr2.address,
          ethers.parseEther("0.5"),
          "0x"
        )
      ).to.be.revertedWith("Not an owner");
    });
  });
  
  // ============ CONFIRMATION TESTS ============
  
  describe("Confirm Transaction", function () {
    beforeEach(async function () {
      // Submit a transaction first
      await multiSigWallet.submitTransaction(
        addr1.address,
        ethers.parseEther("0.5"),
        "0x"
      );
    });
    
    it("Should allow owner to confirm transaction", async function () {
      await expect(
        multiSigWallet.connect(owner2).confirmTransaction(0)
      ).to.emit(multiSigWallet, "ConfirmTransaction")
        .withArgs(owner2.address, 0);
      
      const tx = await multiSigWallet.getTransaction(0);
      expect(tx.numConfirmations).to.equal(1);
    });
    
    it("Should fail if non-owner confirms", async function () {
      await expect(
        multiSigWallet.connect(addr1).confirmTransaction(0)
      ).to.be.revertedWith("Not an owner");
    });
    
    it("Should fail if confirming twice", async function () {
      await multiSigWallet.connect(owner2).confirmTransaction(0);
      
      await expect(
        multiSigWallet.connect(owner2).confirmTransaction(0)
      ).to.be.revertedWith("Transaction already confirmed");
    });
  });
  
  // ============ EXECUTION TESTS ============
  
  describe("Execute Transaction", function () {
    beforeEach(async function () {
      // Deposit ETH to contract
      await owner1.sendTransaction({
        to: await multiSigWallet.getAddress(),
        value: ethers.parseEther("2.0")
      });
      
      // Submit transaction
      await multiSigWallet.submitTransaction(
        addr1.address,
        ethers.parseEther("1.0"),
        "0x"
      );
    });
    
    it("Should execute transaction with enough confirmations", async function () {
      // Get 2 confirmations (owner2 and owner3)
      await multiSigWallet.connect(owner2).confirmTransaction(0);
      await multiSigWallet.connect(owner3).confirmTransaction(0);
      
      await expect(
        multiSigWallet.executeTransaction(0)
      ).to.emit(multiSigWallet, "ExecuteTransaction")
        .withArgs(owner1.address, 0);
      
      const tx = await multiSigWallet.getTransaction(0);
      expect(tx.executed).to.equal(true);
    });
    
    it("Should fail if not enough confirmations", async function () {
      // Only 1 confirmation
      await multiSigWallet.connect(owner2).confirmTransaction(0);
      
      await expect(
        multiSigWallet.executeTransaction(0)
      ).to.be.revertedWith("Cannot execute: need more confirmations");
    });
    
    it("Should fail if already executed", async function () {
      await multiSigWallet.connect(owner2).confirmTransaction(0);
      await multiSigWallet.connect(owner3).confirmTransaction(0);
      await multiSigWallet.executeTransaction(0);
      
      await expect(
        multiSigWallet.executeTransaction(0)
      ).to.be.revertedWith("Transaction already executed");
    });
  });
  
  // ============ REVOKE CONFIRMATION TESTS ============
  
  describe("Revoke Confirmation", function () {
    beforeEach(async function () {
      await multiSigWallet.submitTransaction(
        addr1.address,
        ethers.parseEther("0.5"),
        "0x"
      );
      await multiSigWallet.connect(owner2).confirmTransaction(0);
    });
    
    it("Should allow owner to revoke confirmation", async function () {
      await expect(
        multiSigWallet.connect(owner2).revokeConfirmation(0)
      ).to.emit(multiSigWallet, "RevokeConfirmation")
        .withArgs(owner2.address, 0);
      
      const tx = await multiSigWallet.getTransaction(0);
      expect(tx.numConfirmations).to.equal(0);
    });
    
    it("Should fail if transaction not confirmed", async function () {
      await expect(
        multiSigWallet.connect(owner3).revokeConfirmation(0)
      ).to.be.revertedWith("Transaction not confirmed");
    });
  });
});
