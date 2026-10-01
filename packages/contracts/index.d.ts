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
