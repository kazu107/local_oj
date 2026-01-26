export function getApiBase(): string {
  if (process.env.API_INTERNAL_URL) {
    return process.env.API_INTERNAL_URL;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return "http://localhost:4000";
}
