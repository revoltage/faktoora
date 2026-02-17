export const API_KEY_PREFIX = "sk_faktoora_";

const textEncoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateApiKey(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return `${API_KEY_PREFIX}${toHex(randomBytes)}`;
}

export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, API_KEY_PREFIX.length + 8);
}

export async function computeApiKeyHash(apiKey: string): Promise<string> {
  const pepper = process.env.API_KEY_PEPPER;
  if (!pepper) {
    throw new Error("API key auth is not configured");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(apiKey),
  );

  return toHex(new Uint8Array(signature));
}

export function extractBearerToken(
  authorizationHeader: string | null,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim();
}
