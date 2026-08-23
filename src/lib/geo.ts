import { cacheConfig, geocodeConfig } from '@/config';
import { cached } from '@/lib/cache';

export type GeoPoint = { lat: number; lng: number };

type NominatimSearchResult = { lat: string; lon: string };
type NominatimReverseResult = { display_name?: string };

async function fetchNominatim<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const url = new URL(`${geocodeConfig.baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('format', 'json');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), geocodeConfig.timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': geocodeConfig.userAgent, Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function geocode(query: string): Promise<GeoPoint | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  return cached(`geocode:${trimmed.toLowerCase()}`, cacheConfig.geocodeMs, async () => {
    const results = await fetchNominatim<NominatimSearchResult[]>('/search', {
      q: trimmed,
      countrycodes: geocodeConfig.countryCodes,
      limit: '1'
    });

    const match = results?.[0];
    if (!match) return null;

    const lat = Number(match.lat);
    const lng = Number(match.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  });
}

export type GeoSuggestion = { label: string; lat: number; lng: number };

export async function searchLocations(query: string, limit = 5): Promise<GeoSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return cached(`location-search:${limit}:${trimmed.toLowerCase()}`, cacheConfig.geocodeMs, async () => {
    const results = await fetchNominatim<Array<NominatimSearchResult & { display_name: string }>>('/search', {
      q: trimmed,
      countrycodes: geocodeConfig.countryCodes,
      addressdetails: '0',
      limit: String(limit)
    });

    if (!results) return [];

    return results
      .map((result) => {
        const lat = Number(result.lat);
        const lng = Number(result.lon);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { label: result.display_name, lat, lng } : null;
      })
      .filter((suggestion): suggestion is GeoSuggestion => suggestion !== null);
  });
}

export async function reverseGeocode(point: GeoPoint): Promise<string | null> {
  return cached(`reverse-geocode:${point.lat.toFixed(5)},${point.lng.toFixed(5)}`, cacheConfig.geocodeMs, async () => {
    const result = await fetchNominatim<NominatimReverseResult>('/reverse', {
      lat: String(point.lat),
      lon: String(point.lng),
      zoom: '16'
    });

    return result?.display_name ?? null;
  });
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function googleMapsLink(point: GeoPoint | null, fallbackQuery?: string | null): string | null {
  if (point) return `https://www.google.com/maps?q=${point.lat},${point.lng}`;
  if (fallbackQuery && fallbackQuery.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery.trim())}`;
  }
  return null;
}
