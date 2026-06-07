type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResultItem = {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultItem[];
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognition() !== null;
}

export type SpeechRecognitionCallbacks = {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
};

export function startSpeechRecognition(
  callbacks: SpeechRecognitionCallbacks,
): SpeechRecognitionInstance | null {
  const SpeechRecognitionClass = getSpeechRecognition();
  if (!SpeechRecognitionClass) return null;

  const recognition = new SpeechRecognitionClass();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let committedText = "";

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = "";
    const startIndex = event.resultIndex ?? 0;

    for (let i = startIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0]?.transcript ?? "";
      if (result.isFinal) {
        committedText += transcript;
      } else {
        interim += transcript;
      }
    }

    const liveText = `${committedText}${interim}`.trim();
    if (liveText) {
      callbacks.onInterim?.(liveText);
    }
  };

  recognition.onerror = (event) => {
    callbacks.onError?.(event.error);
  };

  recognition.onend = () => {
    const finalText = committedText.trim();
    if (finalText) {
      callbacks.onFinal(finalText);
    }
    callbacks.onEnd?.();
  };

  recognition.start();
  return recognition;
}
