import { useState } from "react";
import { COMBO_ROWS, DAKUTEN_ROWS, HIRAGANA_ROWS, kanaToRomaji, toKatakana } from "../lib/kana";
import { speak } from "../lib/tts";

export function Kana() {
  const [kata, setKata] = useState(false);
  const show = (s: string) => (kata ? toKatakana(s) : s);

  const cell = (c: string, i: number, row: number) =>
    c === "・" ? (
      <span key={`${row}-${i}`} className="kana-cell empty" />
    ) : (
      <button key={`${row}-${i}`} className="kana-cell" onClick={() => speak(c, 0.7)}>
        <span className="kana">{show(c)}</span>
        <span className="muted small">{kanaToRomaji(c)}</span>
      </button>
    );

  return (
    <div className="page">
      <h1>Kana</h1>
      <p className="muted">
        A reference, not homework. You'll pick these up from reading: romaji fades word by word as you get to know
        each word. Tap a sound to hear it.
      </p>
      <div className="seg wide">
        <button className={!kata ? "on" : ""} onClick={() => setKata(false)}>
          Hiragana ひらがな
        </button>
        <button className={kata ? "on" : ""} onClick={() => setKata(true)}>
          Katakana カタカナ
        </button>
      </div>
      <p className="muted small">
        {kata
          ? "Katakana: foreign words and names (パン bread, ドア door), plus emphasis."
          : "Hiragana: grammar endings, particles and many everyday words."}
      </p>
      <div className="kana-grid">{HIRAGANA_ROWS.flatMap((row, r) => [...row].map((c, i) => cell(c, i, r)))}</div>
      <h3>With ゛ and ゜</h3>
      <div className="kana-grid">{DAKUTEN_ROWS.flatMap((row, r) => [...row].map((c, i) => cell(c, i, r)))}</div>
      <h3>Combinations</h3>
      <div className="kana-grid three">{COMBO_ROWS.flatMap((row, r) => row.map((c, i) => cell(c, i, r)))}</div>
      <h3>Little tricks</h3>
      <ul className="tips">
        <li>
          <span className="jp-inline">{show("っ")}</span> small tsu doubles the next sound:{" "}
          <span className="jp-inline">{show("ちょっと")}</span> = chotto
        </li>
        <li>
          <span className="jp-inline">ー</span> lengthens a vowel in katakana: <span className="jp-inline">コーヒー</span> = koohii
        </li>
        <li>
          Particles <span className="jp-inline">は へ を</span> are read wa, e, o.
        </li>
      </ul>
    </div>
  );
}
