const GOOGLE_USER_INDEX = 0;

const HELPER_LINKS = [
  {
    keywords: ["linkedin"],
    links: [
      "https://www.linkedin.com/manage/purchases-payments?account=240994474",
    ],
  },
  {
    keywords: ["fal.ai", "features labels"],
    links: ["https://fal.ai/dashboard/billing"],
  },
  {
    keywords: ["cursor", "anysphere"],
    links: ["https://www.cursor.com/settings"],
  },
  {
    keywords: ["t3 chat"],
    links: ["https://t3.chat/settings/subscription"],
  },
  {
    keywords: ["vercel"],
    links: ["https://vercel.com/account/settings/invoices"],
  },
  {
    keywords: ["clicky"],
    links: ["https://clicky.com/user/payments"],
  },
  {
    keywords: ["github"],
    links: ["https://github.com/account/billing/history"],
  },
  {
    keywords: ["discord"],
    links: ["https://discord.com/channels/@me"],
  },
  {
    keywords: ["ozone"],
    links: ["https://www.ozone.bg/customerutils/return/invoice"],
  },
  {
    keywords: ["stability"],
    links: [`https://mail.google.com/mail/u/${GOOGLE_USER_INDEX}/#search/stability+invoice`],
  },
  {
    keywords: ["stackblitz"],
    links: [`https://mail.google.com/mail/u/${GOOGLE_USER_INDEX}/#search/stackblitz+invoice`],
  },
  {
    keywords: ["google cloud", "google*cloud"],
    links: [`https://mail.google.com/mail/u/${GOOGLE_USER_INDEX}/#search/google+cloud+invoice`],
  },
  {
    keywords: ["google workspace"],
    links: [
      "https://mail.google.com/mail/u/0/#search/google+workspace+invoice",
    ],
  },
  {
    keywords: ["zoho"],
    links: ["https://store.zoho.eu/html/store/mytransaction.html"],
  },
  {
    keywords: ["digital ocean"],
    links: [`https://mail.google.com/mail/u/${GOOGLE_USER_INDEX}/#search/digital+ocean+invoice`],
  },
  {
    keywords: ["krea"],
    links: [`https://mail.google.com/mail/u/${GOOGLE_USER_INDEX}/#search/krea+invoice`],
  },
  {
    keywords: ["huggingface"],
    links: [
      `https://mail.google.com/mail/u/${GOOGLE_USER_INDEX}/#search/hugging+face+invoice`,
      "https://huggingface.co/settings/billing",
    ],
  },
  {
    keywords: ["ardes"],
    links: ["https://ardes.bg/rw/ordershistory"],
  },
] as const;

function makeDefaultLinks(description: string) {
  return [
    `https://mail.google.com/mail/u/${GOOGLE_USER_INDEX}/#search/${description.toLowerCase()}+invoice`,
  ];
}

export function getInvoiceHelperLinks(description: string) {
  const desc = description.toLowerCase();
  const results = HELPER_LINKS.filter(({ keywords }) =>
    keywords.some((keyword) => desc.includes(keyword.toLowerCase()))
  ).flatMap(({ links }) => links);

  if (results.length === 0) {
    return makeDefaultLinks(description);
  }

  return results;
}
