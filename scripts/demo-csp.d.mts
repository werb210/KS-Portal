export function readDotEnv(text: string): Record<string, string>;
export function originsOf(urls: Array<string | undefined | null>): string[];
export function addConnectSrc(csp: string, origins: string[]): string;
export function patchConfig(json: string, origins: string[]): string;
