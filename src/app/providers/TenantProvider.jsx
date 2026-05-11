/**
 * Loads the current tenant's cross-cutting data once and shares it with every
 * feature via a small set of hooks:
 *
 *   useAgency()     â†’ { name, plan, logo, color, ... } from the active agency
 *   useSocials()    â†’ social networks fetched from `/v1/admin/agencies/{id}/social-accounts`
 *   useVariables()  â†’ list of {{tag}} placeholders for descriptions (static)
 *   useSocial(id)   â†’ convenience lookup for a single network by id
 *
 * Rendered once near the root so sub-trees don't refetch. The provider is
 * driven by `useCurrentAgency()` from the session, so all features render
 * data scoped to the agency that the GHL session resolves to.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api/client.js';
import { useCurrentAgency } from '../../features/session/index.js';

const TenantContext = createContext(/** @type {any} */(null));

const STATIC_VARIABLES = [
  { key: 'property_title', sample: '2-bed apartment Â· Cranford Court' },
  { key: 'price', sample: 'â‚¬385,000' },
  { key: 'bedrooms', sample: '2' },
  { key: 'bathrooms', sample: '1' },
  { key: 'size_m2', sample: '68' },
  { key: 'property_type', sample: 'Apartment' },
  { key: 'city', sample: 'Dublin 4' },
  { key: 'neighborhood', sample: 'Stillorgan' },
  { key: 'eircode', sample: 'D04 K3F8' },
  { key: 'short_description', sample: 'Bright 2-bed apartment in a sought-after development.' },
  { key: 'agent_name', sample: 'Marvin Farrell' },
  { key: 'agent_phone', sample: '085 118 5832' },
  { key: 'booking_link', sample: 'ckpestateagents.ie/view/r8832' },
];

const PLATFORM_PRESETS = {
  instagram: { name: 'Instagram', icon: 'instagram', color: '#E1306C' },
  tiktok: { name: 'TikTok', icon: 'tiktok', color: '#111111' },
  youtube: { name: 'YouTube', icon: 'youtube', color: '#FF0033' },
  facebook: { name: 'Facebook', icon: 'facebook', color: '#1877F2' },
  linkedin: { name: 'LinkedIn', icon: 'linkedin', color: '#0A66C2' },
  gbp: { name: 'Google Business', icon: 'google-business', color: '#4285F4' },
  gmb: { name: 'Google Business', icon: 'google-business', color: '#4285F4' },
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
  const desiredOrder = ['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'gbp'];
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
    const matching = byPlatform.get(platform) || byPlatform.get(platform === 'gbp' ? 'gmb' : platform) || [];
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
