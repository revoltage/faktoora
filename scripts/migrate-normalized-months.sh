#!/usr/bin/env bash

set -euo pipefail

DEPLOY_FLAG="--prod"

if [[ "${1:-}" == "--dev" ]]; then
  DEPLOY_FLAG=""
elif [[ "${1:-}" == "--prod" || -z "${1:-}" ]]; then
  DEPLOY_FLAG="--prod"
else
  printf 'Usage: %s [--prod|--dev]\n' "$0" >&2
  exit 1
fi

printf 'Running normalized month backfill %s\n' "${DEPLOY_FLAG:-against dev deployment}"

npx convex run migrations:runAll ${DEPLOY_FLAG}

REPORT_FILE=$(mktemp)
cleanup() {
  rm -f "$REPORT_FILE"
}
trap cleanup EXIT

npx convex run monthMigration:getLatestUserMigrationReportInternal ${DEPLOY_FLAG} > "$REPORT_FILE"

node - "$REPORT_FILE" <<'EOF'
const fs = require("fs");

const reportPath = process.argv[2];
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

if (!report) {
  console.error("No users found in this deployment.");
  process.exit(1);
}

console.log(`Verified user: ${report.userId}`);
console.log(`Months checked: ${report.monthKeys.length}`);
console.log("Overview:");
console.log(JSON.stringify(report.overview, null, 2));
console.log("Per-month status:");
console.log(JSON.stringify(report.months, null, 2));

if (!report.allHealthy) {
  console.error("Migration verification failed.");
  process.exit(1);
}

console.log("Migration verification passed.");
EOF
