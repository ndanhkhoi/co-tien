#!/usr/bin/env node
// Quét chữ người đọc thấy để tìm ký tự và cụm từ kiểu văn máy.
// Chỉ đọc phần chữ: chuỗi trong .ts/.js, giá trị chuỗi trong .json, văn bản ngoài code trong .md/.html.
// Dùng: node .claude/skills/anti-slop/scripts/scan.mjs [--warn] [đường dẫn...]
// Mặc định chỉ in lỗi (error) và thoát mã 1 nếu có; --warn in thêm cảnh báo cụm từ cần người đọc xét.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const DEFAULT_PATHS = [
  'README.md', 'CONTRIBUTING.md', 'AGENTS.md', 'index.html', 'docs',
  'src',
];
const EXTS = new Set(['.md', '.ts', '.js', '.json', '.html']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'screenshots']);

const PICTO = /\p{Extended_Pictographic}/u;
const INVISIBLE = { ' ': 'NBSP', '​': 'ZWSP', '‌': 'ZWNJ', '‍': 'ZWJ', ' ': 'NNBSP', '­': 'soft hyphen', '﻿': 'BOM', '⁠': 'word joiner' };

// Mỗi luật: id, mức, regex, hàm cho phép ngoại lệ theo ngữ cảnh.
const RULES = [
  { id: 'em-dash', level: 'error', re: /—/g, allow: allowEmDash,
    hint: 'gạch dài chen giữa câu: tách câu, dùng dấu phẩy, hai chấm hoặc ngoặc đơn' },
  { id: 'en-dash', level: 'error', re: /–/g, allow: allowEnDash,
    hint: 'gạch ngắn chỉ nối khoảng số (3–5) hoặc cặp tên riêng (Bá Nha – Tử Kỳ); còn lại viết lại' },
  { id: 'arrow', level: 'error', re: /[→←⇒⇐➜➔↔⟶⟷]/g, allow: (t, i) => betweenCode(t, i),
    hint: 'mũi tên thay cho câu: viết thành câu, hoặc "rồi", "sang", "thành"' },
  { id: 'ascii-ellipsis', level: 'error', re: /(?<!\.)\.\.\.(?!\.)/g,
    hint: 'dùng một ký tự "…" cho thống nhất' },
  { id: 'single-curly-quote', level: 'error', re: /[‘’]/g,
    hint: 'tiếng Việt không dùng nháy đơn cong; dùng “ ” hoặc bỏ' },
  { id: 'approx', level: 'error', re: /≈/g, allow: (t, i) => nearDigit(t, i),
    hint: '"≈" chỉ đứng cạnh số; trong câu viết "khoảng"' },
  { id: 'times', level: 'error', re: /×/g, allow: (t, i) => nearDigit(t, i),
    hint: '"×" chỉ dùng giữa số (844×475, ×2)' },
  { id: 'space-before-punct', level: 'error', re: / +[,.;:!?](?=\s|$)/g, allow: allowSpaceBeforePunct,
    hint: 'tiếng Việt không có khoảng trắng trước dấu câu' },
  { id: 'emoji', level: 'error', re: /\p{Extended_Pictographic}/gu,
    hint: 'không emoji trong văn; icon đi qua art pipeline' },
  { id: 'invisible', level: 'error', re: /[ ​‌‍ ­﻿⁠]/g,
    hint: 'ký tự vô hình lọt từ bản sao chép: xoá hoặc thay bằng khoảng trắng thường' },
];

