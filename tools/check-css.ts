// Fails on dead CSS: a property two stylesheets set for the same selector (in the same @media/@supports
// context, the one loaded first never applies), a @keyframes name defined twice, and classes or keyframes nothing uses.
import { readdirSync, readFileSync } from 'node:fs';

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
      if (isGroup(head, stack, close, nextOpen)) {
        stack.push(head);
      } else {
        pushRule(rules, { file, text, head, stack, close, openBrace: i });
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

interface CssRuleInput {
  file: string;
  text: string;
  head: string;
  stack: string[];
  close: number;
  openBrace: number;
}

function isGroup(head: string, stack: string[], close: number, nextOpen: number): boolean {
  return head.startsWith('@') || stack.some((s) => s.startsWith('@keyframes')) || (nextOpen !== -1 && nextOpen < close);
}

function pushRule(rules: Rule[], input: CssRuleInput): void {
  const body = input.text.slice(input.openBrace + 1, input.close);
  rules.push({
    file: input.file,
    line: input.text.slice(0, input.openBrace).split('\n').length,
    context: input.stack.join(' '),
    selectors: input.head.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
    props: body.split(';').map((d) => d.split(':')[0].trim()).filter(Boolean),
  });
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
  for (const r of rules) checkRule(r, owner, errors);
}

function checkRule(rule: Rule, owner: Map<string, Rule>, errors: string[]): void {
  for (const sel of rule.selectors) {
    for (const prop of rule.props) {
      const key = `${rule.context}|${sel}|${prop}`;
      const prev = owner.get(key);
      if (prev && prev.file !== rule.file) errors.push(`${rule.file}:${rule.line}: ${sel} { ${prop} } overrides ${prev.file}:${prev.line}`);
      owner.set(key, rule);
    }
  }
}

// Dead CSS: classes no source file mentions and keyframes no animation uses.
const sources = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readFileSync(`src/${f}`, 'utf8'))
  .concat(readFileSync('index.html', 'utf8'))
  .join('\n');
const css = FILES.map((f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/g, '')).join('\n');
const word = (w: string, text: string) => new RegExp(`(?<![\\w-])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(text);
for (const cls of new Set([...css.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]))) {
  if (!word(cls, sources)) errors.push(`.${cls} is styled but no source file uses it`);
}
const animations = css.replace(/@keyframes\s+[\w-]+/g, '');
for (const k of frames.keys()) {
  const name = k.replace(/^@keyframes\s+/, '');
  if (!word(name, animations) && !word(name, sources)) errors.push(`${k} is never used`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} dead CSS rule(s): keep each declaration in its owning stylesheet and delete what nothing uses.`);
  process.exit(1);
}
console.log('check-css: no dead CSS');
