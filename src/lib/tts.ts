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

export function speak(text: string, rate?: number) {
  restart((gen) => say(utterance(text, rate), gen));
}

/**
 * Read sentences one at a time (long single utterances get cut off in some
 * browsers) and report which sentence is playing. Returns a stop function.
 */
export function speakSequence(texts: string[], start: number, onIndex: (i: number | null) => void) {
  if (!synth) return () => {};
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
  return () => {
    if (gen === generation || gen === -1) stopSpeaking();
    onIndex(null);
  };
}

export const stopSpeaking = () => {
  generation++;
  held.length = 0;
  synth?.cancel();
  lastCancel = Date.now();
};
