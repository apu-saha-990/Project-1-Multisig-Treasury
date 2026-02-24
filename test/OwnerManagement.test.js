const { expect } = require("chai");
const hre = require("hardhat");

describe("MultiSigWallet - Owner Management", function () {
  let multiSigWallet;
  let owner1, owner2, owner3, newOwner, addr1;
  
  beforeEach(async function () {
    [owner1, owner2, owner3, newOwner, addr1] = await hre.ethers.getSigners();
    
    const MultiSigWallet = await hre.ethers.getContractFactory("MultiSigWallet");
    multiSigWallet = await MultiSigWallet.deploy(
      [owner1.address, owner2.address, owner3.address],
      2
    );
  });
  
  // ============ ADD OWNER TESTS ============
  
  describe("Add Owner", function () {
    it("Should allow adding new owner via MultiSig", async function () {
      const addOwnerData = multiSigWallet.interface.encodeFunctionData(
        "addOwner",
        [newOwner.address]
      );
      
      await multiSigWallet.submitTransaction(
        await multiSigWallet.getAddress(),
        0,
        addOwnerData
      );
      
      await multiSigWallet.connect(owner2).confirmTransaction(0);
      await multiSigWallet.connect(owner3).confirmTransaction(0);
      
      await multiSigWallet.executeTransaction(0);
      
      const owners = await multiSigWallet.getOwners();
      expect(owners.length).to.equal(4);
      expect(await multiSigWallet.isOwner(newOwner.address)).to.be.true;
    });
    
    it("Should fail to add owner without MultiSig approval", async function () {
      await expect(
        multiSigWallet.addOwner(newOwner.address)
      ).to.be.revertedWith("Only MultiSig can call this");
    });
    
    it("Should fail to add zero address as owner", async function () {
      const addOwnerData = multiSigWallet.interface.encodeFunctionData(
        "addOwner",
        [hre.ethers.ZeroAddress]
      );
      
      await multiSigWallet.submitTransaction(
        await multiSigWallet.getAddress(),
        0,
        addOwnerData
      );
      
      await multiSigWallet.connect(owner2).confirmTransaction(0);
      await multiSigWallet.connect(owner3).confirmTransaction(0);
      
      await expect(
        multiSigWallet.executeTransaction(0)
      ).to.be.reverted;
    });
    
    it("Should fail to add existing owner", async function () {
      const addOwnerData = multiSigWallet.interface.encodeFunctionData(
        "addOwner",
        [owner1.address]
      );
      
      await multiSigWallet.submitTransaction(
        await multiSigWallet.getAddress(),
        0,
        addOwnerData
      );
      
      await multiSigWallet.connect(owner2).confirmTransaction(0);
      await multiSigWallet.connect(owner3).confirmTransaction(0);
      
      await expect(
        multiSigWallet.executeTransaction(0)
      ).to.be.reverted;
    });
  });
  
  // ============ REMOVE OWNER TESTS ============
  
  describe("Remove Owner", function () {
    it("Should allow removing owner via MultiSig", async function () {
      const addOwnerData = multiSigWallet.interface.encodeFunctionData(
        "addOwner",
        [newOwner.address]
      );
      
      await multiSigWallet.submitTransaction(
        await multiSigWallet.getAddress(),
        0,
        addOwnerData
      );
      await multiSigWallet.connect(owner2).confirmTransaction(0);
      await multiSigWallet.connect(owner3).confirmTransaction(0);
      await multiSigWallet.executeTransaction(0);
      
      const removeOwnerData = multiSigWallet.interface.encodeFunctionData(
        "removeOwner",
        [owner3.address]
      );
      
      await multiSigWallet.submitTransaction(
        await multiSigWallet.getAddress(),
        0,
        removeOwnerData
      );
      await multiSigWallet.connect(owner1).confirmTransaction(1);
      await multiSigWallet.connect(owner2).confirmTransaction(1);
      await multiSigWallet.executeTransaction(1);
      
      const owners = await multiSigWallet.getOwners();
      expect(owners.length).to.equal(3);
      expect(await multiSigWallet.isOwner(owner3.address)).to.be.false;
    });
    
    it("Should fail to remove owner if it breaks threshold", async function () {
      const changeReqData = multiSigWallet.interface.encodeFunctionData(
        "changeRequirement",
        [3]
      );
      
      await multiSigWallet.submitTransaction(
        await multiSigWallet.getAddress(),
        0,
        changeReqData
      );
      await multiSigWallet.connect(owner2).confirmTransaction(0);
      await multiSigWallet.connect(owner3).confirmTransaction(0);
      await multiSigWallet.executeTransaction(0);
      
      const removeOwnerData = multiSigWallet.interface.encodeFunctionData(
        "removeOwner",
        [owner3.address]
      );
      
      await multiSigWallet.submitTransaction(
        await multiSigWallet.getAddress(),
        0,
        removeOwnerData
      );
      await multiSigWallet.connect(owner1).confirmTransaction(1);
      await multiSigWallet.connect(owner2).confirmTransaction(1);
      await multiSigWallet.connect(owner3).confirmTransaction(1);
      
      await expect(
        multiSigWallet.executeTransaction(1)
      ).to.be.reverted;
    });
  });
  
  // ============ CHANGE REQUIREMENT TESTS ============
  
  describe("Change Requirement", function () {
    it("Should allow changing threshold via MultiSig", async function () {
      const addOwnerData = multiSigWallet.interface.encodeFunctionData(
        "addOwner",
        [newOwner.address]
      );
      
      await multiSigWallet.submitTransaction(
        await multiSigWallet.getAddress(),
        0,
        addOwnerData
      );
      await multiSigWallet.connect(owner2).confirmTransaction(0);
      await multiSigWallet.connect(owner3).confirmTransaction(0);
      await multiSigWallet.executeTransaction(0);
      
      const changeReqData = multiSigWallet.interface.encodeFunctionData(
        "changeRequirement",
        [3]
      );
      
      await multiSigWallet.submitTransaction(
        await multiSigWallet.getAddress(),
        0,
        changeReqData
      );
      await multiSigWallet.connect(owner1).confirmTransaction(1);
      await multiSigWallet.connect(owner2).confirmTransaction(1);
      await multiSigWallet.executeTransaction(1);
      
      expect(await multiSigWallet.numConfirmationsRequired()).to.equal(3);
    });
    
    it("Should fail to change requirement to 0", async function () {
      const changeReqData = multiSigWallet.interface.encodeFunctionData(
        "changeRequirement",
        [0]
      );
      
      await multiSigWallet.submitTransaction(
        await multiSigWallet.getAddress(),
        0,
        changeReqData
      );
      await multiSigWallet.connect(owner2).confirmTransaction(0);
      await multiSigWallet.connect(owner3).confirmTransaction(0);
      
      await expect(
        multiSigWallet.executeTransaction(0)
      ).to.be.reverted;
    });
    
    it("Should fail to change requirement above owner count", async function () {
      const changeReqData = multiSigWallet.interface.encodeFunctionData(
        "changeRequirement",
        [10]
      );
      
      await multiSigWallet.submitTransaction(
        await multiSigWallet.getAddress(),
        0,
        changeReqData
      );
      await multiSigWallet.connect(owner2).confirmTransaction(0);
      await multiSigWallet.connect(owner3).confirmTransaction(0);
      
      await expect(
        multiSigWallet.executeTransaction(0)
      ).to.be.reverted;
    });
  });
});
