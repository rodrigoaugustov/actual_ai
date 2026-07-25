import { z } from 'zod';

import { assertToolAccess, assertToolRegistryComplete } from './contracts';

const readTool = {
  name: 'read',
  description: 'Read data',
  inputSchema: z.object({}),
  access: 'read' as const,
};

describe('tool contracts', () => {
  it('requires one handler for every declared tool', () => {
    expect(() => assertToolRegistryComplete([readTool], {})).toThrow(
      'Missing tool handler: read',
    );
    expect(() =>
      assertToolRegistryComplete([readTool], {
        read: async () => null,
      }),
    ).not.toThrow();
  });

  it('rejects duplicate names and unapproved writes', () => {
    expect(() =>
      assertToolRegistryComplete([readTool, readTool], {
        read: async () => null,
      }),
    ).toThrow('Duplicate tool spec: read');
    expect(() =>
      assertToolAccess({ ...readTool, access: 'write' }, false),
    ).toThrow('Write tool requires explicit approval: read');
  });
});
