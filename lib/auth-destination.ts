export const authReturnCookie = "rf_auth_return";

export function authDestination(value: unknown) {
  if (typeof value !== "string" || value.length > 2048 ||
      !value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) {
    return "/?start=1";
  }
  const url = new URL(value, "https://routine-fit.invalid");
  if (url.pathname === "/import") return "/import";
  if (url.pathname === "/sleep/confirm") {
    const token = url.searchParams.get("token");
    if (token && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
      return "/sleep/confirm?" + new URLSearchParams({ token });
    }
    return "/sleep/confirm";
  }
  return "/?start=1";
}
