import { getState } from "./store";

// Browser speech synthesis, Japanese voices only.

const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;

export const ttsAvailable = () => !!synth;

export function japaneseVoices(): SpeechSynthesisVoice[] {
  return (synth?.getVoices() ?? []).filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("ja"));
}

export function onVoicesChanged(cb: () => void) {
  synth?.addEventListener("voiceschanged", cb);
  return () => synth?.removeEventListener("voiceschanged", cb);
}

function utterance(text: string, rate?: number) {
  const u = new SpeechSynthesisUtterance(text);
  const { voiceURI, rate: defaultRate } = getState().settings;
  const voices = japaneseVoices();
  const voice = voices.find((v) => v.voiceURI === voiceURI) ?? voices[0];
  if (voice) u.voice = voice;
  u.lang = "ja-JP";
  u.rate = rate ?? defaultRate;
  return u;
}

export function speak(text: string, rate?: number) {
  if (!synth) return;
  synth.cancel();
  synth.speak(utterance(text, rate));
}

/**
 * Read sentences one at a time (long single utterances get cut off in some
 * browsers) and report which sentence is playing. Returns a stop function.
 */
export function speakSequence(texts: string[], start: number, onIndex: (i: number | null) => void) {
  if (!synth) return () => {};
  synth.cancel();
  let stopped = false;
  const play = (i: number) => {
    if (stopped) return;
    if (i >= texts.length) {
      onIndex(null);
      return;
    }
    onIndex(i);
    const u = utterance(texts[i]);
    u.onend = () => play(i + 1);
    u.onerror = () => {
      if (!stopped) onIndex(null);
    };
    synth.speak(u);
  };
  play(start);
  return () => {
    stopped = true;
    synth.cancel();
    onIndex(null);
  };
}

export const stopSpeaking = () => synth?.cancel();
