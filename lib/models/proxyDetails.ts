import type { ProxyCompany } from "@/types/model";

export const PROXY_COMPANY_LABELS: Record<ProxyCompany, string> = {
  proxy_empire: "Proxy Empire",
  other: "Outro",
};

const PROXY_IP_PATTERN =
  /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(:\d{1,5})?$/;

export function isProxyCompany(value: string): value is ProxyCompany {
  return value === "proxy_empire" || value === "other";
}

// IPv4, optionally with a port (48.45.165.230 or 48.45.165.230:8080).
export function isValidProxyIp(value: string): boolean {
  if (!PROXY_IP_PATTERN.test(value)) {
    return false;
  }

  const port = value.split(":")[1];

  return port === undefined || (Number(port) >= 1 && Number(port) <= 65535);
}
