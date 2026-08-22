import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pestco.app",
  appName: "Pest.Co",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
