export function readDotEnv(text: string): Record<string, string>;
export function originsOf(urls: Array<string | undefined | null>): string[];
export const DEFAULT_CLIENT_URL: string;
export function addSources(csp: string, directive: string, origins: string[]): string;
export function addConnectSrc(csp: string, origins: string[]): string;
export type DemoOrigins = { connect: string[]; frame: string[] };
export function patchConfig(json: string, origins: string[] | Partial<DemoOrigins>): string;
export function demoOrigins(env: Record<string, string | undefined>): DemoOrigins;
export function patchIfChanged(json: string, origins: string[] | Partial<DemoOrigins>): string | null;
