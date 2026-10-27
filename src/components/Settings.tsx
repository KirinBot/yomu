import { useEffect, useState } from "react";
import { LEVELS, MODELS } from "../lib/claude";
import { getState, update, useStore, type Aid, type State } from "../lib/store";
import { japaneseVoices, onVoicesChanged, speak } from "../lib/tts";

export function Settings() {
  const settings = useStore((s) => s.settings);
  const profile = useStore((s) => s.profile);
  const [voices, setVoices] = useState(japaneseVoices);
  useEffect(() => onVoicesChanged(() => setVoices(japaneseVoices())), []);

  const set = <K extends keyof State["settings"]>(k: K, v: State["settings"][K]) =>
    update((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));
  const setProfile = <K extends keyof State["profile"]>(k: K, v: State["profile"][K]) =>
    update((s) => ({ ...s, profile: { ...s.profile, [k]: v } }));

  const exportData = () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `yomu-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as State;
      if (!data.profile || !data.words) throw new Error();
      if (confirm("Replace everything in this browser with the backup?")) update(() => data);
    } catch {
      alert("That file isn't a Yomu backup.");
    }
  };

  return (
    <div className="page settings">
      <h1>Settings</h1>

      <section className="card">
        <h3>You</h3>
        <label className="field">
          <span>Name</span>
          <input value={profile.name} onChange={(e) => setProfile("name", e.target.value)} />
        </label>
        <label className="field">
          <span>
            Level: <strong>{LEVELS[Math.floor(profile.level)].name}</strong> ({profile.level.toFixed(1)})
          </span>
          <input
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={profile.level}
            onChange={(e) => setProfile("level", Number(e.target.value))}
          />
          <span className="muted small">Adjusts by itself after each chapter. Move it only if stories feel way off.</span>
        </label>
        <label className="field">
          <span>Sentences per chapter (generated stories): {profile.chapterSentences}</span>
          <input
            type="range"
            min={6}
            max={40}
            value={profile.chapterSentences}
            onChange={(e) => setProfile("chapterSentences", Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>What you love in a story</span>
          <textarea rows={6} value={profile.interests} onChange={(e) => setProfile("interests", e.target.value)} />
        </label>
      </section>

      <section className="card">
        <h3>Reading aids</h3>
        <AidField label="Romaji under words" value={settings.romaji} onChange={(v) => set("romaji", v)} />
        <AidField label="Furigana over kanji" value={settings.furigana} onChange={(v) => set("furigana", v)} />
        <label className="row">
          <span>Spaces between words</span>
          <input type="checkbox" checked={settings.spacing} onChange={(e) => set("spacing", e.target.checked)} />
        </label>
        <label className="row">
          <span>Strict mode (no lookups)</span>
          <input type="checkbox" checked={settings.strict} onChange={(e) => set("strict", e.target.checked)} />
        </label>
        <label className="field">
          <span>Text size: {settings.fontSize}px</span>
          <input
            type="range"
            min={18}
            max={36}
            value={settings.fontSize}
            onChange={(e) => set("fontSize", Number(e.target.value))}
          />
        </label>
      </section>

      <section className="card">
        <h3>Audio</h3>
        {voices.length === 0 ? (
          <p className="muted small">
            No Japanese voice found in this browser. On a Mac: System Settings → Accessibility → Spoken Content → System
            voice → Manage Voices → Japanese (Kyoko or O-ren). Then reload.
          </p>
        ) : (
          <label className="field">
            <span>Voice</span>
            <select value={settings.voiceURI} onChange={(e) => set("voiceURI", e.target.value)}>
              <option value="">Default Japanese voice</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Speed: {settings.rate.toFixed(2)}×</span>
          <input
            type="range"
            min={0.5}
            max={1.2}
            step={0.05}
            value={settings.rate}
            onChange={(e) => set("rate", Number(e.target.value))}
          />
        </label>
        <button className="btn" onClick={() => speak("こんにちは。 きょうも すこし よみましょう。")}>
          🔊 Test voice
        </button>
      </section>

      <section className="card">
        <h3>Story writer (Claude)</h3>
        <label className="field">
          <span>Anthropic API key</span>
          <input
            type="password"
            value={settings.apiKey}
            placeholder="sk-ant-…"
            autoComplete="off"
            onChange={(e) => set("apiKey", e.target.value.trim())}
          />
          <span className="muted small">
            Stored only in this browser and sent only to Anthropic. Get one at console.anthropic.com. Don't use this
            app on a shared computer with your key saved.
          </span>
        </label>
        <label className="field">
          <span>Model</span>
          <select value={settings.model} onChange={(e) => set("model", e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Effort</span>
          <select value={settings.effort} onChange={(e) => set("effort", e.target.value as State["settings"]["effort"])}>
            <option value="high">High: most careful stories</option>
            <option value="medium">Medium: faster, cheaper</option>
            <option value="low">Low: fastest</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h3>Your data</h3>
        <p className="muted small">Everything lives in this browser. Back it up to move to another device.</p>
        <div className="stack-row">
          <button className="btn" onClick={exportData}>
            Export backup
          </button>
          <label className="btn">
            Import backup
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </label>
          <button
            className="btn ghost danger"
            onClick={() => {
              if (confirm("Erase all progress, words and stories in this browser?")) {
                localStorage.clear();
                location.reload();
              }
            }}
          >
            Reset everything
          </button>
        </div>
      </section>
    </div>
  );
}

function AidField({ label, value, onChange }: { label: string; value: Aid; onChange: (v: Aid) => void }) {
  return (
    <div className="row">
      <span>{label}</span>
      <div className="seg">
        {(["auto", "always", "off"] as Aid[]).map((v) => (
          <button key={v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
