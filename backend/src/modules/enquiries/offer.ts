export const WEBSITE_PACKAGES = ['business', 'starter', 'growth', 'pro', 'custom'] as const;
export const SUPPORT_PLANS = ['care', 'support-growth', 'automation'] as const;

export type Offer =
  | { type: 'website'; id: (typeof WEBSITE_PACKAGES)[number] }
  | { type: 'support'; id: (typeof SUPPORT_PLANS)[number] };

export function findOffer(value: string): Offer | undefined {
  const website = WEBSITE_PACKAGES.find((id) => id === value);
  if (website) return { type: 'website', id: website };
  const support = SUPPORT_PLANS.find((id) => id === value);
  if (support) return { type: 'support', id: support };
}
