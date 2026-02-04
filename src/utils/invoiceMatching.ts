// ===========================================
// SCORING CONFIGURATION - easy to adjust
// ===========================================
const SCORING_CONFIG = {
  // Weight distribution (should sum to 1.0)
  weights: {
    amount: 0.7,  // How important is amount matching (0-1)
    name: 0.3,    // How important is name/description matching (0-1)
  },
  // Amount scoring parameters
  amount: {
    perfectMatchThreshold: 0.01,  // Amounts within 1% are considered perfect
    maxDeviationPercent: 50,      // Beyond 50% deviation, score is 0
  },
};

/**
 * Parse invoice amount from format "EUR|123.45" or "123.45"
 */
function parseInvoiceAmount(amountStr: string | undefined): { currency?: string; value: number } | null {
  if (!amountStr) return null;
  const parts = amountStr.split("|");
  if (parts.length === 2) {
    return { currency: parts[0], value: parseFloat(parts[1]) };
  }
  const val = parseFloat(amountStr);
  return isNaN(val) ? null : { value: val };
}

/**
 * Simple fuzzy string similarity (0-1)
 * Uses token overlap and substring matching
 */
function fuzzyMatch(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Token-based matching
  const tokens1 = s1.split(/[\s\-_.,]+/).filter(t => t.length > 2);
  const tokens2 = s2.split(/[\s\-_.,]+/).filter(t => t.length > 2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  let matchCount = 0;
  for (const t1 of tokens1) {
    for (const t2 of tokens2) {
      if (t1 === t2) {
        matchCount += 1;
      } else if (t1.includes(t2) || t2.includes(t1)) {
        matchCount += 0.5;
      }
    }
  }

  const maxPossible = Math.max(tokens1.length, tokens2.length);
  return Math.min(1, matchCount / maxPossible);
}

/**
 * Calculate match score between transaction and invoice (0-1)
 */
export function calculateMatchScore(
  transaction: { amount?: string; paymentCurrency?: string; description?: string } | null | undefined,
  invoice: { name?: string; fileName?: string; analysis?: { amount?: { value?: string } } }
): number {
  if (!transaction) return 0;

  const { weights, amount: amountConfig } = SCORING_CONFIG;

  let amountScore = 0;
  let nameScore = 0;

  // Amount scoring
  const txAmount = transaction.amount ? parseFloat(transaction.amount) : null;
  const invAmountData = parseInvoiceAmount(invoice.analysis?.amount?.value);

  if (txAmount && invAmountData) {
    const invAmount = invAmountData.value;
    const diff = Math.abs(txAmount - invAmount);
    const percentDiff = (diff / Math.max(txAmount, invAmount)) * 100;

    if (percentDiff <= amountConfig.perfectMatchThreshold * 100) {
      amountScore = 1;
    } else if (percentDiff >= amountConfig.maxDeviationPercent) {
      amountScore = 0;
    } else {
      // Linear interpolation between perfect and max deviation
      amountScore = 1 - (percentDiff / amountConfig.maxDeviationPercent);
    }
  }

  // Name/description scoring
  const txDesc = transaction.description || "";
  const invName = invoice.name || invoice.fileName || "";
  nameScore = fuzzyMatch(txDesc, invName);

  // Weighted combination
  return (amountScore * weights.amount) + (nameScore * weights.name);
}
