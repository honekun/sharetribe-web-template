import { parseFilterFromBlockName } from './listings';

describe('parseFilterFromBlockName', () => {
  it('parses tag: prefix into pub_tags filter', () => {
    expect(parseFilterFromBlockName('tag:hot-list')).toEqual({ pub_tags: 'hot-list' });
    expect(parseFilterFromBlockName('tag:summer')).toEqual({ pub_tags: 'summer' });
  });

  it('parses cat: prefix into pub_categoryLevel1 filter', () => {
    expect(parseFilterFromBlockName('cat:blazers')).toEqual({ pub_categoryLevel1: 'blazers' });
    expect(parseFilterFromBlockName('cat:dress-party')).toEqual({ pub_categoryLevel1: 'dress-party' });
  });

  it('defaults plain values to pub_tags filter', () => {
    expect(parseFilterFromBlockName('hot-list')).toEqual({ pub_tags: 'hot-list' });
    expect(parseFilterFromBlockName('summer')).toEqual({ pub_tags: 'summer' });
  });

  it('returns null for empty or missing values', () => {
    expect(parseFilterFromBlockName('')).toBeNull();
    expect(parseFilterFromBlockName(null)).toBeNull();
    expect(parseFilterFromBlockName(undefined)).toBeNull();
  });
});
