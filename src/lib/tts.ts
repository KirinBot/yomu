import { AzureError, azureClip, azureEnabled } from "./azure";
import { getState } from "./store";

// Browser speech synthesis, Japanese voices only.

const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;

export const ttsAvailable = () => !!synth;

const isJapanese = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase().startsWith("ja");

export function japaneseVoices(): SpeechSynthesisVoice[] {
  return (synth?.getVoices() ?? []).filter(isJapanese);
}

export function onVoicesChanged(cb: () => void) {
  synth?.addEventListener("voiceschanged", cb);
  return () => synth?.removeEventListener("voiceschanged", cb);
}

// Proper Japanese voices that ship with Apple, Google and Microsoft systems. The
// first voice in the list is often a novelty one (Eddy, Grandma…) that on iPhone
// may not be downloaded, in which case speech is silently dropped.
const GOOD_VOICES = /kyoko|o-ren|otoya|hattori|google|nanami|haruka|ayumi|ichiro|sayaka/i;

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = japaneseVoices();
  const { voiceURI } = getState().settings;
  return (
    (voiceURI && voices.find((v) => v.voiceURI === voiceURI)) ||
    voices.find((v) => GOOD_VOICES.test(v.name) && v.localService) ||
    voices.find((v) => GOOD_VOICES.test(v.name))
  );
}

// Tell the UI when speech doesn't start, so silence isn't a mystery.
type ProblemListener = (message: string) => void;
const problemListeners = new Set<ProblemListener>();
export function onTtsProblem(cb: ProblemListener) {
  problemListeners.add(cb);
  return () => void problemListeners.delete(cb);
}
const report = (message: string) => problemListeners.forEach((cb) => cb(message));

const NO_START =
  "No sound? On iPhone, turn off silent mode (the switch on the side) and check the volume. Or pick another voice in Settings → Audio.";

// Chrome can garbage-collect an utterance mid-sentence, which loses its onend
// callback; holding a reference prevents that.
const held: SpeechSynthesisUtterance[] = [];
let generation = 0;
let lastCancel = 0;

function utterance(text: string, rate?: number) {
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = "ja-JP";
  u.rate = rate ?? getState().settings.rate;
  return u;
}

/** Speak one utterance, watching for it never starting or failing. */
function say(u: SpeechSynthesisUtterance, gen: number) {
  if (!synth || gen !== generation) return;
  held.splice(0, held.length, u);
  let started = false;
  const watchdog = setTimeout(() => {
    if (!started && gen === generation) report(NO_START);
  }, 3000);
  u.addEventListener("start", () => {
    started = true;
    clearTimeout(watchdog);
  });
  u.addEventListener("end", () => clearTimeout(watchdog));
  u.addEventListener("error", (e) => {
    clearTimeout(watchdog);
    if (gen === generation && e.error !== "interrupted" && e.error !== "canceled")
      report(e.error === "not-allowed" ? "Tap play again to start the audio." : `Audio error: ${e.error}. ${NO_START}`);
  });
  synth.resume(); // Chrome sometimes leaves the queue paused
  synth.speak(u);
}

/**
 * Stop anything playing and start fresh. Safari drops an utterance queued in the
 * same tick as cancel(), so only cancel when needed and then wait a moment.
 */
function restart(run: (gen: number) => void) {
  if (!synth) return;
  const gen = ++generation;
  if (synth.speaking || synth.pending) {
    synth.cancel();
    lastCancel = Date.now();
  }
  const wait = 80 - (Date.now() - lastCancel);
  if (wait > 0) setTimeout(() => run(gen), wait);
  else run(gen);
}

function browserSpeak(text: string, rate?: number) {
  restart((gen) => say(utterance(text, rate), gen));
}

/** Browser voice, sentence by sentence (long single utterances get cut off in some browsers). */
function browserSequence(texts: string[], start: number, onIndex: (i: number | null) => void) {
  if (!synth) return;
  let gen = -1;
  const play = (i: number) => {
    if (gen !== generation) return;
    if (i >= texts.length) {
      onIndex(null);
      return;
    }
    onIndex(i);
    const u = utterance(texts[i]);
    u.addEventListener("end", () => play(i + 1));
    u.addEventListener("error", () => {
      if (gen === generation) onIndex(null);
    });
    say(u, gen);
  };
  restart((g) => {
    gen = g;
    play(start);
  });
}

