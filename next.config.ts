import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

// Points at ./i18n/request.ts, which is the default location the plugin looks
// for. Passing it explicitly keeps the wiring visible to whoever reads this
// file next.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin/amplia/:path*",
        destination: "/admin/socialmediamodels/:path*",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
