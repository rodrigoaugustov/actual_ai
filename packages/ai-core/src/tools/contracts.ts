import type { z } from 'zod';

import type { ToolAccess } from '#types';

export type ToolSpec = {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  access: ToolAccess;
};

export type ToolHandler = (input: unknown) => Promise<unknown>;

export type ToolHandlerMap = Record<string, ToolHandler>;

export function assertToolRegistryComplete(
  specs: ToolSpec[],
  handlers: ToolHandlerMap,
): void {
  const names = new Set<string>();
  for (const spec of specs) {
    if (names.has(spec.name)) {
      throw new Error(`Duplicate tool spec: ${spec.name}`);
    }
    names.add(spec.name);
    if (!handlers[spec.name]) {
      throw new Error(`Missing tool handler: ${spec.name}`);
    }
  }
}

export function assertToolAccess(
  spec: ToolSpec,
  allowWriteTools: boolean,
): void {
  if (spec.access === 'write' && !allowWriteTools) {
    throw new Error(`Write tool requires explicit approval: ${spec.name}`);
  }
}
