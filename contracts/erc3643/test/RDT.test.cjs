const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

describe("RevenueDistributionToken (RDT)", function () {
  let rdt, rwa, yieldTk, owner, agent, alice, bob;

  const VEST = 120; // 120 秒释放期（多笔交易累计 ~8s 流逝，保证窗口稳定）

  before(async function () {
    [owner, agent, alice, bob] = await ethers.getSigners();
    const Mock = await ethers.getContractFactory("MockERC20");
    rwa = await Mock.deploy("RWA Gold", "RVG");
    yieldTk = await Mock.deploy("HKD Stable", "HKDS");
    const RDT = await ethers.getContractFactory("RevenueDistributionToken");
    rdt = await RDT.deploy(rwa.target, yieldTk.target, agent.address, VEST);
    await rwa.waitForDeployment();
    await yieldTk.waitForDeployment();
    await rdt.waitForDeployment();
  });

  it("初始化参数正确", async function () {
    expect(await rdt.rwaToken()).to.equal(rwa.target);
    expect(await rdt.yieldToken()).to.equal(yieldTk.target);
    expect(await rdt.agent()).to.equal(agent.address);
    expect(await rdt.vestingDuration()).to.equal(VEST);
  });

  it("仅 agent 可存入收益", async function () {
    await expect(rdt.connect(alice).depositYield(100)).to.be.revertedWith("RDT: not agent");
  });

  it("存入收益开始线性释放，未到期前只能领已释放部分", async function () {
    // agent 持有收益代币并授权
    await yieldTk.mint(agent.address, ethers.parseEther("1000"));
    await yieldTk.connect(agent).approve(rdt.target, ethers.parseEther("1000"));
    // 份额：rwa 100 个给 alice
    await rwa.mint(alice.address, ethers.parseEther("100"));

    await rdt.connect(agent).depositYield(ethers.parseEther("100"));

    // 刚存入：释放量≈0（区块时间几乎未流逝）
    // 刚存入：释放量应远小于总额（<10%）；多笔交易累计 ~8s 流逝 = 6.7%
    expect((await rdt.releasedAmount()) < ethers.parseEther("10")).to.equal(true);

    // 过 30 秒：累计 ~38s/120s ≈ 31.7%，窗口断言 20%-40%
    await ethers.provider.send("evm_increaseTime", [30]);
    await ethers.provider.send("evm_mine", []);
    const rel = await rdt.releasedAmount();
    expect(rel > ethers.parseEther("20") && rel < ethers.parseEther("40")).to.equal(true);

    // alice 领取约一半（staticCall 拿返回值，再发交易）
    const balBefore = await yieldTk.balanceOf(alice.address);
    const got = await rdt.connect(alice).claim.staticCall();
    expect(got > 0n).to.equal(true);
    await (await rdt.connect(alice).claim()).wait();
    const balAfter = await yieldTk.balanceOf(alice.address);
    // staticCall 与实际交易间隔约 1 秒，释放量有微小差异 → 容差 1 个代币
    expect(balAfter - balBefore).to.be.closeTo(got, ethers.parseEther("1"));
  });

  it("释放期满后可领取全部收益", async function () {
    await ethers.provider.send("evm_increaseTime", [90]);
    await ethers.provider.send("evm_mine", []);
    const got = await rdt.connect(alice).claim.staticCall();
    expect(got > 0n).to.equal(true);
    await (await rdt.connect(alice).claim()).wait();
    // alice 累计领取 = 全部 100（她持有 100% 份额；累计 128s > 120s 释放期）
    const claimed = await rdt.claimed(alice.address);
    expect(claimed).to.equal(ethers.parseEther("100"));
  });

  it("多持有人按份额分配", async function () {
    // 新收益 50；bob 持有 rwa 40（份额 40/140）
    await rwa.mint(bob.address, ethers.parseEther("40"));
    await yieldTk.mint(agent.address, ethers.parseEther("50"));
    await yieldTk.connect(agent).approve(rdt.target, ethers.parseEther("50"));
    await rdt.connect(agent).depositYield(ethers.parseEther("50"));

    await ethers.provider.send("evm_increaseTime", [60]);
    await ethers.provider.send("evm_mine", []);

    const bobGot = await rdt.connect(bob).claim.staticCall();
    await (await rdt.connect(bob).claim()).wait();
    // 首笔存入起 120s 释放完毕；累计时间已超 120s → 总量 150 全额释放
    // bob 份额 = 40/140；应得 ≈ 150 * 40/140 ≈ 42.86
    // 注：MVP 份额按实时供应计算，新持有人分享未释放收益（二期升级 Maple 式快照）
    const expected = (ethers.parseEther("150") * 40n) / 140n;
    expect(bobGot).to.be.closeTo(expected, ethers.parseEther("1"));

    // 无持仓者不能领取
    await expect(rdt.connect(owner).claim()).to.be.revertedWith("RDT: no holdings");
  });

  it("setVestingDuration 仅 agent 可调用", async function () {
    await expect(rdt.connect(alice).setVestingDuration(100)).to.be.revertedWith("RDT: not agent");
    await rdt.connect(agent).setVestingDuration(100);
    expect(await rdt.vestingDuration()).to.equal(100);
  });
});