// Cụm từ: chỉ cảnh báo, người viết phải đọc câu rồi mới quyết định.
const PHRASES = [
  ['vi-mot-cach', /\bmột cách\s+\p{L}+/giu, 'trạng từ dịch máy "một cách + tính từ"'],
  ['vi-khong-chi', /không (chỉ|những)\b.{0,80}\bmà còn\b/giu, '"không chỉ… mà còn…"'],
  ['vi-mo-bai', /(trong thời đại|hơn bao giờ hết|hãy cùng (khám phá|tìm hiểu)|bạn đã bao giờ)/giu, 'mở bài vạn năng'],
  ['vi-ket-bai', /(^|\n|[.!?]\s+)(tóm lại|nhìn chung|nói tóm lại|tổng kết lại)\b/giu, 'kết bài nhắc lại'],
  ['vi-dem', /(điều quan trọng là|cần lưu ý rằng|đáng chú ý là|không thể phủ nhận|có thể nói rằng)/giu, 'câu dạo đầu không mang thông tin'],
  ['vi-thoi-phong', /\b(vô cùng|cực kỳ|tuyệt vời|đỉnh cao|liền mạch|đắm chìm|mạnh mẽ và linh hoạt|đầy cảm hứng)\b/giu, 'tính từ thổi phồng'],
  ['vi-viec', /\bviệc\s+\p{L}+\s+việc\b/giu, 'danh hoá "việc" chồng nhau'],
  ['en-lexicon', /\b(delve|tapestry|seamless(ly)?|robust|leverag(e|es|ing)|elevate|empower|unlock|game-changer|cutting-edge|in today's|let's dive|it's important to note|in conclusion|not just\b.{0,60}\bbut)\b/giu, 'từ vựng máy tiếng Anh'],
];

const isDigit = (c) => c !== undefined && /[0-9]/.test(c);
const loneMark = (t) => /^\s*[—–-]\s*$/.test(t);

// Mũi tên giữa hai code span (`core` ← `game`) là ký hiệu chiều phụ thuộc, không phải câu.
function betweenCode(t, i) {
  return /\u0001\s?$/.test(t.slice(Math.max(0, i - 2), i)) && /^\s?\u0001/.test(t.slice(i + 1, i + 3));
}

function allowEnDash(t, i) {
  if (loneMark(t)) return true;
  if (nearDigit(t, i)) return true;
  return /\p{Lu}[\p{Ll}\p{M}]*\s$/u.test(t.slice(Math.max(0, i - 12), i)) && /^\s\p{Lu}/u.test(t.slice(i + 1, i + 3));
}
function nearDigit(t, i) {
  const l = t.slice(Math.max(0, i - 2), i), r = t.slice(i + 1, i + 3);
  return /[0-9\u0001]\s?$/.test(l) || /^\s?[0-9\u0001]/.test(r);
}

// Gạch dài hợp lệ: gạch đầu lời thoại (đầu đoạn) và gạch dẫn lời trong cùng đoạn thoại;
// một ô hay một chuỗi chỉ gồm "—" làm giá trị trống.
function allowEmDash(t, i) {
  if (loneMark(t)) return true;
  const start = t.lastIndexOf('\n', i - 1) + 1;
  const end = t.indexOf('\n', i);
  const para = t.slice(start, end < 0 ? t.length : end);
  if (/^\s*—\s/.test(para)) return true;
  const cell = para.split('|').find((c, k, a) => {
    const off = start + a.slice(0, k).join('|').length + (k ? 1 : 0);
    return i >= off && i < off + c.length;
  });
  return cell !== undefined && cell.trim() === '—';
}

function allowSpaceBeforePunct(t, i) {
  const line = t.slice(t.lastIndexOf('\n', i - 1) + 1, (t.indexOf('\n', i) + 1 || t.length + 1) - 1);
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line); // dòng kẻ bảng markdown
}

// ——— Trích phần chữ theo loại file, giữ offset để báo đúng dòng ———

// Phần bị loại (code, link) thay bằng ký tự giữ chỗ cùng độ dài để offset và dấu câu sau nó vẫn đúng.
const HOLD = '\u0001';
function blank(s) { return s.replace(/[^\n]/g, HOLD); }

function extractMarkdown(src) {
  let out = src.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, blank);
  out = out.replace(/`[^`\n]+`/g, blank);
  out = out.replace(/<!--[\s\S]*?-->/g, blank);
  out = out.replace(/\]\([^)\n]*\)/g, (m) => ']' + blank(m.slice(1)));
  return [{ offset: 0, text: out }];
}

function extractHtml(src) {
  const out = src
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<[^>]*>/g, (m) => {
      // giữ giá trị các thuộc tính người dùng đọc được
      const keep = blank(m).split('');
      for (const a of m.matchAll(/\b(content|title|alt|aria-label|placeholder)="([^"]*)"/gi)) {
        const s = a.index + a[0].indexOf('"') + 1;
        for (let k = 0; k < a[2].length; k++) keep[s + k] = a[2][k];
      }
      return keep.join('');
    });
  return [{ offset: 0, text: out }];
}

// Tách chuỗi trong TS/JS, bỏ comment. Template literal: bỏ phần ${…}.
function extractCode(src) {
  const chunks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2); if (i < 0) break; i += 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      chunks.push({ offset: i + 1, text: src.slice(i + 1, j) });
      i = j + 1; continue;
    }
    if (c === '`') {
      // cả template thành một đoạn; phần ${…} thay bằng ký tự giữ chỗ (một giá trị được chèn)
      let j = i + 1, text = '';
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') { text += src.slice(j, j + 2); j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') {
          const s0 = j;
          let depth = 1; j += 2;
          while (j < n && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
          text += HOLD.repeat(j - s0); continue;
        }
        text += src[j++];
      }
      chunks.push({ offset: i + 1, text });
      i = j + 1; continue;
    }
    i++;
  }
  // chỉ giữ chuỗi có chữ (bỏ selector, khoá, đường dẫn thuần ASCII không dấu cách)
  return chunks.filter((ch) => /\s/.test(ch.text) || /[^\x00-\x7f]/.test(ch.text));
}

