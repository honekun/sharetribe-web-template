import { readBag, writeBag, BAG_STORAGE_KEY } from './bagStorage';

describe('bagStorage', () => {
  beforeEach(() => window.localStorage.clear());

  it('returns [] when nothing stored', () => {
    expect(readBag()).toEqual([]);
  });

  it('round-trips ids', () => {
    writeBag(['a', 'b']);
    expect(readBag()).toEqual(['a', 'b']);
    expect(JSON.parse(window.localStorage.getItem(BAG_STORAGE_KEY))).toEqual(['a', 'b']);
  });

  it('returns [] for corrupt JSON', () => {
    window.localStorage.setItem(BAG_STORAGE_KEY, '{not json');
    expect(readBag()).toEqual([]);
  });

  it('returns [] for non-array payloads', () => {
    window.localStorage.setItem(BAG_STORAGE_KEY, '{"a":1}');
    expect(readBag()).toEqual([]);
  });
});
