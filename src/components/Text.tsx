import { Fragment } from "react";
import { wordKey, type Sentence, type Token } from "../lib/dsl";
import { furiganaParts, readingOf, tokenRomaji } from "../lib/kana";
import { wordStatus, type Aid, type State } from "../lib/store";

const PARTICLES = new Set(["は", "が", "を", "に", "で", "の", "と", "から", "も", "へ", "か", "ね", "よ", "まで", "や", "より", "って"]);
const COPULA = new Set(["です", "だ", "でした", "だった", "でしょう", "じゃ"]);
const OPENERS = new Set(["「", "『", "（", "("]);

/**
 * Children's-book style word spacing (分かち書き): a gap between words, but
 * particles and です stay attached to the word before them.
 */
function gapBetween(t: Token, next: Token | undefined) {
  if (!next || OPENERS.has(t.s)) return false;
  if (next.punct) return OPENERS.has(next.s);
  if (t.punct) return !t.s.startsWith("…");
  return !PARTICLES.has(next.s) && !COPULA.has(next.s);
}

/** Group a word with its particles and punctuation so lines never start with は or 。 */
function groups(tokens: Token[]) {
  const out: number[][] = [];
  tokens.forEach((t, i) => {
    const prev = tokens[i - 1];
    const attach =
      out.length &&
      ((t.punct && !OPENERS.has(t.s)) ||
        OPENERS.has(prev.s) ||
        (!prev.punct && (PARTICLES.has(t.s) || COPULA.has(t.s))));
    if (attach) out[out.length - 1].push(i);
    else out.push([i]);
  });
  return out;
}

export const showAid = (mode: Aid, status: string) => mode === "always" || (mode === "auto" && status !== "known");

export const sentenceSpeech = (s: Sentence) => s.tokens.map((t) => t.s).join("");
export const tokenSpeech = (t: Token) => (t.s === "は" ? "わ" : t.s === "へ" ? "え" : readingOf(t));

interface Props {
  sentence: Sentence;
  words: State["words"];
  settings: State["settings"];
  active?: boolean;
  selected?: Token | null;
  highlightPatterns?: boolean;
  onTap?: (t: Token, el: HTMLElement) => void;
}

export function SentenceView({ sentence, words, settings, active, selected, highlightPatterns, onTap }: Props) {
  const { tokens } = sentence;
  const renderToken = (t: Token, i: number) => {
    if (t.punct)
      return (
        <span key={i} className="punct">
          {t.s}
        </span>
      );
    const w = words[wordKey(t)];
    const status = wordStatus(w);
    const romaji = showAid(settings.romaji, status) ? tokenRomaji(t) : "";
    const furigana = showAid(settings.furigana, status);
    const cls = ["tok", w?.saved && "saved", selected === t && "selected", highlightPatterns && t.p && "pattern", onTap && "tappable"]
      .filter(Boolean)
      .join(" ");
    return (
      <span key={i} className={cls} onClick={onTap ? (e) => onTap(t, e.currentTarget) : undefined}>
        <span className="jp">
          {furiganaParts(t.s, t.r).map((p, j) =>
            p.ruby && furigana ? (
              <ruby key={j}>
                {p.text}
                <rt>{p.ruby}</rt>
              </ruby>
            ) : (
              <Fragment key={j}>{p.text}</Fragment>
            ),
          )}
        </span>
        {settings.romaji !== "off" && <span className="rm">{romaji || "\u00a0"}</span>}
      </span>
    );
  };

  return (
    <span className={`sentence${active ? " speaking" : ""}`}>
      {groups(tokens).map((g) => {
        const last = g[g.length - 1];
        return (
          <Fragment key={g[0]}>
            <span className="grp">{g.map((i) => renderToken(tokens[i], i))}</span>
            {settings.spacing && (last === tokens.length - 1 || gapBetween(tokens[last], tokens[last + 1])) ? (
              <span className="gap"> </span>
            ) : (
              <wbr />
            )}
          </Fragment>
        );
      })}
    </span>
  );
}
