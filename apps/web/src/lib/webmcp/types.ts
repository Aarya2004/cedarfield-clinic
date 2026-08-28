/**
 * WebMCP ambient types — subset of the 2026-08-26 spec we rely on.
 * Feature-detect with `getModelContext()`; never assume it exists.
 */
export interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface ToolExecuteOptions {
  signal: AbortSignal;
}

export interface ModelContextTool<In = Record<string, unknown>> {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
  /** Chrome 152 passes no second argument (measured 2026-08-28); treat `options` as optional. */
  execute: (input: In, options?: ToolExecuteOptions) => Promise<unknown>;
}

export interface RegisterToolOptions {
  exposedTo?: string[];
  signal?: AbortSignal;
}

export interface RegisteredTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  origin: string;
  annotations?: ToolAnnotations;
}

export interface ModelContext extends EventTarget {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerTool(tool: ModelContextTool<any>, options?: RegisterToolOptions): Promise<void>;
  getTools(options?: { fromOrigins?: string[] }): Promise<RegisteredTool[]>;
  ontoolchange: ((ev: Event) => void) | null;
}

/** `document.modelContext` is current; `navigator.modelContext` is the pre-2026-07-21 alias. */
export function getModelContext(): ModelContext | null {
  if (typeof document === 'undefined') return null;
  const d = document as Document & { modelContext?: ModelContext };
  const n = navigator as Navigator & { modelContext?: ModelContext };
  return d.modelContext ?? n.modelContext ?? null;
}
