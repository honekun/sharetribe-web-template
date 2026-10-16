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

// Which signed-in user the bag belongs to. Kept under its own key so the
// av_bag_v1 format is unchanged; absent means a guest bag.
export const BAG_OWNER_STORAGE_KEY = 'av_bag_owner_v1';

export const readBagOwner = () => {
  if (!hasStorage()) return null;
  try {
    return window.localStorage.getItem(BAG_OWNER_STORAGE_KEY) || null;
  } catch (e) {
    return null;
  }
};

export const writeBagOwner = ownerId => {
  if (!hasStorage()) return;
  try {
    if (ownerId) {
      window.localStorage.setItem(BAG_OWNER_STORAGE_KEY, ownerId);
    } else {
      window.localStorage.removeItem(BAG_OWNER_STORAGE_KEY);
    }
  } catch (e) {
    // Storage blocked — the bag itself is then session-only anyway.
  }
};
