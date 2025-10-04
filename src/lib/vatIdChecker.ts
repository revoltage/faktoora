/**
 * Checks if the user's VAT ID is found in the parsed text
 * @param parsedText - The parsed text from the invoice
 * @param userVatId - The user's VAT ID from settings
 * @returns Object with found status and match details
 */
export function checkVatIdInText(parsedText: string | null, userVatId: string | null | undefined) {
  if (!parsedText || !userVatId) {
    return {
      found: false,
      match: null,
      reason: !parsedText ? 'No parsed text' : 'No VAT ID configured'
    };
  }

  // Remove all whitespace from both the parsed text and VAT ID
  const normalizedText = parsedText.replace(/\s+/g, '');
  const normalizedVatId = userVatId.replace(/\s+/g, '');

  // Check for exact match (case insensitive)
  const found = normalizedText.toLowerCase().includes(normalizedVatId.toLowerCase());
  
  if (found) {
    // Find the actual match in the original text for display
    const regex = new RegExp(userVatId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const match = parsedText.match(regex);
    
    return {
      found: true,
      match: match?.[0] || userVatId,
      reason: 'VAT ID found'
    };
  }

  return {
    found: false,
    match: null,
    reason: 'VAT ID not found in parsed text'
  };
}
