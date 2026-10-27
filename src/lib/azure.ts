import { getState } from "./store";

// Azure AI Speech neural voices, called straight from the browser with the
// user's own key. Every clip is saved in IndexedDB, so a sentence is only ever
// synthesised once per voice and speed: rereads are free and work offline.

export const AZURE_VOICES = [
  { id: "ja-JP-NanamiNeural", label: "Nanami (female, warm narrator)" },
  { id: "ja-JP-KeitaNeural", label: "Keita (male, calm)" },
  { id: "ja-JP-AoiNeural", label: "Aoi (female, bright)" },
  { id: "ja-JP-DaichiNeural", label: "Daichi (male, deeper)" },
  { id: "ja-JP-ShioriNeural", label: "Shiori (female, soft)" },
  { id: "ja-JP-NaokiNeural", label: "Naoki (male, light)" },
  { id: "ja-JP-MayuNeural", label: "Mayu (female, youthful)" },
];

/** "West Europe" → "westeurope", the form the endpoint needs. */
export const normalizeRegion = (r: string) => r.toLowerCase().replace(/[^a-z0-9]/g, "");

export const azureEnabled = () => {
  const { azureKey, azureRegion } = getState().settings;
  return !!(azureKey && azureRegion);
};

export class AzureError extends Error {
  constructor(
    message: string,
    readonly fatal: boolean, // true when retrying won't help (bad key, wrong region)
  ) {
    super(message);
  }
}

// --- IndexedDB clip cache ---------------------------------------------------

const DB = "yomu-audio";
const STORE = "clips";
let dbPromise: Promise<IDBDatabase> | null = null;

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const store = (await db()).transaction(STORE, mode).objectStore(STORE);
  return new Promise((resolve, reject) => {
    const req = run(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const cacheGet = (key: string) => tx<Blob | undefined>("readonly", (s) => s.get(key)).catch(() => undefined);
const cachePut = (key: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, key)).catch(() => undefined);

export const savedClipCount = () => tx<number>("readonly", (s) => s.count()).catch(() => 0);
export const clearSavedClips = () => tx("readwrite", (s) => s.clear());

// --- Synthesis ----------------------------------------------------------------

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const inflight = new Map<string, Promise<Blob>>();

/** Audio for one piece of text, from the cache or freshly synthesised. */
export function azureClip(text: string, rate: number): Promise<Blob> {
  const { azureVoice } = getState().settings;
  const pct = Math.round((rate - 1) * 100);
  const key = `${azureVoice}|${pct}|${text}`;
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      const cached = await cacheGet(key);
      if (cached) return cached;
      const blob = await synthesize(text, azureVoice, pct);
      await cachePut(key, blob);
      return blob;
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

async function synthesize(text: string, voice: string, pct: number): Promise<Blob> {
  const { azureKey, azureRegion } = getState().settings;
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ja-JP">` +
    `<voice name="${voice}"><prosody rate="${pct >= 0 ? "+" : ""}${pct}%">${escapeXml(text)}</prosody></voice></speak>`;
  // The free tier allows about 20 requests a minute, so wait and retry when throttled.
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`https://${normalizeRegion(azureRegion)}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": azureKey,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        },
        body: ssml,
      });
    } catch {
      throw new AzureError("Couldn't reach Azure. Check the region name and your connection.", false);
    }
    if (res.ok) return res.blob();
    if (res.status === 401 || res.status === 403)
      throw new AzureError("Azure rejected the key. Check the key and that the region matches it.", true);
    if (res.status === 400) throw new AzureError("Azure didn't accept that voice. Pick another in Settings.", true);
    if (res.status === 429 && attempt < 4) {
      await sleep(Number(res.headers.get("Retry-After")) * 1000 || 3000 * (attempt + 1));
      continue;
    }
    throw new AzureError(
      res.status === 429 ? "Azure's free tier limit was hit. Wait a minute, or switch the resource to Standard." : `Azure error ${res.status}.`,
      false,
    );
  }
}
