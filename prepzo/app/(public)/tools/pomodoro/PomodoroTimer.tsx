"use client";

import {
  ArrowRight,
  BookOpenCheck,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Settings2,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Mode = "focus" | "short" | "long";
type Durations = Record<Mode, number>;

const LABELS: Record<Mode, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
};

const DEFAULTS: Durations = { focus: 25, short: 5, long: 15 };

function dateKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function playChime() {
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  oscillator.frequency.setValueAtTime(880, context.currentTime + 0.14);
  gain.gain.setValueAtTime(0.1, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.45);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.45);
}

export function PomodoroTimer() {
  const [durations, setDurations] = useState<Durations>(DEFAULTS);
  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(DEFAULTS.focus * 60);
  const [running, setRunning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [goalHours, setGoalHours] = useState(4);
  const [focusedMinutes, setFocusedMinutes] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const endTime = useRef<number | null>(null);
  const completionHandled = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem("prepzo_pomodoro");
        if (raw) {
          const saved = JSON.parse(raw);
          const nextDurations = { ...DEFAULTS, ...saved.durations };
          const currentDay = saved.date === dateKey();
          setDurations(nextDurations);
          setSecondsLeft(nextDurations.focus * 60);
          setSound(saved.sound !== false);
          setGoalHours(Math.min(12, Math.max(0.5, Number(saved.goalHours) || 4)));
          setFocusedMinutes(currentDay ? Number(saved.focusedMinutes) || 0 : 0);
          setCompletedSessions(currentDay ? Number(saved.completedSessions) || 0 : 0);
        }
      } catch {}
      setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("prepzo_pomodoro", JSON.stringify({
      durations,
      sound,
      goalHours,
      focusedMinutes,
      completedSessions,
      date: dateKey(),
    }));
  }, [completedSessions, durations, focusedMinutes, goalHours, loaded, sound]);

  const selectMode = useCallback((nextMode: Mode) => {
    setMode(nextMode);
    setSecondsLeft(durations[nextMode] * 60);
    setRunning(false);
    endTime.current = null;
  }, [durations]);

  const finishSession = useCallback((completed: boolean) => {
    if (completed && completionHandled.current) return;
    if (completed) completionHandled.current = true;

    setRunning(false);
    endTime.current = null;
    if (completed && sound) playChime();

    if (mode === "focus") {
      const nextCount = completed ? completedSessions + 1 : completedSessions;
      if (completed) {
        setCompletedSessions(nextCount);
        setFocusedMinutes((value) => value + durations.focus);
      }
      selectMode(completed && nextCount % 4 === 0 ? "long" : "short");
    } else {
      selectMode("focus");
    }
  }, [completedSessions, durations.focus, mode, selectMode, sound]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (endTime.current === null) return;
      const next = Math.max(0, Math.ceil((endTime.current - Date.now()) / 1000));
      setSecondsLeft(next);
      if (next === 0) finishSession(true);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [finishSession, running]);

  function toggle() {
    if (running) {
      setRunning(false);
      endTime.current = null;
    } else {
      completionHandled.current = false;
      endTime.current = Date.now() + secondsLeft * 1000;
      setRunning(true);
    }
  }

  function updateDuration(target: Mode, value: number) {
    const safe = Math.min(90, Math.max(1, value || 1));
    setDurations((current) => ({ ...current, [target]: safe }));
    if (target === mode && !running) setSecondsLeft(safe * 60);
  }

  const total = durations[mode] * 60;
  const timerProgress = Math.min(1, Math.max(0, (total - secondsLeft) / total));
  const circumference = 2 * Math.PI * 132;
  const goalMinutes = goalHours * 60;
  const targetSessions = Math.max(1, Math.ceil(goalMinutes / durations.focus));
  const completedGoalSessions = Math.min(completedSessions, targetSessions);
  const currentFocusSeconds =
    mode === "focus" ? Math.max(0, durations.focus * 60 - secondsLeft) : 0;
  const focusedSecondsToday = focusedMinutes * 60 + currentFocusSeconds;
  const studyGoalProgress = Math.min(
    100,
    (focusedSecondsToday / (goalMinutes * 60)) * 100,
  );

  return (
    <main className="pomodoro-main">
      <section className="pomodoro-heading">
        <div>
          <p className="public-eyebrow">Study timer</p>
          <h1>Pomodoro</h1>
          <p>Focus, rest, and build a steady study day.</p>
        </div>
      </section>

      <section className="timer-workspace pomodoro-standalone">
        <div className="mode-switcher" aria-label="Timer mode">
          {(Object.keys(LABELS) as Mode[]).map((item) => (
            <button
              type="button"
              key={item}
              className={mode === item ? "is-active" : ""}
              onClick={() => selectMode(item)}
            >
              {LABELS[item]}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="timer-settings-trigger"
          onClick={() => setSettingsOpen((open) => !open)}
          aria-label={settingsOpen ? "Close timer settings" : "Open timer settings"}
          title="Timer settings"
        >
          {settingsOpen ? <X size={18} /> : <Settings2 size={18} />}
        </button>

        {settingsOpen && (
          <>
          <button
            type="button"
            className="timer-settings-scrim"
            onClick={() => setSettingsOpen(false)}
            aria-label="Close timer settings"
          />
          <aside className="timer-settings-popover">
            <div className="timer-settings-title">
              <div>
                <h2>Timer settings</h2>
                <p>Saved on this device.</p>
              </div>
              <button
                type="button"
                className="public-icon-button"
                onClick={() => setSound((value) => !value)}
                aria-label={sound ? "Mute completion sound" : "Enable completion sound"}
                title={sound ? "Mute sound" : "Enable sound"}
              >
                {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            </div>

            <label className="study-goal-input">
              <span>Daily study goal</span>
              <div>
                <input
                  type="number"
                  min="0.5"
                  max="12"
                  step="0.5"
                  value={goalHours}
                  onChange={(event) =>
                    setGoalHours(Math.min(12, Math.max(0.5, Number(event.target.value) || 0.5)))
                  }
                />
                <small>hours</small>
              </div>
            </label>

            <div className="duration-list">
              {(Object.keys(LABELS) as Mode[]).map((item) => (
                <label key={item}>
                  <span>{LABELS[item]}</span>
                  <div className="duration-stepper">
                    <button
                      type="button"
                      onClick={() => updateDuration(item, durations[item] - 1)}
                      disabled={durations[item] <= 1 || (running && mode === item)}
                      aria-label={`Decrease ${LABELS[item].toLowerCase()} duration`}
                      title="Decrease by 1 minute"
                    >
                      <Minus size={15} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={durations[item]}
                      onChange={(event) => updateDuration(item, Number(event.target.value))}
                      disabled={running && mode === item}
                      aria-label={`${LABELS[item]} duration in minutes`}
                    />
                    <span className="duration-unit">min</span>
                    <button
                      type="button"
                      onClick={() => updateDuration(item, durations[item] + 1)}
                      disabled={durations[item] >= 90 || (running && mode === item)}
                      aria-label={`Increase ${LABELS[item].toLowerCase()} duration`}
                      title="Increase by 1 minute"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </label>
              ))}
            </div>

            <div className="settings-goal-status">
              {Math.floor(focusedSecondsToday / 60)} of {goalMinutes} focused minutes today
              {" · "}
              {targetSessions} focus sessions
            </div>

            <button
              type="button"
              className="settings-reset"
              onClick={() => {
                setDurations(DEFAULTS);
                setGoalHours(4);
                setSecondsLeft(DEFAULTS[mode] * 60);
                setRunning(false);
                endTime.current = null;
                completionHandled.current = false;
              }}
            >
              <RotateCcw size={15} />
              Restore defaults
            </button>
          </aside>
          </>
        )}

        <div className="timer-ring" aria-live="polite">
          <svg viewBox="0 0 300 300" aria-hidden="true">
            <circle className="timer-ring-track" cx="150" cy="150" r="132" />
            <circle
              className="timer-ring-progress"
              cx="150"
              cy="150"
              r="132"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - timerProgress)}
            />
          </svg>
          <div className="timer-readout">
            <span>{LABELS[mode]}</span>
            <strong>
              {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </strong>
            <small>{running ? "Stay with this task" : "Ready when you are"}</small>
          </div>
        </div>

        <div className="timer-controls">
          <button
            type="button"
            className="timer-secondary-button"
            onClick={() => {
              setRunning(false);
              endTime.current = null;
              setSecondsLeft(durations[mode] * 60);
              completionHandled.current = false;
            }}
            aria-label="Reset timer"
            title="Reset timer"
          >
            <RefreshCcw size={19} />
          </button>
          <button type="button" className="timer-primary-button" onClick={toggle}>
            {running ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            {running ? "Pause" : "Start"}
          </button>
          <button
            type="button"
            className="timer-secondary-button"
            onClick={() => finishSession(false)}
            aria-label="Skip session"
            title="Skip session"
          >
            <SkipForward size={20} />
          </button>
        </div>

        <div
          className="pomodoro-session-count"
          aria-label={`${completedGoalSessions} of ${targetSessions} daily focus sessions completed`}
        >
          <div className="pomodoro-goal-label">
            <span>
              Daily study goal · {Math.floor(focusedSecondsToday / 60)}/{goalMinutes} min
            </span>
            <strong>{completedGoalSessions}/{targetSessions}</strong>
          </div>
          <div
            className="pomodoro-goal-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={goalMinutes * 60}
            aria-valuenow={Math.min(focusedSecondsToday, goalMinutes * 60)}
          >
            <span style={{ width: `${studyGoalProgress}%` }} />
          </div>
        </div>
      </section>

      <section className="pomodoro-next-step" aria-labelledby="pomodoro-study-title">
        <Link href="/auth/signup" className="countdown-prepzo-cta">
          <BookOpenCheck size={19} />
          Study for NEET with Prepzo
          <ArrowRight size={18} />
        </Link>
        <p className="countdown-cta-note">
          Practice NEET MCQs, revise with flashcards, and track your preparation.
        </p>
      </section>

      <section className="countdown-seo-copy" aria-labelledby="pomodoro-study-title">
        <h2 id="pomodoro-study-title">Build a focused NEET study routine</h2>
        <p>
          Use focused study sessions alongside NCERT revision, MCQ practice, and regular review
          of weak topics. Follow official exam notices and explore Prepzo study articles for more
          NEET preparation guidance.
        </p>
        <div>
          <a href="https://neet.nta.nic.in/" target="_blank" rel="noreferrer">
            Check official NTA updates
          </a>
          <Link href="/blog">Read the Prepzo blog</Link>
        </div>
      </section>
    </main>
  );
}
