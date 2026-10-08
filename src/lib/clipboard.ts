/**
 * Copy text to the clipboard, briefly flagging the button that triggered it.
 *
 * Kept framework-free so both `.astro` tool components and the journey
 * dashboard can share one implementation. Clipboard access can be denied
 * (insecure context, permissions), so failures are swallowed.
 */
export async function copyWithFeedback(button: Element | null, text: string): Promise<void> {
  const previous = button?.textContent ?? '';
  try {
    await navigator.clipboard.writeText(text);
    if (!button) return;
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = previous;
    }, 1200);
  } catch {
    // Clipboard is unavailable; ignore.
  }
}
