/**
 * "Forge this": turn 1–5 selected terminal lines into a Forge card. Pure helpers (tested) +
 * the one call into the engine. Prompt prefixes are stripped; output-looking lines are kept
 * (the human edits the card) unless they are obviously not commands.
 */
import { forge, type ForgeCard } from './forge.ts';
import { FORGE_NAME_RE, type ForgeError, type ForgeSpec } from './forge-spec.ts';

/** Strip common prompt prefixes: `~ $ `, `$ `, `% `, `❯ `, `# `, `user@host dir % `, `judge@rokan:~ $ `. */
export function stripPrompt(line: string): string {
  return line
    .replace(/^\s*[\w.-]+@[\w.-]+[:\s][^$%#❯]*[$%#❯]\s+/, '')
    .replace(/^\s*(?:~|[\w./-]*)\s*[$%#❯]\s+/, '')
    .trim();
}

/** A tool name guessed from the first command word, coerced into the forge name grammar. */
export function guessName(firstCommand: string, salt = ''): string {
  const word = (firstCommand.split(/\s+/)[0] ?? 'tool').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, '').replace(/_+$/, '');
  const base = (word || 'tool').slice(0, 20);
  const name = salt ? `${base}_${salt}` : base;
  return FORGE_NAME_RE.test(name) ? name : `tool_${salt || '1'}`;
}

export function linesToSpec(lines: string[], salt?: string): ForgeSpec {
  const commands = lines.map(stripPrompt).filter((c) => c.length > 0).slice(0, 5);
  return {
    name: guessName(commands[0] ?? 'tool', salt),
    description: `Forged from ${commands.length} command${commands.length === 1 ? '' : 's'} the human ran.`,
    commands,
    params: [],
    kind: 'read',
  };
}

export function forgeFromLines(lines: string[]): ForgeCard | ForgeError {
  const salt = Math.floor(Math.random() * 90 + 10).toString();
  const spec = linesToSpec(lines, salt);
  if (spec.commands.length === 0) return { error: 'invalid_command', detail: 'select at least one command line' };
  return forge.openCard(spec, { origin: 'human' });
}
