import { isPesapalLiveEnv } from '../environment';

describe('isPesapalLiveEnv', () => {
  it('treats production and live as live Pesapal', () => {
    expect(isPesapalLiveEnv('production')).toBe(true);
    expect(isPesapalLiveEnv('live')).toBe(true);
    expect(isPesapalLiveEnv('LIVE')).toBe(true);
  });

  it('treats sandbox as non-live', () => {
    expect(isPesapalLiveEnv('sandbox')).toBe(false);
    expect(isPesapalLiveEnv('')).toBe(false);
  });
});
