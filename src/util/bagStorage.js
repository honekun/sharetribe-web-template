export const BAG_STORAGE_KEY = 'av_bag_v1';

const hasStorage = () => typeof window !== 'undefined' && !!window.localStorage;

export const readBag = () => {
  if (!hasStorage()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BAG_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch (e) {
    return [];
  }
};

export const writeBag = ids => {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(BAG_STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    // Storage full or blocked (private mode) — bag becomes session-only.
  }
};
