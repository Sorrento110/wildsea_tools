/** POSIX-safe base path with a trailing slash (GitHub Pages may run under a sub-path). */
export function baseUrl(): string {
  return import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}