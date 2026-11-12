import { describe, expect, it } from 'vitest';
import { loginKey } from './loginKey';

describe('loginKey', () => {
  it('is the same for the same username and password, whatever the case of the username', async () => {
    const a = await loginKey('jani', 'secret123');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await loginKey(' Jani ', 'secret123')).toBe(a);
  });
  it('changes with the password or the username', async () => {
    const a = await loginKey('jani', 'secret123');
    expect(await loginKey('jani', 'secret124')).not.toBe(a);
    expect(await loginKey('jani2', 'secret123')).not.toBe(a);
  });
});
