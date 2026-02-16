import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const versionPath = path.resolve(rootDir, "../field-site/version.json");
const swPath = path.resolve(rootDir, "../field-site/sw.js");

const versionRaw = fs.readFileSync(versionPath, "utf8");
const versionJson = JSON.parse(versionRaw);
const appVersion = String(versionJson.version || "").trim();

if (!appVersion) {
  throw new Error("version.json is missing a valid `version` value.");
}

const nextCacheVersion = `v${appVersion}`;
const swRaw = fs.readFileSync(swPath, "utf8");
const updatedSw = swRaw.replace(
  /const CACHE_VERSION = ".*";/,
  `const CACHE_VERSION = "${nextCacheVersion}";`
);

if (swRaw !== updatedSw) {
  fs.writeFileSync(swPath, updatedSw, "utf8");
  console.log(`[sync-sw-version] Updated CACHE_VERSION -> ${nextCacheVersion}`);
} else {
  console.log(`[sync-sw-version] CACHE_VERSION already ${nextCacheVersion}`);
}
