export type HelperLinkRule = {
  keywords: string[];
  links: string[];
};

function expandLinkTemplate(link: string, description: string) {
  const normalizedDescription = description.trim();
  const query = normalizedDescription.toLowerCase().replace(/\s+/g, "+");

  return link
    .replaceAll("{query}", query)
    .replaceAll("{description}", encodeURIComponent(normalizedDescription));
}

function parseHelperLinkRules(
  value: string | null | undefined,
): HelperLinkRule[] {
  if (!value) return [];

  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const separator = line.includes("|") ? "|" : "=>";
      const separatorIndex = line.indexOf(separator);
      if (separatorIndex === -1) return null;

      const keywords = line
        .slice(0, separatorIndex)
        .split(",")
        .map((keyword) => keyword.trim().toLowerCase())
        .filter(Boolean);
      const links = line
        .slice(separatorIndex + separator.length)
        .split(",")
        .map((link) => link.trim())
        .filter(Boolean);

      if (keywords.length === 0 || links.length === 0) return null;
      return { keywords, links };
    })
    .filter((rule): rule is HelperLinkRule => rule !== null);
}

export function getInvoiceHelperLinks(
  description: string,
  configuredRules: string | null | undefined,
) {
  const desc = description.toLowerCase();

  return parseHelperLinkRules(configuredRules)
    .filter(({ keywords }) =>
      keywords.some((keyword) => keyword === "*" || desc.includes(keyword)),
    )
    .flatMap(({ links }) =>
      links.map((link) => expandLinkTemplate(link, description)),
    );
}
