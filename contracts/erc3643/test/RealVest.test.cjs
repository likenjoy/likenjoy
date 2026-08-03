const { expect } = require("chai");
const hre = require("hardhat");

describe("ERC-3643 RealVest Contracts", function () {
  let identityRegistry, complianceModule, token;
  let owner, investor1, investor2, agent;
  let assetId;

  before(async function () {
    [owner, investor1, investor2, agent] = await hre.ethers.getSigners();
    assetId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GOLD-001"));

    const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.waitForDeployment();

    const ComplianceModule = await hre.ethers.getContractFactory("ComplianceModule");
    complianceModule = await ComplianceModule.deploy(await identityRegistry.getAddress());
    await complianceModule.waitForDeployment();

    const RWAToken = await hre.ethers.getContractFactory("RWAToken");
    token = await RWAToken.deploy(
      "RealVest Gold Token",
      "RVGOLD",
      18,
      assetId,
      await identityRegistry.getAddress(),
      await complianceModule.getAddress()
    );
    await token.waitForDeployment();

    const tokenAddr = await token.getAddress();
    await identityRegistry.addAgent(tokenAddr);
    await complianceModule.addAgent(tokenAddr);
  });

  describe("IdentityRegistry", function () {
    it("should register an investor identity", async function () {
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("user-1-kyc-verified-salt123"));
      await identityRegistry.registerIdentity(investor1.address, hash, 156);

      expect(await identityRegistry.isVerified(investor1.address)).to.equal(true);
      expect(await identityRegistry.investorCountry(investor1.address)).to.equal(156);
      expect(await identityRegistry.identityHash(investor1.address)).to.equal(hash);
    });

    it("should not allow duplicate registration", async function () {
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("user-1-kyc-verified-salt456"));
      await expect(
        identityRegistry.registerIdentity(investor1.address, hash, 156)
      ).to.be.revertedWith("IdentityRegistry: already registered");
    });

    it("should update identity", async function () {
      const newHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("user-1-updated-salt789"));
      await identityRegistry.updateIdentity(investor1.address, newHash, 344);
      expect(await identityRegistry.investorCountry(investor1.address)).to.equal(344);
    });

    it("should remove identity", async function () {
      await identityRegistry.removeIdentity(investor1.address);
      expect(await identityRegistry.isVerified(investor1.address)).to.equal(false);
    });
  });

  describe("ComplianceModule", function () {
    before(async function () {
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("user-1-kyc-verified-salt123"));
      await identityRegistry.registerIdentity(investor1.address, hash, 156);
    });

    it("should add investor to whitelist", async function () {
      await complianceModule.addToWhitelist(investor1.address, hre.ethers.parseEther("1000"), 0);

      expect(await complianceModule.isWhitelisted(investor1.address)).to.equal(true);
      expect(await complianceModule.maxHolding(investor1.address)).to.equal(hre.ethers.parseEther("1000"));
    });

    it("should reject unverified investor from whitelist", async function () {
      await expect(
        complianceModule.addToWhitelist(investor2.address, hre.ethers.parseEther("100"), 0)
      ).to.be.revertedWith("ComplianceModule: investor not verified");
    });

    it("should allow transfer for whitelisted investor", async function () {
      const [allowed, reason] = await complianceModule.canTransfer(
        hre.ethers.ZeroAddress,
        investor1.address,
        hre.ethers.parseEther("100")
      );
      expect(allowed).to.equal(true);
      expect(reason).to.equal("");
    });

    it("should reject transfer for non-whitelisted investor", async function () {
      const [allowed, reason] = await complianceModule.canTransfer(
        hre.ethers.ZeroAddress,
        investor2.address,
        hre.ethers.parseEther("100")
      );
      expect(allowed).to.equal(false);
      expect(reason).to.equal("Receiver not verified");
    });
  });

  describe("RWAToken", function () {
    before(async function () {
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("user-2-kyc-verified-salt123"));
      await identityRegistry.registerIdentity(investor2.address, hash, 344);
      await complianceModule.addToWhitelist(investor2.address, hre.ethers.parseEther("10000"), 0);
    });

    it("should have correct metadata", async function () {
      expect(await token.name()).to.equal("RealVest Gold Token");
      expect(await token.symbol()).to.equal("RVGOLD");
      expect(await token.decimals()).to.equal(18);
    });

    it("should mint tokens to whitelisted investor", async function () {
      const amount = hre.ethers.parseEther("100");
      await token.mint(investor1.address, amount, assetId);

      expect(await token.balanceOf(investor1.address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(amount);
    });

    it("should reject mint to non-whitelisted address", async function () {
      const [, , , , nonWhitelisted] = await hre.ethers.getSigners();
      await expect(
        token.mint(nonWhitelisted.address, hre.ethers.parseEther("10"), assetId)
      ).to.be.reverted;
    });

    it("should transfer between whitelisted investors", async function () {
      const amount = hre.ethers.parseEther("50");
      // investor1 calls transfer (not owner)
      await token.connect(investor1).transfer(investor2.address, amount);

      expect(await token.balanceOf(investor1.address)).to.equal(hre.ethers.parseEther("50"));
      expect(await token.balanceOf(investor2.address)).to.equal(amount);
    });

    it("should burn tokens", async function () {
      const amount = hre.ethers.parseEther("20");
      // owner (agent) burns investor1's tokens
      await token.burn(investor1.address, amount, "Redemption");

      expect(await token.balanceOf(investor1.address)).to.equal(hre.ethers.parseEther("30"));
      expect(await token.totalSupply()).to.equal(hre.ethers.parseEther("80"));
    });

    it("should execute forced transfer", async function () {
      const amount = hre.ethers.parseEther("10");
      await token.forcedTransfer(investor1.address, investor2.address, amount, "Court order");

      expect(await token.balanceOf(investor1.address)).to.equal(hre.ethers.parseEther("20"));
      expect(await token.balanceOf(investor2.address)).to.equal(hre.ethers.parseEther("60"));
    });

    it("should update NAV", async function () {
      const newNAV = hre.ethers.parseEther("1950");
      await token.updateNAV(newNAV);
      expect(await token.nav()).to.equal(newNAV);
    });

    it("should manage agents", async function () {
      await token.addAgent(agent.address);
      expect(await token.isAgent(agent.address)).to.equal(true);

      await token.removeAgent(agent.address);
      expect(await token.isAgent(agent.address)).to.equal(false);
    });

    it("should reject non-agent mint", async function () {
      await expect(
        token.connect(investor1).mint(investor2.address, hre.ethers.parseEther("10"), assetId)
      ).to.be.revertedWith("RWAToken: caller is not agent");
    });

    it("should reject zero NAV update", async function () {
      await expect(token.updateNAV(0)).to.be.revertedWith("RWAToken: NAV must be positive");
    });
  });

  describe("Security Hardening (lockup / jurisdiction / pause)", function () {
    let investor3;
    before(async function () {
      [, , , , investor3] = await hre.ethers.getSigners();
      const hash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("user-3-kyc-salt"));
      await identityRegistry.registerIdentity(investor3.address, hash, 702); // 702 = SG
    });

    it("should block sender during lockup period (transfer out frozen)", async function () {
      // investor3 白名单 + 锁定期到未来（认购后锁定）
      const farFuture = Math.floor(Date.now() / 1000) + 86400 * 90; // 90 天
      await complianceModule.addToWhitelist(investor3.address, hre.ethers.parseEther("1000"), farFuture);
      await token.mint(investor3.address, hre.ethers.parseEther("100"), assetId);

      // investor3 处于锁定期：不能转出（此前漏洞：锁定期仅约束接收方）
      await expect(
        token.connect(investor3).transfer(investor1.address, hre.ethers.parseEther("1"))
      ).to.be.revertedWith("Sender in lockup period");

      // 锁定期内也不能接收（原有约束保留）
      await expect(
        token.connect(investor1).transfer(investor3.address, hre.ethers.parseEther("1"))
      ).to.be.revertedWith("Receiver in lockup period");
    });

    it("should allow transfer after lockup expires", async function () {
      await complianceModule.setLockupEnd(investor3.address, 0);
      await token.connect(investor3).transfer(investor1.address, hre.ethers.parseEther("10"));
      expect(await token.balanceOf(investor3.address)).to.equal(hre.ethers.parseEther("90"));
    });

    it("should enforce jurisdiction restriction on-chain", async function () {
      // 锁区 investor3 的司法管辖区（SG=702）
      await complianceModule.setRestrictedCountry(702, true);
      expect(await complianceModule.isCountryRestricted(702)).to.equal(true);

      // 锁区用户不能转出
      await expect(
        token.connect(investor3).transfer(investor1.address, hre.ethers.parseEther("1"))
      ).to.be.revertedWith("Sender jurisdiction restricted");

      // 锁区用户不能接收
      await expect(
        token.connect(investor1).transfer(investor3.address, hre.ethers.parseEther("1"))
      ).to.be.revertedWith("Receiver jurisdiction restricted");

      // 解除锁区后恢复
      await complianceModule.setRestrictedCountry(702, false);
    });

    it("should pause and block all operations, then unpause", async function () {
      await token.pause();
      expect(await token.paused()).to.equal(true);

      // 熔断期间：转账被拒
      await expect(
        token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("1"))
      ).to.be.revertedWith("RWAToken: paused");

      // 熔断期间：mint 也被拒
      await expect(
        token.mint(investor1.address, hre.ethers.parseEther("1"), assetId)
      ).to.be.revertedWith("RWAToken: paused");

      // 解除熔断后恢复
      await token.unpause();
      expect(await token.paused()).to.equal(false);
      await token.connect(investor1).transfer(investor2.address, hre.ethers.parseEther("1"));
    });
  });
});
