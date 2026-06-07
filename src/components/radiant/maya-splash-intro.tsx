"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const SPLASH_INTRO_ENABLED = true; // set false to skip the intro animation

const SPLASH_CONFIG = {
  name: "Maya",
  tagline: "Your voice-first paid media strategist.",
  staggerMs: 38,
  holdMs: 520,
  riseMs: 620,
  tagMs: 750,
  bg: "bloom" as const,
};

const INTRO_STEPS = [
  { id: "welcome", holdMs: SPLASH_CONFIG.holdMs },
  { id: "problem", holdMs: 2600 },
  { id: "help", holdMs: 3000 },
  { id: "talk", holdMs: 3000 },
  { id: "generate", holdMs: 3000 },
] as const;

const START_DELAY_MS = 250;
const STEP_TRANSITION_MS = 360;
const EXIT_MS = 600;

type IntroStepId = (typeof INTRO_STEPS)[number]["id"];

type MayaSplashIntroProps = {
  children: ReactNode;
};

type SplashPhase = "waiting" | "playing" | "clearing" | "done";

function getRevealTiming(name: string) {
  const { staggerMs, riseMs, tagMs } = SPLASH_CONFIG;
  const glyphCount = name.length;
  const revealTime = (glyphCount - 1) * staggerMs + riseMs;
  const tagDelay = Math.max(0, revealTime - 0.35 * riseMs);
  const totalReveal = tagDelay + tagMs;
  return { revealTime, tagDelay, totalReveal };
}

