export function assetPath(baseUrl: string, path: string): string {
  const base = baseUrl ? (baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`) : '/';
  return `${base}${path.replace(/^\/+/, '')}`;
}
