export const runtime = "nodejs";

import { createWalletClient, http, parseUnits, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { createL2Headers } from "./clob-auth";
import type { SignedOrder, OrderResponse, ApiCreds } from "./types";

const CLOB_BASE = "https://clob.polymarket.com";
const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const NEG_RISK_ADAPTER = "0xC5d563A36AE78145C45a50134d48A1215220f80a";
const CHAIN_ID = parseInt(process.env.POLYMARKET_CHAIN_ID ?? "137");

function bigintToHex(n: bigint): string {
  return "0x" + n.toString(16).padStart(64, "0");
}

export async function buildAndSignOrder(params: {
  privateKey: string;
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  negRisk?: boolean;
  signatureType?: 0 | 1 | 2;
}): Promise<SignedOrder> {
  const { privateKey, tokenId, side, price, size, negRisk = false, signatureType = 0 } = params;

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const client = createWalletClient({ account, chain: polygon, transport: http() });

  // Convert amounts to 6-decimal USDC units
  // For BUY: maker gives USDC (makerAmount), taker gives tokens (takerAmount)
  const usdcAmount = BigInt(Math.round(size * 1e6));
  const tokenAmount = BigInt(Math.round((size / price) * 1e6));

  const salt = BigInt(Math.floor(Math.random() * 1e18));
  const expiration = BigInt(0); // no expiration (GTC)
  const nonce = BigInt(0);

  const verifyingContract = negRisk ? NEG_RISK_ADAPTER : CTF_EXCHANGE;

  const order = {
    salt,
    maker: account.address as `0x${string}`,
    signer: account.address as `0x${string}`,
    taker: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    tokenId: BigInt(tokenId),
    makerAmount: side === "BUY" ? usdcAmount : tokenAmount,
    takerAmount: side === "BUY" ? tokenAmount : usdcAmount,
    expiration,
    nonce,
    feeRateBps: BigInt(0),
    side: side === "BUY" ? 0 : 1,
    signatureType,
  };

  const signature = await client.signTypedData({
    domain: {
      name: "Polymarket CTF Exchange",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: verifyingContract as `0x${string}`,
    },
    types: {
      Order: [
        { name: "salt", type: "uint256" },
        { name: "maker", type: "address" },
        { name: "signer", type: "address" },
        { name: "taker", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "makerAmount", type: "uint256" },
        { name: "takerAmount", type: "uint256" },
        { name: "expiration", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "feeRateBps", type: "uint256" },
        { name: "side", type: "uint8" },
        { name: "signatureType", type: "uint8" },
      ],
    },
    primaryType: "Order",
    message: order,
  });

  return {
    salt: order.salt.toString(),
    maker: account.address,
    signer: account.address,
    taker: "0x0000000000000000000000000000000000000000",
    tokenId,
    makerAmount: order.makerAmount.toString(),
    takerAmount: order.takerAmount.toString(),
    expiration: "0",
    nonce: "0",
    feeRateBps: "0",
    side: side === "BUY" ? 0 : 1,
    signatureType,
    signature,
  };
}

export async function postOrder(
  signedOrder: SignedOrder,
  creds: ApiCreds,
  orderType: "GTC" | "FOK" = "GTC"
): Promise<OrderResponse> {
  const body = JSON.stringify({ order: signedOrder, orderType });
  const path = "/order";
  const headers = await createL2Headers(creds, "POST", path, body);

  const res = await fetch(`${CLOB_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    return { success: false, errorMsg: `${res.status}: ${text}` };
  }

  const data = await res.json();
  return {
    success: true,
    orderId: data.orderId ?? data.orderID,
    orderHash: data.orderHash,
  };
}