function IntroStepContent({
  stepId,
  playing,
  tagDelay,
  glyphs,
}: {
  stepId: IntroStepId;
  playing: boolean;
  tagDelay: number;
  glyphs: string[];
}) {
  if (stepId === "welcome") {
    return (
      <div className="maya-splash-intro overflow-visible">
        <div className="maya-splash-wordmark overflow-visible" aria-hidden="true">
          {glyphs.map((glyph, index) => (
            <span key={`${glyph}-${index}`} className="maya-splash-mask">
              <span
                className="maya-splash-glyph"
                style={{
                  animationDelay:
                    playing ? `${index * SPLASH_CONFIG.staggerMs}ms` : undefined,
                }}
              >
                {glyph}
              </span>
            </span>
          ))}
        </div>

        {SPLASH_CONFIG.tagline && (
          <p
            className="maya-splash-tagline"
            style={{
              animationDelay: playing ? `${tagDelay}ms` : undefined,
            }}
          >
            {SPLASH_CONFIG.tagline}
          </p>
        )}
      </div>
    );
  }

  if (stepId === "problem") {
    return (
      <div className="maya-splash-step-content">
        <h2 className="maya-splash-headline">
          Hey, are you a founder
          <br />
          that struggles with advertising?
        </h2>
      </div>
    );
  }

  if (stepId === "help") {
    return (
      <div className="maya-splash-step-content">
        <h2 className="maya-splash-headline">
          Maya&apos;s here to help.
        </h2>
        <ul className="maya-splash-examples" aria-label="Example challenges">
          <li className="maya-splash-example" style={{ animationDelay: "120ms" }}>
            <span className="maya-splash-example-dot" aria-hidden="true" />
            My ads aren&apos;t converting
          </li>
          <li className="maya-splash-example" style={{ animationDelay: "220ms" }}>
            <span className="maya-splash-example-dot" aria-hidden="true" />
            I don&apos;t know what creative to test
          </li>
        </ul>
      </div>
    );
  }

  if (stepId === "talk") {
    return (
      <div className="maya-splash-step-content">
        <h2 className="maya-splash-headline">Hold to talk.</h2>
        <p className="maya-splash-body">
          Share your ad challenges, then release.
          <br />
          Maya listens and responds.
        </p>
        <div className="maya-splash-talk-demo" aria-hidden="true">
          <button type="button" tabIndex={-1} className="maya-splash-talk-button">
            Hold to talk
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="maya-splash-step-content">
      <h2 className="maya-splash-headline">Maya creates for you.</h2>
      <p className="maya-splash-body">
        She proactively generates
        <br />
        image and video ads from your conversation.
      </p>
      <div className="maya-splash-ad-previews" aria-hidden="true">
        <div className="maya-splash-ad-card">
          <div className="maya-splash-ad-thumb maya-splash-ad-thumb--image">
            <span className="maya-splash-ad-icon" aria-hidden="true">
              ◻
            </span>
          </div>
          <span className="maya-splash-ad-label">Image ad</span>
        </div>
        <div className="maya-splash-ad-card">
          <div className="maya-splash-ad-thumb maya-splash-ad-thumb--video">
            <span className="maya-splash-ad-icon" aria-hidden="true">
              ▶
            </span>
          </div>
          <span className="maya-splash-ad-label">Video ad</span>
        </div>
      </div>
    </div>
  );
}

export function MayaSplashIntro({ children }: MayaSplashIntroProps) {
  const [phase, setPhase] = useState<SplashPhase>(
    SPLASH_INTRO_ENABLED ? "waiting" : "done",
  );
  const [stepIndex, setStepIndex] = useState(0);
  const timersRef = useRef<number[]>([]);
  const glyphs = useMemo(() => SPLASH_CONFIG.name.split(""), []);

  useEffect(() => {
    if (!SPLASH_INTRO_ENABLED) {
      setPhase("done");
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }

    const timers = timersRef.current;
    const { totalReveal } = getRevealTiming(SPLASH_CONFIG.name);
    let elapsed = START_DELAY_MS;

    timers.push(window.setTimeout(() => setPhase("playing"), START_DELAY_MS));

    elapsed += totalReveal + INTRO_STEPS[0].holdMs;

    for (let index = 1; index < INTRO_STEPS.length; index += 1) {
      const step = INTRO_STEPS[index];
      timers.push(
        window.setTimeout(() => setStepIndex(index), elapsed),
      );
      elapsed += STEP_TRANSITION_MS + step.holdMs;
    }

    timers.push(window.setTimeout(() => setPhase("clearing"), elapsed));
    timers.push(
      window.setTimeout(() => setPhase("done"), elapsed + EXIT_MS),
    );

    return () => {
      timers.forEach(window.clearTimeout);
      timersRef.current = [];
    };
  }, []);

  const { tagDelay } = getRevealTiming(SPLASH_CONFIG.name);
  const showSplash = phase !== "done";
  const currentStep = INTRO_STEPS[stepIndex];
  const playing = phase === "playing";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className={`maya-splash-app flex min-h-0 flex-1 flex-col${phase === "done" ? " is-visible" : ""}`}
        aria-hidden={showSplash}
      >
        {children}
      </div>

      {showSplash && (
        <div
          className={`maya-splash${playing ? " is-playing" : ""}${
            phase === "clearing" ? " is-clearing" : ""
          }`}
          data-bg={SPLASH_CONFIG.bg}
          aria-live="polite"
          aria-label="Welcome to Maya"
        >
          <div className="maya-splash-bg" aria-hidden="true">
            <div className="maya-splash-layer bloom">
              <div className="maya-splash-bloom-core" />
            </div>
          </div>

          <div
            key={currentStep.id}
            className={`maya-splash-step${playing ? " is-active" : ""}`}
          >
            <IntroStepContent
              stepId={currentStep.id}
              playing={playing}
              tagDelay={tagDelay}
              glyphs={glyphs}
            />
          </div>

          <div className="maya-splash-progress" aria-hidden="true">
            {INTRO_STEPS.map((step, index) => (
              <span
                key={step.id}
                className={`maya-splash-progress-dot${
                  index === stepIndex ? " is-active" : ""
                }${index < stepIndex ? " is-complete" : ""}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
