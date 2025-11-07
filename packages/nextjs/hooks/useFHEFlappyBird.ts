"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import {
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

export const useFHEFlappyBird = (params: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = params;
  const { storage: decryptionStorage } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;

  const { data: flappyContract } = useDeployedContractInfo({
    contractName: "FHEFlappyBird",
    chainId: allowedChainId,
  });

  type FHEFlappyBirdInfo = Contract<"FHEFlappyBird"> & { chainId?: number };

  const [message, setMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [bestScore, setBestScore] = useState<any>();

  const hasContract = Boolean(flappyContract?.address && flappyContract?.abi);
  const hasSigner = Boolean(ethersSigner);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(flappyContract!.address, (flappyContract as FHEFlappyBirdInfo).abi, providerOrSigner);
  };

  // Fetch player's top Flappy Bird score
  const fetchTopFlyScore = useCallback(async () => {
    if (!hasContract || !accounts?.[0]) return;
    try {
      const readContract = getContract("read");
      if (!readContract) return;
      const res = await readContract.getBestScore(accounts[0]);
      setBestScore({ handle: res, contractAddress: flappyContract!.address });
    } catch (err) {
      console.warn("fetchTopFlyScore failed:", err);
    }
  }, [hasContract, flappyContract?.address, accounts]);

  const initTopFlyScore = useRef(false);
  useEffect(() => {
    if (ethersReadonlyProvider && ethersReadonlyProvider && !initTopFlyScore.current) {
      initTopFlyScore.current = true;
      fetchTopFlyScore();
    }
  }, [ethersSigner, ethersReadonlyProvider]);
  
  // FHE decrypt
  const {
    decrypt,
    canDecrypt,
    isDecrypting,
    message: decryptMsg,
    results,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage: decryptionStorage,
    chainId,
    requests: bestScore ? [bestScore] : undefined,
  });

  useEffect(() => {
    if (decryptMsg) setMessage(decryptMsg);
  }, [decryptMsg]);

  const decryptResult = decrypt;

  // FHE encrypt
  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: flappyContract?.address,
  });

  const canSubmit = useMemo(
    () => Boolean(hasContract && instance && hasSigner && !isProcessing),
    [hasContract, instance, hasSigner, isProcessing],
  );

  const getEncryptionMethodFor = (fnName: "submitFlyScore") => {
    const functionAbi = flappyContract?.abi.find(item => item.type === "function" && item.name === fnName);
    if (!functionAbi) {
      return { method: undefined as string | undefined, error: `Function ABI not found for ${fnName}` };
    }
    if (!functionAbi.inputs || functionAbi.inputs.length === 0) {
      return { method: undefined as string | undefined, error: `No inputs found for ${fnName}` };
    }
    const firstInput = functionAbi.inputs[0]!;
    return { method: getEncryptionMethod(firstInput.internalType), error: undefined };
  };

  // Submit new Flappy Bird score
  const submitFlyScore = useCallback(
    async (score: number) => {
      if (isProcessing || !canSubmit) return;
      setIsProcessing(true);
      setMessage(`Submitting Flappy Bird score (${score})...`);
      try {
        const { method, error } = getEncryptionMethodFor("submitFlyScore");
        if (!method) return setMessage(error ?? "Encryption method not found");

        setMessage(`Encrypting score with ${method}...`);
        const encrypted = await encryptWith(builder => {
          (builder as any)[method](score);
        });
        if (!encrypted) return setMessage("Encryption failed");

        const writeContract = getContract("write");
        if (!writeContract) return setMessage("Contract or signer unavailable");

        const params = buildParamsFromAbi(encrypted, [...flappyContract!.abi] as any[], "submitFlyScore");
        const tx = await writeContract.submitFlyScore(...params, { gasLimit: 300_000 });
        setMessage("Waiting for transaction confirmation...");
        await tx.wait();
        setMessage(`Flappy Bird score (${score}) submitted!`);
        await fetchTopFlyScore();
      } catch (e) {
        setMessage(`submitFlyScore() failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canSubmit, encryptWith, getContract, fetchTopFlyScore, flappyContract?.abi],
  );

  useEffect(() => {
    setMessage("");
  }, [accounts, chainId]);

  return {
    contractAddress: flappyContract?.address,
    canDecrypt,
    decryptResult,
    submitFlyScore,
    fetchTopFlyScore,
    bestScore,
    results,
    isDecrypting,
    isProcessing,
    canSubmit,
    chainId,
    accounts,
    isConnected,
    ethersSigner,
    message,
  };
};
