import type { Store } from '../types';

export const STORES: Store[] = [
  { id: 'sainsburys', name: "Sainsbury's", tier: 'mid' },
  { id: 'tesco', name: 'Tesco', tier: 'mid' },
  { id: 'lidl', name: 'Lidl', tier: 'budget' },
  { id: 'aldi', name: 'Aldi', tier: 'budget' },
  { id: 'waitrose', name: 'Waitrose', tier: 'premium' },
  { id: 'mands', name: 'M&S Food', tier: 'premium' },
  { id: 'morrisons', name: 'Morrisons', tier: 'mid' },
  { id: 'asda', name: 'Asda', tier: 'mid' },
  { id: 'coop', name: 'Co-op', tier: 'mid' },
];

export const STORES_BY_ID: Record<string, Store> = Object.fromEntries(
  STORES.map((s) => [s.id, s]),
);
