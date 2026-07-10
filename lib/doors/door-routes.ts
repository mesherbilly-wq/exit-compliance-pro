export function getDoorProfileHref(doorName: string): string {
  return `/doors/${encodeURIComponent(doorName)}`;
}

export function decodeDoorParam(doorParam: string): string {
  try {
    return decodeURIComponent(doorParam);
  } catch {
    return doorParam;
  }
}
