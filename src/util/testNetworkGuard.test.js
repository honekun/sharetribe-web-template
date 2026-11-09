// The Jest setup (config/jest/avNoNetwork.js) keeps unit tests off the network:
// an unmocked request must fail at once, never open a connection.

describe('unit-test network guard', () => {
  it('fails an unmocked fetch the way a refused connection does', async () => {
    await expect(window.fetch('/static/data/top-bar.json')).rejects.toThrow(TypeError);
    await expect(window.fetch('/api/topbar/local-design-users')).rejects.toThrow(
      /do not reach the network \(\/api\/topbar\/local-design-users\)/
    );
  });

  it('still lets a test install its own fetch mock', async () => {
    const guard = window.fetch;
    window.fetch = jest.fn().mockResolvedValue({ ok: true });
    try {
      await expect(window.fetch('/anything')).resolves.toEqual({ ok: true });
    } finally {
      window.fetch = guard;
    }
  });
});