function extractJson(src) {
  const chunks = [];
  for (const m of src.matchAll(/"((?:[^"\\\n]|\\.)*)"(\s*:)?/g)) {
    if (m[2]) continue; // khoá
    const raw = m[1];
    if (!/\s/.test(raw) && !/[^\x00-\x7f]/.test(raw)) continue;
    // \n trong JSON là hai ký tự; đổi thành xuống dòng thật nhưng giữ độ dài để offset khớp
    chunks.push({ offset: m.index + 1, text: raw.replace(/\\n/g, ' \n').replace(/\\"/g, ' "') });
  }
  return chunks;
}

const EXTRACT = { '.md': extractMarkdown, '.html': extractHtml, '.ts': extractCode, '.js': extractCode, '.json': extractJson };

function walk(p, files) {
  let st;
  try { st = statSync(p); } catch { return; }
  if (st.isDirectory()) {
    for (const e of readdirSync(p)) if (!SKIP_DIRS.has(e) && !e.startsWith('.')) walk(join(p, e), files);
  } else if (EXTS.has(extname(p))) files.push(p);
}

function lineCol(src, off) {
  let line = 1, last = -1;
  for (let k = src.indexOf('\n'); k >= 0 && k < off; k = src.indexOf('\n', k + 1)) { line++; last = k; }
  return [line, off - last];
}

const args = process.argv.slice(2);
const showWarn = args.includes('--warn');
const paths = args.filter((a) => !a.startsWith('--'));
const files = [];
for (const p of paths.length ? paths : DEFAULT_PATHS) walk(p, files);

let errors = 0, warns = 0;
for (const f of files) {
  if (f.includes('/.claude/skills/anti-slop/')) continue;
  const src = readFileSync(f, 'utf8');
  for (const { offset, text } of EXTRACT[extname(f)](src)) {
    const hits = [];
    for (const r of RULES) {
      for (const m of text.matchAll(r.re)) {
        if (r.allow?.(text, m.index)) continue;
        hits.push(['error', r.id, m.index, r.hint]);
      }
    }
    if (showWarn) {
      for (const [id, re, hint] of PHRASES) {
        for (const m of text.matchAll(re)) hits.push(['warn', id, m.index + (m[0].length - m[0].trimStart().length), hint]);
      }
    }
    for (const [level, id, idx, hint] of hits) {
      const [line, col] = lineCol(src, offset + idx);
      const ctx = text.slice(Math.max(0, idx - 40), idx + 40).replace(/\s+/g, ' ').trim();
      console.log(`${relative('.', f)}:${line}:${col} ${level} ${id}  ${ctx}\n    ${hint}`);
      if (level === 'error') errors++; else warns++;
    }
  }
}
console.log(`\n${files.length} file, ${errors} lỗi${showWarn ? `, ${warns} cảnh báo` : ''}`);
process.exit(errors ? 1 : 0);
