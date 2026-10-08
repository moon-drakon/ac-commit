// Keeps one problem table per judge inside README.md, between marker comments:
//   <!-- ac-commit:codeforces:start --> ... <!-- ac-commit:codeforces:end -->
// Rows are sorted by the date of the stored AC, newest first. A repo that holds several judges
// also gets a total line. Text outside the markers is never touched.
export const PROJECT_URL = 'https://github.com/moon-drakon/ac-commit';
export const markers = (id) => [`<!-- ac-commit:${id}:start -->`, `<!-- ac-commit:${id}:end -->`];
const TOTAL = markers('total');

const cell = (s) => String(s ?? '-').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '-';

// row: { id, url, name, difficulty, lang, path, date }  (date is YYYY-MM-DD)
export function formatRow(row) {
  return `| [${cell(row.id)}](${row.url}) | ${cell(row.name)} | ${cell(row.difficulty)} | [${cell(row.lang)}](${encodeURI(row.path)}) | ${row.date} |`;
}

const tableRows = (block) => block.split('\n').filter((line) => line.startsWith('| ['));

function parseRows(block) {
  return tableRows(block).map((line) => ({
    line,
    id: line.slice(3, line.indexOf(']')),
    date: line.trim().replace(/\|\s*$/, '').split('|').pop().trim(),
  }));
}

function renderBlock(id, rows, diffLabel) {
  const [start, end] = markers(id);
  return [
    start,
    `Solved: **${rows.length}**`,
    '',
    `| Problem | Name | ${diffLabel} | Code | Last AC |`,
    '|---|---|---|---|---|',
    ...rows.map((r) => r.line),
    end,
  ].join('\n');
}

// section: { platform, handle, folder }
function sectionIntro({ platform, handle, folder }) {
  const who = handle ? `Profile: [${handle}](${platform.profileUrl(handle)}). ` : '';
  return folder ? `${who}Files are in \`${folder}/\`, named ${platform.layout}.` : `${who}Files are named ${platform.layout}.`;
}

function renderSection(section, rows = []) {
  return `## ${section.platform.name}\n\n${sectionIntro(section)}\n\n${renderBlock(section.platform.id, rows, section.platform.diffLabel)}`;
}

function findBlock(text, id) {
  const [start, end] = markers(id);
  const s = text.indexOf(start);
  const e = s === -1 ? -1 : text.indexOf(end, s);
  return e === -1 ? null : { s, e: e + end.length };
}

function updateTotal(text) {
  const s = text.indexOf(TOTAL[0]);
  const e = text.indexOf(TOTAL[1], s);
  if (s === -1 || e === -1) return text;
  let total = 0;
  for (const m of text.matchAll(/<!-- ac-commit:([a-z0-9-]+):start -->([\s\S]*?)<!-- ac-commit:\1:end -->/g)) {
    if (m[1] !== 'total') total += tableRows(m[2]).length;
  }
  return `${text.slice(0, s)}${TOTAL[0]}\nTotal solved: **${total}**\n${TOTAL[1]}${text.slice(e + TOTAL[1].length)}`;
}

// Adds or replaces rows (matched by problem id) in this judge's table. Returns the new README.
export function upsertRows(readme, newRows, section) {
  const text = readme ?? '';
  const { platform } = section;
  const found = findBlock(text, platform.id);
  let rows = found ? parseRows(text.slice(found.s, found.e)) : [];
  const ids = new Set(newRows.map((r) => r.id));
  rows = rows.filter((r) => !ids.has(r.id));
  // New rows go first, then a stable sort keeps the newest AC on top within a day.
  const added = newRows.map((r) => ({ line: formatRow(r), id: r.id, date: r.date }));
  rows = [...added.reverse(), ...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const out = found
    ? text.slice(0, found.s) + renderBlock(platform.id, rows, platform.diffLabel) + text.slice(found.e)
    : `${text.replace(/\s*$/, '')}\n\n${renderSection(section, rows)}\n`;
  return updateTotal(out);
}

export function upsertRow(readme, row, section) {
  return upsertRows(readme, [row], section);
}

const joinNames = (names) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`);

// README for a new, empty solutions repo. `sections` lists the judges that share the repo.
export function templateReadme(sections) {
  const intro = [
    'Each file holds my latest accepted submission for that problem, exactly as submitted.',
    'Every new AC is one commit, dated at the time of that submission.',
  ];
  const credit = `Synced by [AC Commit](${PROJECT_URL}).`;
  if (sections.length === 1 && !sections[0].folder) {
    const s = sections[0];
    const who = s.handle ? `: [${s.handle}](${s.platform.profileUrl(s.handle)})` : '';
    return [
      `# ${s.platform.name} solutions`, '',
      `My accepted solutions on ${s.platform.name}${who}.`, '',
      ...intro, `Files are named ${s.platform.layout}.`, '',
      credit, '',
      '## Problems', '',
      renderBlock(s.platform.id, [], s.platform.diffLabel), '',
    ].join('\n');
  }
  return [
    '# Competitive programming solutions', '',
    `My accepted solutions on ${joinNames(sections.map((s) => s.platform.name))}.`, '',
    ...intro, '',
    credit, '',
    TOTAL[0], 'Total solved: **0**', TOTAL[1], '',
    ...sections.flatMap((s) => [renderSection(s), '']),
  ].join('\n');
}

export function localDate(epochSeconds, timeZone) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(epochSeconds * 1000));
}
