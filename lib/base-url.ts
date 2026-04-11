function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getBaseUrl(): string {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase) return trimTrailingSlash(envBase);

  if (typeof window !== "undefined" && window.location?.origin) {
    return trimTrailingSlash(window.location.origin);
  }

  return "http://localhost:3000";
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBaseUrl()}${normalizedPath}`;
}
