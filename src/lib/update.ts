import { useSyncExternalStore } from "react";

// Phones keep GitHub Pages' index.html for a while, and an app on the home screen
// can hold on to it for much longer, so new versions wouldn't show up. On open and
// whenever the app comes back to the foreground, compare our script with the
// live page's and load the new version.

const SCRIPT = /assets\/index-[\w-]+\.js/;
const TRIED = "yomu:update-tried";

let ready = false;
const listeners = new Set<() => void>();

const currentScript = () =>
  Array.from(document.scripts)
    .map((s) => s.src.match(SCRIPT)?.[0])
    .find(Boolean);

async function latestScript() {
  const res = await fetch(`./?check=${Date.now()}`, { cache: "no-store" });
  return res.ok ? (await res.text()).match(SCRIPT)?.[0] : undefined;
}

/** Reload from a fresh URL so no cached copy of the page can be reused. */
export const reloadFresh = () => location.replace(`${location.pathname}?v=${Date.now()}${location.hash}`);

export function watchForUpdates() {
  if (import.meta.env.DEV) return;
  const openedAt = Date.now();
  const check = async () => {
    try {
      const latest = await latestScript();
      const current = currentScript();
      if (!latest || !current || latest === current) return;
      // Right after opening, nothing is lost by reloading at once. Only try that once
      // per version, in case the server is briefly still handing out the old page.
      let tried = "";
      try {
        tried = sessionStorage.getItem(TRIED) ?? "";
        sessionStorage.setItem(TRIED, latest);
      } catch {}
      if (Date.now() - openedAt < 4000 && tried !== latest) return reloadFresh();
      ready = true;
      listeners.forEach((l) => l());
    } catch {
      // offline: keep using this version
    }
  };
  check();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const useUpdateReady = () => useSyncExternalStore(subscribe, () => ready);
