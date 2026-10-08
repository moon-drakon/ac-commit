// Maps a judge's language name to a file extension and a short label.
// Order matters: "c++" and "c#" must match before plain "c", "javascript" before "java".
const RULES = [
  [/c\+\+|g\+\+|clang\+\+|^cpp/, 'cpp'],
  [/c#|csharp|\.net|mono/, 'cs'],
  [/f#|fsharp/, 'fs'],
  [/objective-c/, 'm'],
  [/^(gnu )?c(\s|$|\d)|^c$|\bc11\b|\bc17\b|\bc23\b|^gcc|msvc c\b/, 'c'],
  [/pypy|pyth|python|pandas/, 'py'],
  [/javascript|node|^js$|v8/, 'js'],
  [/typescript|^ts$/, 'ts'],
  [/java/, 'java'],
  [/kotlin|ktln/, 'kt'],
  [/rust/, 'rs'],
  [/^go(lang)?\b|^go\s/, 'go'],
  [/haskell/, 'hs'],
  [/ruby/, 'rb'],
  [/scala/, 'scala'],
  [/swift/, 'swift'],
  [/php/, 'php'],
  [/pascal|delphi/, 'pas'],
  [/perl/, 'pl'],
  [/ocaml/, 'ml'],
  [/dart/, 'dart'],
  [/racket/, 'rkt'],
  [/erlang/, 'erl'],
  [/elixir/, 'ex'],
  [/bash|shell/, 'sh'],
  [/sql/, 'sql'],
  [/^r(\s|$)/, 'r'],
  [/^d(\s|$)/, 'd'],
];

const LABELS = {
  cpp: 'C++', c: 'C', cs: 'C#', fs: 'F#', m: 'Objective-C', py: 'Python', js: 'JavaScript',
  ts: 'TypeScript', java: 'Java', kt: 'Kotlin', rs: 'Rust', go: 'Go', hs: 'Haskell', rb: 'Ruby',
  scala: 'Scala', swift: 'Swift', php: 'PHP', pas: 'Pascal', pl: 'Perl', ml: 'OCaml', dart: 'Dart',
  rkt: 'Racket', erl: 'Erlang', ex: 'Elixir', sh: 'Bash', sql: 'SQL', r: 'R', d: 'D', txt: 'Text',
};

export function extFor(language) {
  const name = String(language || '').trim().toLowerCase();
  for (const [re, ext] of RULES) if (re.test(name)) return ext;
  return 'txt';
}

export function labelFor(ext) {
  return LABELS[ext] || ext.toUpperCase();
}

// Judges return CRLF or no final newline. Store LF with one trailing newline,
// which matches the files already in the Codeforces repo.
export function normalizeCode(code) {
  return String(code).replace(/\r\n?/g, '\n').replace(/\n*$/, '\n');
}

export function decodeHtml(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
