import { escapeHtml } from './html';
import type { GeneratedHazard } from './types';

function renderTrack(hazard: GeneratedHazard): string {
  const { track } = hazard;
  const boxes = Array.from({ length: track.limit }, () => '<span class="hazard-box"></span>').join('');
  const guidance = track.guidance.map((line) => `<li>${escapeHtml(line)}</li>`).join('');

  return `
    <div class="hazard-track">
      <div class="hazard-track-head">
        <span class="hazard-tier">${escapeHtml(track.tier)} encounter</span>
        <span class="hazard-limit">Limit ${track.limit} &middot; ${escapeHtml(track.trackKind)} track</span>
      </div>
      <div class="hazard-boxes" role="img" aria-label="${track.limit} boxes">${boxes}</div>
      <p class="hazard-damage"><strong>Damage:</strong> ${escapeHtml(track.damageStandard)}; ${escapeHtml(track.damageSpikes)}.</p>
      <ul class="hazard-guidance">${guidance}</ul>
    </div>`;
}

/** Category, name, summary, in-play note, encounter track, and source for one hazard. */
function renderHazardContent(hazard: GeneratedHazard): string {
  return `
    <header class="hazard-header">
      <div>
        <span class="hazard-category">${escapeHtml(hazard.category)}</span>
        <h3 class="hazard-name">${escapeHtml(hazard.name)}</h3>
      </div>
      <span class="hazard-size">${escapeHtml(hazard.size)}${hazard.basic ? ' hazard' : ''}</span>
    </header>
    <p class="hazard-summary">${escapeHtml(hazard.summary)}</p>
    ${hazard.inPlay ? `<p class="hazard-inplay"><strong>In play:</strong> ${escapeHtml(hazard.inPlay)}</p>` : ''}
    ${renderTrack(hazard)}
    ${hazard.source ? `<p class="hazard-source">${escapeHtml(hazard.source)}</p>` : ''}`;
}

/** Render a generated hazard encounter as HTML for the tool panel. */
export function renderHazardHtml(hazard: GeneratedHazard): string {
  const condition = hazard.condition
    ? `
      <section class="hazard-condition" aria-label="Force-of-nature backdrop condition">
        <p class="hazard-condition-label">Backdrop condition</p>
        ${renderHazardContent(hazard.condition)}
      </section>`
    : '';

  return `
    <article class="prompt-card hazard-card">
      ${renderHazardContent(hazard)}
      ${condition}
    </article>`;
}

/** Plain-text lines for one hazard (without any condition it may carry). */
function formatHazardLines(hazard: GeneratedHazard): string[] {
  const lines: string[] = [];
  lines.push(`${hazard.name} [${hazard.size}] - ${hazard.category}`);
  lines.push(hazard.summary);
  if (hazard.inPlay) {
    lines.push('');
    lines.push(`In play: ${hazard.inPlay}`);
  }
  lines.push('');
  lines.push(`Encounter: ${hazard.track.tier} (limit ${hazard.track.limit}, ${hazard.track.trackKind} track)`);
  lines.push(`Damage: ${hazard.track.damageStandard}; ${hazard.track.damageSpikes}.`);
  for (const line of hazard.track.guidance) {
    lines.push(`- ${line}`);
  }
  return lines;
}

/** Render a generated hazard encounter as plain text for copying. */
export function formatHazardText(hazard: GeneratedHazard): string {
  const lines = formatHazardLines(hazard);
  if (hazard.condition) {
    lines.push('', 'Backdrop condition', ...formatHazardLines(hazard.condition));
  }
  return lines.join('\n');
}
