export interface YogaClass {
  id: string;
  name: string;
  instructor: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  booked: number;
}
export interface CafeProduct {
  id: string;
  name: string;
  category: "coffee" | "tea" | "food" | "retail";
  priceMinor: number;
  currency: string;
}
export interface StudioOverview {
  mode: "live";
  classes: YogaClass[];
  products: CafeProduct[];
}

export type Locale = 'es-MX' | 'en';
export type BusinessUnitCode = 'studio' | 'cafe';
export interface PublicSettings {
  displayName: string;
  currency: 'MXN';
  timezone: string;
  defaultLocale: Locale;
  supportedLocales: Locale[];
  units: { code: BusinessUnitCode; labels: Record<Locale, string> }[];
}
export type ApiErrorCode = 'UNAVAILABLE' | 'INVALID_REQUEST' | 'NOT_FOUND' | 'INTERNAL_ERROR';
