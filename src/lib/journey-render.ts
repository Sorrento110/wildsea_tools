import { escapeHtml } from './html';
import { formatHazardText } from './hazard-render';
import { formatPoiText } from './poi-render';
import { formatPromptText } from './prompt-render';
import type { GeneratedJourneyLeg } from './types';

function quickRow(label: string, text: string): string {
  return `
    <div class="quick-journey-row">
      <span class="quick-journey-label">${label}</span>
      <p class="quick-journey-text">${text}</p>
    </div>`;
}

/** Compact journey-leg summary for the landing page's Quick Sparks. */
export function renderJourneyQuickHtml(leg: GeneratedJourneyLeg): string {
  const rows = [
    quickRow('Watch', `${escapeHtml(leg.watch.outcome)} &mdash; ${escapeHtml(leg.watch.text)}`),
    quickRow('Weather', `${escapeHtml(leg.weather.outcome)} &mdash; ${escapeHtml(leg.weather.text)}`),
    quickRow(
      'Landing',
      `${escapeHtml(leg.poi.site.name)} (${escapeHtml(leg.poi.feature.name)}, ${escapeHtml(
        leg.poi.layer.name,
      )}) &mdash; ${escapeHtml(leg.poi.prompt)}`,
    ),
    quickRow(
      'Hazard',
      `${escapeHtml(leg.hazard.name)} [${escapeHtml(leg.hazard.size)}] &mdash; ${escapeHtml(
        leg.hazard.track.tier,
      )} track, limit ${leg.hazard.track.limit}`,
    ),
  ];

  return `<div class="quick-journey">${rows.join('')}</div>`;
}

/** Plain-text journey leg, suitable for copy/paste at the table. */
export function formatJourneyText(leg: GeneratedJourneyLeg): string {
  return [
    'WATCH',
    formatPromptText(leg.watch),
    '',
    'WEATHER',
    formatPromptText(leg.weather),
    '',
    'POINT OF INTEREST',
    formatPoiText(leg.poi),
    '',
    'HAZARD',
    formatHazardText(leg.hazard),
  ].join('\n');
}
