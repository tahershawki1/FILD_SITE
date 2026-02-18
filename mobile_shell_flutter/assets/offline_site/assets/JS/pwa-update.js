(() => {
  if (!("serviceWorker" in navigator)) return;

  const banner = document.getElementById("updateBanner");
  const updateNowBtn = document.getElementById("btnUpdateNow");
  const laterBtn = document.getElementById("btnLater");
  const updateText = document.getElementById("updateText");
  const VERSION_KEY = "field_site_seen_version";

  let registrationRef = null;
  let waitingWorker = null;
  let refreshing = false;
  let latestVersion = "";

  function showUpdateBanner(version) {
    if (!banner) return;
    if (updateText && version) {
      updateText.textContent = `نسخة جديدة (${version}) متاحة للتطبيق.`;
    } else if (updateText) {
      updateText.textContent = "نسخة جديدة متاحة للتطبيق.";
    }
    banner.hidden = false;
  }

  function hideUpdateBanner() {
    if (!banner) return;
    banner.hidden = true;
  }

  function rememberVersion(version) {
    if (!version) return;
    try {
      localStorage.setItem(VERSION_KEY, version);
    } catch (_) {}
  }

  function getRememberedVersion() {
    try {
      return localStorage.getItem(VERSION_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  async function fetchLatestVersion() {
    try {
      const response = await fetch("./version.json", { cache: "no-store" });
      if (!response.ok) return "";
      const payload = await response.json();
      return payload.version || "";
    } catch (_) {
      return "";
    }
  }

  async function markWorkerWaiting(worker) {
    if (!worker) return;
    waitingWorker = worker;
    if (!latestVersion) {
      latestVersion = await fetchLatestVersion();
    }
    showUpdateBanner(latestVersion);
  }

  async function detectVersionChangeOnly() {
    latestVersion = await fetchLatestVersion();
    if (!latestVersion) return;

    const seen = getRememberedVersion();
    if (!seen) {
      rememberVersion(latestVersion);
      return;
    }

    if (seen !== latestVersion) {
      showUpdateBanner(latestVersion);
    }
  }

  async function checkForUpdates() {
    if (!registrationRef) return;

    await registrationRef.update().catch(() => {});
    if (registrationRef.waiting) {
      await markWorkerWaiting(registrationRef.waiting);
      return;
    }

    await detectVersionChangeOnly();
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    if (latestVersion) {
      rememberVersion(latestVersion);
    }
    window.location.reload();
  });

  if (updateNowBtn) {
    updateNowBtn.addEventListener("click", async () => {
      if (waitingWorker) {
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
        return;
      }

      await checkForUpdates();
      if (!waitingWorker) {
        if (latestVersion) rememberVersion(latestVersion);
        window.location.reload();
      }
    });
  }

  if (laterBtn) {
    laterBtn.addEventListener("click", hideUpdateBanner);
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");
      registrationRef = registration;
      console.log("SW registered:", registration);

      latestVersion = await fetchLatestVersion();
      if (latestVersion && !getRememberedVersion()) {
        rememberVersion(latestVersion);
      }

      if (registration.waiting) {
        await markWorkerWaiting(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener("statechange", async () => {
          if (
            installingWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            await markWorkerWaiting(installingWorker);
          }
        });
      });

      setInterval(checkForUpdates, 45 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          checkForUpdates();
        }
      });
    } catch (registrationError) {
      console.log("SW registration failed:", registrationError);
    }
  });
})();
