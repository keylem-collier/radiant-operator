export function formatUserError(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("not allowed") ||
    lower.includes("denied permission") ||
    lower.includes("autoplay") ||
    lower.includes("voice playback failed") ||
    lower.includes("speech failed")
  ) {
    return "Maya replied in text, but voice playback failed.";
  }

  if (lower.includes("advisor request failed") || lower.includes("gemini")) {
    return "Maya couldn't respond right now. Check your connection and try again.";
  }

  if (message.length > 140) {
    return `${message.slice(0, 137)}…`;
  }

  return message;
}
