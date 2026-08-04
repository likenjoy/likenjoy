const hre = require("hardhat");

async function main() {
  console.log("Deploying ERC-3643 contracts...\n");

  // 1. Deploy IdentityRegistry
  const IdentityRegistry = await hre.ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const irAddr = await identityRegistry.getAddress();
  console.log("IdentityRegistry deployed to:", irAddr);

  // 2. Deploy ComplianceModule
  const ComplianceModule = await hre.ethers.getContractFactory("ComplianceModule");
  const complianceModule = await ComplianceModule.deploy(irAddr);
  await complianceModule.waitForDeployment();
  const cmAddr = await complianceModule.getAddress();
  console.log("ComplianceModule deployed to:", cmAddr);

  // 3. Deploy RWAToken
  const RWAToken = await hre.ethers.getContractFactory("RWAToken");
  const assetId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("GOLD-001"));
  const token = await RWAToken.deploy(
    "RealVest Gold Token",
    "RVGOLD",
    18,
    assetId,
    irAddr,
    cmAddr
  );
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("RWAToken deployed to:", tokenAddr);

  // 4. Set token as agent on IdentityRegistry and ComplianceModule
  await identityRegistry.addAgent(tokenAddr);
  await complianceModule.addAgent(tokenAddr);
  console.log("Token set as agent on IdentityRegistry and ComplianceModule");

  // 4.5 Deploy TrustedForwarder（EIP-2771 元交易 / gas 代付）
  const ERC2771Forwarder = await hre.ethers.getContractFactory("TrustedForwarder");
  const forwarder = await ERC2771Forwarder.deploy("RWAExchangeForwarder");
  await forwarder.waitForDeployment();
  const forwarderAddr = await forwarder.getAddress();
  console.log("ERC2771Forwarder deployed to:", forwarderAddr);

  // 4.6 绑定受信转发器到 RWAToken（元交易调用时 _msgSender() 还原真实签名者）
  await token.setTrustedForwarder(forwarderAddr);
  console.log("TrustedForwarder bound to RWAToken");

  // 5. 平台账户（部署者/后端签名者）注册链上身份并加入白名单
  //    RWAToken.mint 会调用 complianceModule.canTransfer(0, to, amount) 做合规检查，
  //    接收方必须 isVerified 且 whitelisted，否则 mint 会被 revert。
  const [deployer] = await hre.ethers.getSigners();
  const platformHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("platform-identity"));
  await identityRegistry.registerIdentity(deployer.address, platformHash, 344); // 344 = HK
  console.log("Platform identity registered:", deployer.address);
  await complianceModule.addToWhitelist(deployer.address, 0, 0); // 无持仓上限、无锁定期
  console.log("Platform whitelisted on ComplianceModule");

  console.log("\n=== Deployment Summary ===");
  console.log("IdentityRegistry:", irAddr);
  console.log("ComplianceModule:", cmAddr);
  console.log("RWAToken:", tokenAddr);
  console.log("ERC2771Forwarder:", forwarderAddr);
  console.log("AssetId:", assetId);

  // Save addresses to file
  const fs = require("fs");
  const path = require("path");
  const addresses = {
    identityRegistry: irAddr,
    complianceModule: cmAddr,
    rwaToken: tokenAddr,
    forwarder: forwarderAddr,
    assetId: assetId,
  };
  const outPath = path.join(__dirname, "..", "..", "..", "backend", "contracts.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to backend/contracts.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
