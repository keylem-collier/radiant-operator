import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["@moss-dev/moss", "@moss-dev/moss-core"],
  turbopack: {
    root: appRoot,
  },
};

export default nextConfig;
