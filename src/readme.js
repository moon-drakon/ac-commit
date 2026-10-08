// Keeps a problem table inside README.md between two marker comments.
// Rows are sorted by the date of the stored AC, newest first. Text outside the markers is never touched.
export const START = '<!-- ac-commit:start -->';
export const END = '<!-- ac-commit:end -->';
export const PROJECT_URL = 'https://github.com/moon-drakon/ac-commit';

const cell = (s) => String(s ?? '-').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '-';

// row: { id, url, name, difficulty, lang, path, date }  (date is YYYY-MM-DD)
export function formatRow(row) {
  return `| [${cell(row.id)}](${row.url}) | ${cell(row.name)} | ${cell(row.difficulty)} | [${cell(row.lang)}](${encodeURI(row.path)}) | ${row.date} |`;
}

function parseRows(block) {
  return block
    .split('\n')
    .filter((line) => line.startsWith('| ['))
    .map((line) => ({
      line,
      id: line.slice(3, line.indexOf(']')),
      date: line.trim().replace(/\|\s*$/, '').split('|').pop().trim(),
    }));
}

function renderBlock(rows, diffLabel) {
  return [
    START,
    `Solved: **${rows.length}**`,
    '',
    `| Problem | Name | ${diffLabel} | Code | Last AC |`,
    '|---|---|---|---|---|',
    ...rows.map((r) => r.line),
    END,
  ].join('\n');
}

// Adds or replaces the row with the same id. Returns the new README text.
export function upsertRow(readme, row, { diffLabel = 'Rating' } = {}) {
  return upsertRows(readme, [row], { diffLabel });
}

export function upsertRows(readme, newRows, { diffLabel = 'Rating' } = {}) {
  const text = readme ?? '';
  const s = text.indexOf(START);
  const e = text.indexOf(END);
  const hasBlock = s !== -1 && e > s;
  let rows = hasBlock ? parseRows(text.slice(s, e)) : [];
  const ids = new Set(newRows.map((r) => r.id));
  rows = rows.filter((r) => !ids.has(r.id));
  // New rows go first, then a stable sort keeps the newest AC on top within a day.
  const added = newRows.map((r) => ({ line: formatRow(r), id: r.id, date: r.date }));
  rows = [...added.reverse(), ...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const block = renderBlock(rows, diffLabel);
  if (hasBlock) return text.slice(0, s) + block + text.slice(e + END.length);
  return `${text.replace(/\s*$/, '')}\n\n## Problems\n\n${block}\n`;
}

// README for a new, empty solutions repo.
export function templateReadme(platform, handle) {
  const who = handle ? `: [${handle}](${platform.profileUrl(handle)})` : '';
  return [
    `# ${platform.name} solutions`,
    '',
    `My accepted solutions on ${platform.name}${who}.`,
    '',
    'Each file holds my latest accepted submission for that problem, exactly as submitted.',
    'Every new AC is one commit, dated at the time of that submission.',
    `Files are ${platform.layout}.`,
    '',
    `Synced by [AC Commit](${PROJECT_URL}).`,
    '',
    '## Problems',
    '',
    renderBlock([], platform.diffLabel),
    '',
  ].join('\n');
}

export function localDate(epochSeconds, timeZone) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(epochSeconds * 1000));
}
