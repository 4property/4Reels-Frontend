/**
 * Loads the current tenant's cross-cutting data once and shares it with every
 * feature via a small set of hooks:
 *
 *   useAgency()     → { name, plan, logo, color, ... } from the active agency
 *   useSocials()    → social networks fetched from `/v1/admin/agencies/{id}/social-accounts`
 *   useVariables()  → list of {{tag}} placeholders for descriptions (static)
 *   useSocial(id)   → convenience lookup for a single network by id
 *
 * Rendered once near the root so sub-trees don't refetch. The provider is
 * driven by `useCurrentAgency()` from the session, so all features render
 * data scoped to the agency that the GHL session resolves to.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api/client.js';
import { useCurrentAgency } from '../../features/session/index.js';
import { ALLOWED_SOCIAL_TEMPLATE_VARIABLES } from '../../features/social/constants.js';

const TenantContext = createContext(/** @type {any} */(null));

// Per-key sample copy shown on chip hover and used by the live preview. Keys
// MUST be a subset of `ALLOWED_SOCIAL_TEMPLATE_VARIABLES` so a single edit in
// `features/social/constants.js` propagates here without having to touch two
// places. The order of `STATIC_VARIABLES` (and therefore the chip row) is the
// order of the canonical array, which groups property → location →
// descriptive → agent → links.
const VARIABLE_SAMPLES = {
  property_title: '2-bed apartment · Cranford Court',
  price: '€385,000',
  bedrooms: '2',
  bathrooms: '1',
  size_m2: '68',
  property_type: 'Apartment',
  city: 'Dublin 4',
  neighborhood: 'Stillorgan',
  neighborhood_tag: 'cranfordcourt',
  eircode: 'D04 K3F8',
  short_description: 'Bright 2-bed apartment in a sought-after development.',
  agent_name: 'Marvin Farrell',
  agent_phone: '085 118 5832',
  agent_email: 'sales@4pm.ie',
  booking_link: 'https://ckpestateagents.ie/view/r8832',
  property_url: 'https://example.com/property/123',
};

const STATIC_VARIABLES = ALLOWED_SOCIAL_TEMPLATE_VARIABLES.map((key) => ({
  key,
  sample: VARIABLE_SAMPLES[key] ?? '',
}));

const PLATFORM_PRESETS = {
  instagram: { name: 'Instagram', icon: 'instagram', color: '#E1306C' },
  tiktok: { name: 'TikTok', icon: 'tiktok', color: '#111111' },
  youtube: { name: 'YouTube', icon: 'youtube', color: '#FF0033' },
  facebook: { name: 'Facebook', icon: 'facebook', color: '#1877F2' },
  linkedin: { name: 'LinkedIn', icon: 'linkedin', color: '#0A66C2' },
  gbp: { name: 'Google Business', icon: 'google-business', color: '#4285F4' },
  gmb: { name: 'Google Business', icon: 'google-business', color: '#4285F4' },
  pinterest: { name: 'Pinterest', icon: 'pinterest', color: '#E60023' },
};

export function TenantProvider({ children }) {
  const { agency: detail, agencyId, loading: agencyLoading, error: agencyError } = useCurrentAgency();

  const [socials, setSocials] = useState([]);
  const [socialsLoading, setSocialsLoading] = useState(false);
  const [socialsError, setSocialsError] = useState(null);

  const reloadSocials = useMemo(
    () => async () => {
      if (!agencyId) {
        setSocials([]);
        return;
      }
      setSocialsLoading(true);
      setSocialsError(null);
      try {
        const response = await apiRequest(
          `/v1/admin/agencies/${encodeURIComponent(agencyId)}/social-accounts`,
        );
        setSocials(adaptSocialAccounts(response));
      } catch (err) {
        setSocials(adaptSocialAccounts({ items: [] }));
        setSocialsError(err);
      } finally {
        setSocialsLoading(false);
      }
    },
    [agencyId],
  );

  useEffect(() => {
    reloadSocials();
  }, [reloadSocials]);

  const profile = detail?.reel_profile || null;

  const agency = useMemo(() => {
    const baseAgency = detail?.agency || null;
    if (!baseAgency) {
      return {
        name: agencyId ? agencyId.slice(0, 8) : 'No agency',
        agencyId: agencyId || '',
        slug: '',
        timezone: 'UTC',
        plan: 'MVP',
        logo: '',
        color: profile?.brand_primary_color || '#0F172A',
      };
    }
    return {
      name: baseAgency.name,
      agencyId: baseAgency.agency_id,
      slug: baseAgency.slug,
      timezone: baseAgency.timezone,
      status: baseAgency.status,
      plan: 'MVP',
      logo: '',
      color: profile?.brand_primary_color || '#0F172A',
      reelProfile: profile,
    };
  }, [detail, agencyId, profile]);

  const value = {
    agency,
    agencyId,
    socials,
    variables: STATIC_VARIABLES,
    loading: Boolean(agencyLoading || socialsLoading),
    error: agencyError || socialsError,
    refetch: () => {
      reloadSocials();
    },
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

function adaptSocialAccounts(response) {
  const desiredOrder = [
    'instagram',
    'tiktok',
    'youtube',
    'facebook',
    'linkedin',
    'gbp',
    'pinterest',
  ];
  const items = Array.isArray(response?.items) ? response.items : [];
  const byPlatform = new Map();
  for (const account of items) {
    const platform = String(account.platform || '').toLowerCase();
    if (!platform) continue;
    if (!byPlatform.has(platform)) byPlatform.set(platform, []);
    byPlatform.get(platform).push(account);
  }
  return desiredOrder.map((platform) => {
    const preset = PLATFORM_PRESETS[platform] || {
      name: platform,
      icon: 'share',
      color: '#666',
    };
    const matching =
      byPlatform.get(platform) ||
      byPlatform.get(platform === 'gbp' ? 'gmb' : platform) ||
      byPlatform.get(platform === 'pinterest' ? 'pin' : platform) ||
      [];
    const account = matching[0];
    return {
      id: platform,
      name: preset.name,
      icon: preset.icon,
      color: preset.color,
      connected: Boolean(account && !account.is_expired),
      handle: account?.name || null,
      accountId: account?.id || null,
      accountType: account?.account_type || null,
      isExpired: Boolean(account?.is_expired),
    };
  });
}

function useTenantContext() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('Tenant hooks must be used inside <TenantProvider>');
  return ctx;
}

export function useAgency() {
  return useTenantContext().agency;
}

export function useSocials() {
  return useTenantContext().socials;
}

export function useVariables() {
  return useTenantContext().variables;
}

export function useSocial(id) {
  return useSocials().find((s) => s.id === id) || null;
}

export function useTenantStatus() {
  const { loading, error, refetch } = useTenantContext();
  return { loading, error, refetch };
}