// --- Azure neural voices --------------------------------------------------------

// One audio element for everything: iOS only lets an element play after it has
// been started once from a tap, and clips arrive after an async fetch.
const audio = typeof Audio !== "undefined" ? new Audio() : undefined;
let audioUnlocked = false;
let clipUrl = "";
let azureFailed = false; // a bad key or region: stop asking Azure until settings change

export const resetAzureFailure = () => {
  azureFailed = false;
};
const useAzure = () => !!audio && azureEnabled() && !azureFailed;

/** A tenth of a second of silence, played on the first tap to unlock the element. */
function silence() {
  const samples = 2400;
  const v = new DataView(new ArrayBuffer(44 + samples * 2));
  const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 24000, true);
  v.setUint32(28, 48000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples * 2, true);
  return URL.createObjectURL(new Blob([v.buffer], { type: "audio/wav" }));
}

function unlockAudio() {
  if (!audio || audioUnlocked) return;
  audioUnlocked = true;
  audio.src = silence();
  audio.play().catch((e: DOMException) => {
    if (e.name === "NotAllowedError") audioUnlocked = false;
  });
}

function playClip(blob: Blob) {
  return new Promise<void>((resolve, reject) => {
    if (!audio) return reject(new Error("no audio"));
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    clipUrl = URL.createObjectURL(blob);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("playback"));
    audio.src = clipUrl;
    audio.play().catch(reject);
  });
}

/** Report an Azure problem; returns false so callers fall back to the browser voice. */
function azureProblem(e: unknown) {
  if (e instanceof AzureError) {
    if (e.fatal) azureFailed = true;
    report(`${e.message} Using the built-in voice for now.`);
  } else if (e instanceof DOMException && e.name === "NotAllowedError") {
    audioUnlocked = false;
    report("Tap play again to start the audio.");
  } else report("Couldn't play the Azure audio. Using the built-in voice for now.");
}

async function azureSpeak(text: string, rate: number, gen: number) {
  try {
    const blob = await azureClip(text, rate);
    if (gen === generation) await playClip(blob);
  } catch (e) {
    if (gen !== generation) return;
    azureProblem(e);
    if (!(e instanceof DOMException)) browserSpeak(text, rate);
  }
}

async function azureSequence(texts: string[], start: number, onIndex: (i: number | null) => void, gen: number) {
  const { rate } = getState().settings;
  for (let i = start; i < texts.length; i++) {
    if (gen !== generation) return;
    onIndex(i);
    try {
      const blob = await azureClip(texts[i], rate);
      if (gen !== generation) return;
      if (i + 1 < texts.length) azureClip(texts[i + 1], rate).catch(() => {}); // fetch ahead
      await playClip(blob);
    } catch (e) {
      if (gen !== generation) return;
      azureProblem(e);
      if (e instanceof DOMException) onIndex(null);
      else browserSequence(texts, i, onIndex);
      return;
    }
  }
  if (gen === generation) onIndex(null);
}

// --- Public API -------------------------------------------------------------------

export function speak(text: string, rate?: number) {
  if (useAzure()) {
    unlockAudio();
    stopSpeaking();
    azureSpeak(text, rate ?? getState().settings.rate, generation);
  } else browserSpeak(text, rate);
}

let sequenceId = 0;

/** Read sentences in order, reporting which one is playing. Returns a stop function. */
export function speakSequence(texts: string[], start: number, onIndex: (i: number | null) => void) {
  const id = ++sequenceId;
  if (useAzure()) {
    unlockAudio();
    stopSpeaking();
    azureSequence(texts, start, onIndex, generation);
  } else browserSequence(texts, start, onIndex);
  return () => {
    if (id === sequenceId) stopSpeaking();
    onIndex(null);
  };
}

export const stopSpeaking = () => {
  generation++;
  held.length = 0;
  audio?.pause();
  if (synth && (synth.speaking || synth.pending)) {
    synth.cancel();
    lastCancel = Date.now();
  }
};
