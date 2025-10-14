export function basename(p?: string) {
  if (!p) return undefined;
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}
