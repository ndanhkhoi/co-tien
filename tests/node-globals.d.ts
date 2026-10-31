declare module 'node:crypto' {
  export function createHash(algorithm: string): { update(data: unknown): { digest(encoding: string): string } };
}
declare module 'node:fs' {
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string): Buffer;
  export function statSync(path: string): { isDirectory(): boolean; size: number };
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function relative(from: string, to: string): string;
}
