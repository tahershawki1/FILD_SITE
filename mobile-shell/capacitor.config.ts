import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.taher.fieldsite",
  appName: "Field Site",
  webDir: "www",
  server: {
    url: "https://atlas.geotools.workers.dev",
    androidScheme: "https",
    cleartext: false
  }
};

export default config;
