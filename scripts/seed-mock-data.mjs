#!/usr/bin/env node

import { readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";

const mockDir = join(import.meta.dirname, "..", ".mock");
const files = readdirSync(mockDir);

const payload = files.map((name) => {
  const filePath = join(mockDir, name);
  const buffer = readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const type = name.endsWith(".pdf") ? "invoice" : "statement";
  return { name, base64, type };
});

console.log(
  `Found ${payload.length} files: ${payload.filter((f) => f.type === "invoice").length} invoices, ${payload.filter((f) => f.type === "statement").length} statements`
);

// Write args to a temp file to avoid CLI arg length limits
const tmpFile = join(tmpdir(), `seed-mock-${Date.now()}.json`);
writeFileSync(tmpFile, JSON.stringify({ files: payload }));

try {
  const result = execSync(`npx convex run seed:seedMockData --args "$(cat ${tmpFile})"`, {
    cwd: join(import.meta.dirname, ".."),
    stdio: "inherit",
  });
} finally {
  unlinkSync(tmpFile);
}

console.log("Done!");
