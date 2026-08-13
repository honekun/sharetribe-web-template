const mockFetchTopbarData = jest.fn();
const mockFetchDesignUsers = jest.fn();

jest.mock(
  '../../containers/TopbarContainer/Topbar/TopbarDesktop/AVLinksMenu/categoryDropdowns',
  () => ({
    fetchLocalTopbarData: (...args) => mockFetchTopbarData(...args),
  })
);
jest.mock(
  '../../containers/TopbarContainer/Topbar/TopbarDesktop/AVLinksMenu/userDropdowns',
  () => ({
    fetchLocalDesignUsers: (...args) => mockFetchDesignUsers(...args),
  })
);

const {
  getTopbarData,
  getLocalDesignUsers,
  resetTopbarDataCache,
} = require('./topbarDataProvider');

describe('topbarDataProvider', () => {
  beforeEach(() => {
    mockFetchTopbarData.mockReset();
    mockFetchDesignUsers.mockReset();
    resetTopbarDataCache();
  });

  it('fetches the design users once for concurrent callers', async () => {
    // The desktop and mobile menus are both mounted, and ask at the same time.
    let resolveUsers;
    mockFetchDesignUsers.mockImplementation(
      () => new Promise(resolve => (resolveUsers = () => resolve([{ id: 'u-1', text: 'Alfa' }])))
    );

    const desktop = getLocalDesignUsers();
    const mobile = getLocalDesignUsers();
    // The provider starts the fetch on a microtask, so let it run first.
    await Promise.resolve();
    resolveUsers();

    const [fromDesktop, fromMobile] = await Promise.all([desktop, mobile]);

    expect(mockFetchDesignUsers).toHaveBeenCalledTimes(1);
    expect(fromDesktop).toEqual([{ id: 'u-1', text: 'Alfa' }]);
    expect(fromMobile).toEqual(fromDesktop);
  });

  it('reuses the resolved design users on later calls', async () => {
    mockFetchDesignUsers.mockResolvedValue([{ id: 'u-1', text: 'Alfa' }]);

    await getLocalDesignUsers();
    await getLocalDesignUsers();

    expect(mockFetchDesignUsers).toHaveBeenCalledTimes(1);
  });

  it('fetches the topbar data once for concurrent callers', async () => {
    mockFetchTopbarData.mockResolvedValue({ categoryDropdowns: {} });

    const [first, second] = await Promise.all([getTopbarData(), getTopbarData()]);

    expect(mockFetchTopbarData).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ categoryDropdowns: {} });
    expect(second).toEqual(first);
  });

  it('lets the next caller retry after a failure', async () => {
    mockFetchDesignUsers.mockRejectedValueOnce(new Error('network'));
    expect(await getLocalDesignUsers()).toEqual([]);

    mockFetchDesignUsers.mockResolvedValueOnce([{ id: 'u-1', text: 'Alfa' }]);
    expect(await getLocalDesignUsers()).toEqual([{ id: 'u-1', text: 'Alfa' }]);
    expect(mockFetchDesignUsers).toHaveBeenCalledTimes(2);
  });

  it('keeps the two datasets independent', async () => {
    mockFetchTopbarData.mockResolvedValue({ categoryDropdowns: {} });
    mockFetchDesignUsers.mockResolvedValue([]);

    await Promise.all([getTopbarData(), getLocalDesignUsers()]);

    expect(mockFetchTopbarData).toHaveBeenCalledTimes(1);
    expect(mockFetchDesignUsers).toHaveBeenCalledTimes(1);
  });
});
