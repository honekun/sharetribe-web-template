import React from 'react';
import '@testing-library/jest-dom';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import BagLink from './BagLink';

const { screen, userEvent, waitFor } = testingLibrary;

const messages = {
  'BagLink.label': 'Shopping bag',
  'BagPopup.titleLabel': 'Your bag',
  'BagPopup.titleCount': '{count} items',
  'BagPopup.close': 'Close',
  'BagPopup.goToBag': 'Go to bag',
};

const withItems = {
  bag: { bagListingIds: ['a', 'b'], isPopupOpen: false, hydrated: true },
};
const popupOpen = {
  bag: { bagListingIds: ['a', 'b'], isPopupOpen: true, hydrated: true },
};

// jsdom has no matchMedia. Stub it so the layout the component believes it is
// in is explicit in every test rather than an accident of the environment.
const mockViewport = ({ isDesktop }) => {
  window.matchMedia = jest.fn(() => ({
    matches: isDesktop,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

describe('BagLink', () => {
  afterEach(() => {
    delete window.matchMedia;
  });

  it('links to the bag page', () => {
    render(<BagLink />, { messages });
    expect(screen.getByRole('link', { name: /shopping bag/i })).toHaveAttribute('href', '/bag');
  });

  it('shows a count badge when bag has items', () => {
    render(<BagLink />, { messages, initialState: withItems });
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('hides the badge when empty', () => {
    render(<BagLink />, { messages });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  describe('popup ownership', () => {
    it('renders no popup without a popupLayout, even when the popup is open', () => {
      mockViewport({ isDesktop: true });
      render(<BagLink />, { messages, initialState: popupOpen });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the popup on the layout that is on screen', async () => {
      mockViewport({ isDesktop: true });
      render(<BagLink popupLayout="desktop" />, { messages, initialState: popupOpen });
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    });

    it('renders no popup on the layout that is off screen', async () => {
      mockViewport({ isDesktop: true });
      render(<BagLink popupLayout="mobile" />, { messages, initialState: popupOpen });
      // Give the post-mount media-query read a chance to land before asserting.
      await waitFor(() => expect(window.matchMedia).toHaveBeenCalled());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('gives the mobile topbar the popup below --viewportLarge', async () => {
      mockViewport({ isDesktop: false });
      render(<BagLink popupLayout="mobile" />, { messages, initialState: popupOpen });
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    });

    // Both icons share the one global `isPopupOpen`, so hovering the passive
    // copy must not open the dropdown that the owning copy would render.
    it('opens only from the owning icon, not from a passive one', async () => {
      mockViewport({ isDesktop: true });
      render(
        <div>
          <BagLink className="passive" />
          <BagLink className="owner" popupLayout="desktop" />
        </div>,
        { messages, initialState: withItems }
      );
      const [passive, owner] = screen.getAllByRole('link', { name: /shopping bag/i });

      await userEvent.hover(passive);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await userEvent.hover(owner);
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    });

    it('renders exactly one popup when every topbar copy is mounted', async () => {
      mockViewport({ isDesktop: true });
      render(
        <div>
          <BagLink popupLayout="mobile" />
          <BagLink popupLayout="desktop" />
          <BagLink />
        </div>,
        { messages, initialState: popupOpen }
      );
      await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
    });
  });
});
