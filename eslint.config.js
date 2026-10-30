// Enforces the code principles in AGENTS.md (DRY, KISS, YAGNI, SOLID). No suppressions: fix the code.
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';

/** Imports a layer may not make: `core` stays pure, `platform`/`audio` stay leaves, nothing imports upward. */
const LAYERS = {
  core: ['ai', 'game', 'render', 'ui', 'audio', 'platform'],
  game: ['ai', 'render', 'ui', 'audio', 'platform'],
  ai: ['render', 'ui', 'audio', 'platform'],
  render: ['ai', 'ui', 'audio', 'platform'],
  audio: ['core', 'ai', 'game', 'render', 'ui', 'platform'],
  platform: ['core', 'ai', 'game', 'render', 'ui', 'audio'],
};

const size = { max: 0, skipBlankLines: true, skipComments: true };

export default tseslint.config(
  { ignores: ['dist/', 'dev-dist/', 'public/', 'plans/', '.claude/'] },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'tools/**/*.ts', '*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { sonarjs },
    rules: {
      'max-lines': ['error', { ...size, max: 500 }],
      'max-lines-per-function': ['error', { ...size, max: 80, IIFEs: true }],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-depth': ['error', 4],
      'max-params': ['error', 4],
    },
  },
  // Test suites are long `describe` blocks by nature.
  { files: ['tests/**/*.ts'], rules: { 'max-lines-per-function': 'off' } },
  ...Object.entries(LAYERS).map(([layer, banned]) => ({
    files: [`src/${layer}/**/*.ts`],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: banned.map((b) => ({ group: [`**/${b}/*`, `**/${b}`], message: `${layer} must not import ${b} (see AGENTS.md, dependency direction).` })),
      }],
    },
  })),
);
