import { useEffect, useState } from "react";
import { findStory, useStore } from "./lib/store";
import { Reader } from "./components/Reader";
import { Home } from "./components/Home";
import { Library, StoryPage } from "./components/Library";
import { Words } from "./components/Words";
import { Kana } from "./components/Kana";
import { Settings } from "./components/Settings";
import { Generate } from "./components/Generate";
import { Method, Onboarding } from "./components/Onboarding";
import { onTtsProblem } from "./lib/tts";

export const navigate = (path: string) => {
  window.location.hash = path;
};

function useRoute() {
  const read = () => window.location.hash.replace(/^#/, "") || "/";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route.split("/").filter(Boolean).map(decodeURIComponent);
}

const TABS = [
  { path: "/", label: "Today", icon: "☀︎" },
  { path: "/library", label: "Stories", icon: "📚" },
  { path: "/words", label: "Words", icon: "★" },
  { path: "/kana", label: "Kana", icon: "あ" },
  { path: "/settings", label: "Settings", icon: "⚙︎" },
];

export function App() {
  const [section, a, b] = useRoute();
  const onboarded = useStore((s) => s.profile.onboarded);
  useStore((s) => s.generated); // re-render when stories are added

  if (!onboarded) return <Onboarding />;

  if (section === "read" && a) {
    const story = findStory(a);
    return (
      <>
        {story ? <Reader story={story} ch={Number(b) || 0} /> : <NotFound />}
        <AudioNotice />
      </>
    );
  }

  let screen;
  switch (section) {
    case undefined:
      screen = <Home />;
      break;
    case "library":
      screen = <Library />;
      break;
    case "story": {
      const story = a ? findStory(a) : undefined;
      screen = story ? <StoryPage story={story} /> : <NotFound />;
      break;
    }
    case "words":
      screen = <Words />;
      break;
    case "kana":
      screen = <Kana />;
      break;
    case "settings":
      screen = <Settings />;
      break;
    case "new":
      screen = <Generate />;
      break;
    case "method":
      screen = <Method />;
      break;
    default:
      screen = <NotFound />;
  }
  const active = `/${section ?? ""}`;

  return (
    <div className="shell">
      <main>{screen}</main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <a key={t.path} href={`#${t.path}`} className={active === t.path ? "on" : ""}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
      <AudioNotice />
    </div>
  );
}

/** Explains silent audio instead of leaving the user guessing. */
function AudioNotice() {
  const [message, setMessage] = useState("");
  useEffect(() => onTtsProblem(setMessage), []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 7000);
    return () => clearTimeout(t);
  }, [message]);
  return message ? (
    <div className="toast audio-notice" onClick={() => setMessage("")}>
      {message}
    </div>
  ) : null;
}

function NotFound() {
  return (
    <div className="page">
      <h2>Not found</h2>
      <a href="#/">Go home</a>
    </div>
  );
}
