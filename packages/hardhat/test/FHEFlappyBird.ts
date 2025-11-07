import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FHEFlappyBird, FHEFlappyBird__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEFlappyBird")) as FHEFlappyBird__factory;
  const fheFlappyContract = (await factory.deploy()) as FHEFlappyBird;
  const fheFlappyAddress = await fheFlappyContract.getAddress();

  return { fheFlappyContract, fheFlappyAddress };
}

describe("FHEFlappyBird", function () {
  let signers: Signers;
  let fheFlappyContract: FHEFlappyBird;
  let fheFlappyAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This Hardhat test suite only runs in FHE mock mode`);
      this.skip();
    }

    ({ fheFlappyContract, fheFlappyAddress } = await deployFixture());
  });

  it("should revert if trying to get score before submission", async function () {
    await expect(fheFlappyContract.getBestScore(signers.alice.address)).to.be.revertedWith(
      "Player has not submitted any score",
    );
  });

  it("should accept first-time score submission", async function () {
    const score = 25;

    const encrypted = await fhevm.createEncryptedInput(fheFlappyAddress, signers.alice.address).add32(score).encrypt();

    await fheFlappyContract.connect(signers.alice).submitFlyScore(encrypted.handles[0], encrypted.inputProof);

    const encryptedStored = await fheFlappyContract.getBestScore(signers.alice.address);
    const clearStored = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedStored,
      fheFlappyAddress,
      signers.alice,
    );

    expect(clearStored).to.eq(score);
  });

  it("should replace score only when higher", async function () {
    const low = 40;
    const high = 99;

    const encLow = await fhevm.createEncryptedInput(fheFlappyAddress, signers.alice.address).add32(low).encrypt();

    await fheFlappyContract.connect(signers.alice).submitFlyScore(encLow.handles[0], encLow.inputProof);

    const encHigh = await fhevm.createEncryptedInput(fheFlappyAddress, signers.alice.address).add32(high).encrypt();

    await fheFlappyContract.connect(signers.alice).submitFlyScore(encHigh.handles[0], encHigh.inputProof);

    const encryptedStored = await fheFlappyContract.getBestScore(signers.alice.address);
    const clearStored = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedStored,
      fheFlappyAddress,
      signers.alice,
    );

    expect(clearStored).to.eq(high);
  });

  it("should keep old score if new one is lower", async function () {
    const first = 88;
    const lower = 12;

    const encFirst = await fhevm.createEncryptedInput(fheFlappyAddress, signers.alice.address).add32(first).encrypt();

    await fheFlappyContract.connect(signers.alice).submitFlyScore(encFirst.handles[0], encFirst.inputProof);

    const encLow = await fhevm.createEncryptedInput(fheFlappyAddress, signers.alice.address).add32(lower).encrypt();

    await fheFlappyContract.connect(signers.alice).submitFlyScore(encLow.handles[0], encLow.inputProof);

    const encryptedStored = await fheFlappyContract.getBestScore(signers.alice.address);
    const clearStored = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedStored,
      fheFlappyAddress,
      signers.alice,
    );

    expect(clearStored).to.eq(first);
  });

  it("should keep scores isolated between players", async function () {
    const aliceScore = 55;
    const bobScore = 77;

    const encAlice = await fhevm
      .createEncryptedInput(fheFlappyAddress, signers.alice.address)
      .add32(aliceScore)
      .encrypt();

    const encBob = await fhevm.createEncryptedInput(fheFlappyAddress, signers.bob.address).add32(bobScore).encrypt();

    await fheFlappyContract.connect(signers.alice).submitFlyScore(encAlice.handles[0], encAlice.inputProof);
    await fheFlappyContract.connect(signers.bob).submitFlyScore(encBob.handles[0], encBob.inputProof);

    const encAliceStored = await fheFlappyContract.getBestScore(signers.alice.address);
    const encBobStored = await fheFlappyContract.getBestScore(signers.bob.address);

    const decAlice = await fhevm.userDecryptEuint(FhevmType.euint32, encAliceStored, fheFlappyAddress, signers.alice);

    const decBob = await fhevm.userDecryptEuint(FhevmType.euint32, encBobStored, fheFlappyAddress, signers.bob);

    expect(decAlice).to.eq(aliceScore);
    expect(decBob).to.eq(bobScore);
  });

  it("should correctly report hasSubmittedScore()", async function () {
    const player = signers.alice;

    expect(await fheFlappyContract.hasSubmittedScore(player.address)).to.be.false;

    const encryptedScore = await fhevm.createEncryptedInput(fheFlappyAddress, player.address).add32(50).encrypt();

    await fheFlappyContract.connect(player).submitFlyScore(encryptedScore.handles[0], encryptedScore.inputProof);

    expect(await fheFlappyContract.hasSubmittedScore(player.address)).to.be.true;
  });
});
