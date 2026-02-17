import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  API_KEY_PREFIX,
  computeApiKeyHash,
  extractBearerToken,
} from "./apiKeyUtils";

const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function authenticateUploadWriteScope(ctx: any, request: Request) {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token || !token.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  const keyHash = await computeApiKeyHash(token);
  const apiKey = await ctx.runQuery(
    (internal as any).apiKeys.getApiKeyByHashInternal,
    {
      keyHash,
    },
  );

  if (!apiKey || apiKey.revokedAt) {
    return null;
  }

  if (!apiKey.scopes.includes("upload:write")) {
    return false;
  }

  await ctx.runMutation((internal as any).apiKeys.touchApiKeyUsageInternal, {
    apiKeyId: apiKey._id,
  });

  return apiKey.userId;
}

function isValidMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_KEY_REGEX.test(value);
}

function isValidString(value: unknown, maxLength = 255): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

export const createUploadUrl = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authResult = await authenticateUploadWriteScope(ctx, request);
  if (authResult === null) {
    return json(401, { error: "Unauthorized" });
  }
  if (authResult === false) {
    return json(403, { error: "Forbidden" });
  }

  const body = await parseJsonBody(request);
  if (!body || (body.kind !== "invoice" && body.kind !== "statement")) {
    return json(400, { error: "Invalid request body" });
  }

  const uploadUrl = await ctx.runMutation(
    internal.invoices.generateUploadUrlInternal,
    {},
  );
  return json(200, { uploadUrl });
});

export const registerInvoice = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authResult = await authenticateUploadWriteScope(ctx, request);
  if (authResult === null) {
    return json(401, { error: "Unauthorized" });
  }
  if (authResult === false) {
    return json(403, { error: "Forbidden" });
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return json(400, { error: "Invalid request body" });
  }

  const { monthKey, storageId, fileName } = body;
  if (!isValidMonthKey(monthKey)) {
    return json(400, { error: "monthKey must be YYYY-MM" });
  }
  if (!isValidString(storageId, 128)) {
    return json(400, { error: "storageId is required" });
  }
  if (!isValidString(fileName, 255)) {
    return json(400, { error: "fileName is required" });
  }

  try {
    await ctx.runMutation(
      (internal as any).invoices.addIncomingInvoiceForUserInternal,
      {
        monthKey,
        storageId: storageId as any,
        fileName,
        userId: authResult,
      },
    );
    return json(201, { ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to register invoice";
    return json(400, { error: message });
  }
});

export const registerStatement = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const authResult = await authenticateUploadWriteScope(ctx, request);
  if (authResult === null) {
    return json(401, { error: "Unauthorized" });
  }
  if (authResult === false) {
    return json(403, { error: "Forbidden" });
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return json(400, { error: "Invalid request body" });
  }

  const { monthKey, storageId, fileName, fileType, csvContent } = body;
  if (!isValidMonthKey(monthKey)) {
    return json(400, { error: "monthKey must be YYYY-MM" });
  }
  if (!isValidString(storageId, 128)) {
    return json(400, { error: "storageId is required" });
  }
  if (!isValidString(fileName, 255)) {
    return json(400, { error: "fileName is required" });
  }
  if (fileType !== "pdf" && fileType !== "csv") {
    return json(400, { error: "fileType must be 'pdf' or 'csv'" });
  }
  if (fileType === "csv" && !isValidString(csvContent, 5000000)) {
    return json(400, { error: "csvContent is required for csv statements" });
  }

  try {
    await ctx.runMutation(
      (internal as any).invoices.addStatementForUserInternal,
      {
        monthKey,
        storageId: storageId as any,
        fileName,
        fileType,
        csvContent,
        userId: authResult,
      },
    );
    return json(201, { ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to register statement";
    return json(400, { error: message });
  }
});
