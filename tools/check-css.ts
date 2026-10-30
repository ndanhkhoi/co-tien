// Fails when two stylesheets set the same property for the same selector (in the same @media/@supports
// context): the one loaded first is dead code. Also fails on a @keyframes name defined in two files.
import { readFileSync } from 'node:fs';

const FILES = ['base', 'kit', 'screens', 'match', 'skin'].map((n) => `src/styles/${n}.css`);

interface Rule { file: string; line: number; context: string; selectors: string[]; props: string[] }

function parse(file: string): { rules: Rule[]; keyframes: string[] } {
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const rules: Rule[] = [];
  const keyframes: string[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      const head = text.slice(start, i).trim();
      const close = text.indexOf('}', i);
      const nextOpen = text.indexOf('{', i + 1);
      if (head.startsWith('@keyframes')) keyframes.push(head);
      if (head.startsWith('@') || stack.some((s) => s.startsWith('@keyframes')) || (nextOpen !== -1 && nextOpen < close)) {
        stack.push(head);
      } else {
        const body = text.slice(i + 1, close);
        rules.push({
          file, line: text.slice(0, i).split('\n').length, context: stack.join(' '),
          selectors: head.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
          props: body.split(';').map((d) => d.split(':')[0].trim()).filter(Boolean),
        });
        i = close;
      }
      start = i + 1;
    } else if (ch === '}') {
      stack.pop();
      start = i + 1;
    } else if (ch === ';' && !stack.length) start = i + 1;
  }
  return { rules, keyframes };
}

const owner = new Map<string, Rule>();
const frames = new Map<string, string>();
const errors: string[] = [];
for (const file of FILES) {
  const { rules, keyframes } = parse(file);
  for (const k of keyframes) {
    const prev = frames.get(k);
    if (prev && prev !== file) errors.push(`${file}: "${k}" is already defined in ${prev}`);
    frames.set(k, file);
  }
  for (const r of rules) for (const sel of r.selectors) for (const prop of r.props) {
    const key = `${r.context}|${sel}|${prop}`;
    const prev = owner.get(key);
    if (prev && prev.file !== r.file) errors.push(`${r.file}:${r.line}: ${sel} { ${prop} } overrides ${prev.file}:${prev.line}`);
    owner.set(key, r);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} CSS declaration(s) override another stylesheet; keep each in its owning file.`);
  process.exit(1);
}
console.log('check-css: no cross-file overrides');
