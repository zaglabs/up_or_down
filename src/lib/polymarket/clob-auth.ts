export const runtime = "nodejs";

import { createWalletClient, http, keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import type { ApiCreds } from "./types";

const CLOB_BASE = "https://clob.polymarket.com";

// Nonce generation
let nonceCounter = 0;
function generateNonce(): string {
  return String(++nonceCounter);
}

// L1 EIP-712 auth headers for creating API keys
export async function createL1Headers(privateKey: string): Promise<Record<string, string>> {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const client = createWalletClient({ account, chain: polygon, transport: http() });

  const signature = await client.signTypedData({
    domain: {
      name: "ClobAuthDomain",
      version: "1",
      chainId: 137,
    },
    types: {
      ClobAuth: [
        { name: "address", type: "address" },
        { name: "timestamp", type: "string" },
        { name: "nonce", type: "uint256" },
        { name: "message", type: "string" },
      ],
    },
    primaryType: "ClobAuth",
    message: {
      address: account.address,
      timestamp,
      nonce: BigInt(nonce),
      message: "This message attests that I control the given wallet",
    },
  });

  return {
    POLY_ADDRESS: account.address,
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: timestamp,
    POLY_NONCE: nonce,
  };
}

// L2 HMAC-SHA256 signing for trading endpoints
export async function createL2Headers(
  creds: ApiCreds,
  method: string,
  path: string,
  body?: string
): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method.toUpperCase() + path + (body ?? "");

  const keyData = Buffer.from(creds.secret, "base64");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, Buffer.from(message));
  const signature = Buffer.from(signatureBuffer).toString("base64");

  return {
    POLY_ADDRESS: creds.key, // reuse key field for address
    POLY_SIGNATURE: signature,
    POLY_TIMESTAMP: timestamp,
    POLY_API_KEY: creds.key,
    POLY_PASSPHRASE: creds.passphrase,
  };
}

export async function createOrDeriveApiCreds(privateKey: string): Promise<ApiCreds> {
  const l1Headers = await createL1Headers(privateKey);

  const res = await fetch(`${CLOB_BASE}/auth/api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...l1Headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to derive API creds: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    key: data.apiKey,
    secret: data.secret,
    passphrase: data.passphrase,
  };
}

export function getAddressFromKey(privateKey: string): string {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return account.address;
}
