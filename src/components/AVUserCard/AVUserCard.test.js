import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import AVUserCard from './AVUserCard';

const { screen } = testingLibrary;

const mockUser = {
  id: { uuid: 'user-1' },
  attributes: {
    profile: {
      displayName: 'Ana García',
      publicData: { storeName: 'Mi Tienda' },
    },
  },
  profileImage: {
    attributes: {
      variants: {
        'square-small2x': { url: 'https://example.com/avatar.jpg' },
      },
    },
  },
};

const mockMedia = {
  image: {
    attributes: {
      variants: {
        original800: { url: 'https://example.com/override.jpg' },
      },
    },
  },
};

describe('AVUserCard', () => {
  it('renders nothing when user has no id', () => {
    const { container } = render(<AVUserCard user={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('links to the user ProfilePage', () => {
    render(<AVUserCard user={mockUser} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('user-1'));
  });

  it('prefers storeName over displayName', () => {
    render(<AVUserCard user={mockUser} />);
    expect(screen.getByText('Mi Tienda')).toBeInTheDocument();
  });

  it('overrideTitle takes priority over storeName', () => {
    render(<AVUserCard user={mockUser} overrideTitle="Custom Name" />);
    expect(screen.getByText('Custom Name')).toBeInTheDocument();
  });

  it('shows profile image when no overrideMedia', () => {
    const { container } = render(<AVUserCard user={mockUser} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('overrideMedia takes priority over profile image', () => {
    const { container } = render(<AVUserCard user={mockUser} overrideMedia={mockMedia} />);
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/override.jpg'
    );
  });

  it('treats the image as decorative so the name is announced once', () => {
    const { container } = render(<AVUserCard user={mockUser} />);
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('link')).toHaveAccessibleName('Mi Tienda');
  });

  it('hides the initials placeholder from assistive technology', () => {
    const userNoImage = {
      id: { uuid: 'user-4' },
      attributes: { profile: { displayName: 'Diana Paz' } },
    };
    render(<AVUserCard user={userNoImage} />);
    expect(screen.getByRole('link')).toHaveAccessibleName('Diana Paz');
  });

  it('renders initials placeholder when no image available', () => {
    const userNoImage = {
      id: { uuid: 'user-2' },
      attributes: { profile: { displayName: 'Beatriz López' } },
    };
    const { container } = render(<AVUserCard user={userNoImage} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('falls back to displayName when storeName is absent', () => {
    const userNoStore = {
      id: { uuid: 'user-3' },
      attributes: { profile: { displayName: 'Carlos Ruiz', publicData: {} } },
    };
    render(<AVUserCard user={userNoStore} />);
    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument();
  });

  it('matches snapshot', () => {
    const { asFragment } = render(<AVUserCard user={mockUser} />);
    expect(asFragment().firstChild).toMatchSnapshot();
  });
});
