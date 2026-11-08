/** Route codes for a fictional ferry parcel desk. Pure lookup, no I/O. */
const ROUTE_CODES: Readonly<Record<string, string>> = {
  east: "HR-EAST-14",
  west: "HR-WEST-07",
  north: "HR-NORTH-03",
};

export function routeCode(lane: string): string | undefined {
  return ROUTE_CODES[lane];
}

export function knownLanes(): string[] {
  return Object.keys(ROUTE_CODES);
}
