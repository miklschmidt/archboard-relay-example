/** Flat fictional surcharge by route prefix. Not a price list for a real carrier. */
const SURCHARGES: Readonly<Record<string, number>> = {
  "HR-EAST": 125,
  "HR-WEST": 80,
  "HR-NORTH": 210,
};

export function quoteSurcharge(routeCode: string): number | undefined {
  const prefix = Object.keys(SURCHARGES).find((key) => routeCode.startsWith(key));
  return prefix === undefined ? undefined : SURCHARGES[prefix];
}
