import { escapeHtml } from './html';
import type { GeneratedPrompt } from './types';

function rollBadge(label: string, value: number, kind: string): string {
  return `
    <span class="prompt-badge prompt-badge-${kind}">
      <span class="prompt-badge-label">${escapeHtml(label)}</span>
      <span class="prompt-badge-value">${value}</span>
    </span>
  `;
}

/** Render a single rolled prompt (watch result or weather condition) to HTML. */
export function renderPromptHtml(prompt: GeneratedPrompt): string {
  const rollLabel = prompt.rollLabel ?? 'Roll (1d6)';
  const description = prompt.outcomeDescription
    ? `<p class="prompt-outcome-description">${escapeHtml(prompt.outcomeDescription)}</p>`
    : '';
  const resultBadge =
    prompt.resultRoll !== undefined ? rollBadge('Result', prompt.resultRoll, 'result') : '';
  const source = prompt.source
    ? `<footer class="option-source">${escapeHtml(prompt.source)}</footer>`
    : '';

  return `
    <article class="prompt-card">
      <div class="prompt-rolls">
        ${rollBadge(rollLabel, prompt.roll, 'roll')}
        <span class="prompt-outcome">${escapeHtml(prompt.outcome)}</span>
        ${resultBadge}
      </div>
      ${description}
      <p class="prompt-text">${escapeHtml(prompt.text)}</p>
      ${source}
    </article>
  `;
}

/** Plain-text version of a rolled prompt, suitable for copy/paste. */
export function formatPromptText(prompt: GeneratedPrompt): string {
  const rollLabel = prompt.rollLabel ?? 'Roll (1d6)';
  const lines = [
    prompt.title,
    `${rollLabel}: ${prompt.roll} — ${prompt.outcome}`,
  ];
  if (prompt.resultRoll !== undefined) lines.push(`Result (1d6): ${prompt.resultRoll}`);
  lines.push('', prompt.text);
  if (prompt.source) lines.push('', prompt.source);
  return lines.join('\n');
}
