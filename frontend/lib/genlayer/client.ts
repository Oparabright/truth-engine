import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { createWalletClient, custom } from "viem";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const rpcUrl =
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ||
  "https://studio-dev.genlayer.com/api";

export const genlayerClient = createClient({
  chain: studioDevnet,
  endpoint: rpcUrl,
});

export async function getWalletClient() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  const walletClient = createWalletClient({
    chain: {
      id: 61997,
      name: "GenLayer Studio Dev",
      nativeCurrency: {
        name: "GEN",
        symbol: "GEN",
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: [rpcUrl],
        },
      },
    },
    transport: custom(window.ethereum),
  });

  return walletClient;
}

export async function connectWallet() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  return accounts[0] as `0x${string}`;
}