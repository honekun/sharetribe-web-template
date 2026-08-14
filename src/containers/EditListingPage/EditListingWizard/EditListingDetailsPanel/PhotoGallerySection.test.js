import React from 'react';
import '@testing-library/jest-dom';

import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import PhotoGallerySection, { getReorderedImages } from './PhotoGallerySection';

const { screen, waitFor, fireEvent } = testingLibrary;

const noop = () => null;

const imageFile = name => new File(['x'], name, { type: 'image/jpeg' });

// Renderable image, as EditListingDetailsPanel passes them in.
const uploadedImage = id => ({
  id: { uuid: id },
  type: 'image',
  attributes: {
    variants: {
      'listing-card': { url: `https://cdn.test/${id}.jpg`, width: 400, height: 400 },
    },
  },
});

const imagesOf = count => Array.from({ length: count }, (_, i) => uploadedImage(`img-${i + 1}`));

const baseProps = {
  onImageUpload: noop,
  onRemoveImage: noop,
  onReorderImages: noop,
  listingImageConfig: { aspectWidth: 1, aspectHeight: 1, variantPrefix: 'listing-card' },
};

const renderGallery = (props = {}) => {
  const view = render(<PhotoGallerySection {...baseProps} {...props} />);
  return { ...view, fileInput: document.getElementById('gallery-add-image') };
};

const selectFiles = (fileInput, files) => fireEvent.change(fileInput, { target: { files } });

describe('PhotoGallerySection uploads', () => {
  it('uploads every selected file when there is room', async () => {
    const onImageUpload = jest.fn();
    const { fileInput } = renderGallery({ images: [], onImageUpload });

    selectFiles(fileInput, [imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')]);

    await waitFor(() => expect(onImageUpload).toHaveBeenCalledTimes(3));
    const uploadedNames = onImageUpload.mock.calls.map(([data]) => data.file.name);
    expect(uploadedNames).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  it('uploads only what fits when the selection would pass the limit', async () => {
    const onImageUpload = jest.fn();
    const { fileInput } = renderGallery({ images: imagesOf(9), onImageUpload });

    selectFiles(fileInput, [imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')]);

    await waitFor(() => expect(onImageUpload).toHaveBeenCalledTimes(1));
    expect(onImageUpload.mock.calls[0][0].file.name).toBe('a.jpg');
    expect(screen.getByText('EditListingDetailsPanel.photosLimitSkipped')).toBeInTheDocument();
  });

  it('uploads nothing once the limit is reached', async () => {
    const onImageUpload = jest.fn();
    const { fileInput } = renderGallery({ images: imagesOf(10), onImageUpload });

    selectFiles(fileInput, [imageFile('a.jpg')]);

    await waitFor(() =>
      expect(screen.getByText('EditListingDetailsPanel.photosMaxReached')).toBeInTheDocument()
    );
    expect(onImageUpload).not.toHaveBeenCalled();
  });

  it('ignores files that are not images', async () => {
    const onImageUpload = jest.fn();
    const { fileInput } = renderGallery({ images: [], onImageUpload });

    const pdf = new File(['x'], 'notes.pdf', { type: 'application/pdf' });
    selectFiles(fileInput, [pdf, imageFile('a.jpg')]);

    await waitFor(() => expect(onImageUpload).toHaveBeenCalledTimes(1));
    expect(onImageUpload.mock.calls[0][0].file.name).toBe('a.jpg');
    // Non-images are not "skipped for space", so no limit message.
    expect(
      screen.queryByText('EditListingDetailsPanel.photosLimitSkipped')
    ).not.toBeInTheDocument();
  });

  it('applies the same limit to dropped files', async () => {
    const onImageUpload = jest.fn();
    const { container } = renderGallery({ images: imagesOf(9), onImageUpload });

    fireEvent.drop(container.firstChild, {
      dataTransfer: { files: [imageFile('a.jpg'), imageFile('b.jpg')] },
    });

    await waitFor(() => expect(onImageUpload).toHaveBeenCalledTimes(1));
    expect(screen.getByText('EditListingDetailsPanel.photosLimitSkipped')).toBeInTheDocument();
  });

  it('keeps uploading the rest when one upload fails', async () => {
    const onImageUpload = jest
      .fn()
      .mockRejectedValueOnce(new Error('upload failed'))
      .mockResolvedValue(undefined);
    const { fileInput } = renderGallery({ images: [], onImageUpload });

    selectFiles(fileInput, [imageFile('a.jpg'), imageFile('b.jpg')]);

    await waitFor(() => expect(onImageUpload).toHaveBeenCalledTimes(2));
  });
});

describe('PhotoGallerySection errors', () => {
  it('shows the upload error returned by the API', () => {
    renderGallery({ images: imagesOf(3), uploadImageError: { status: 400 } });
    expect(
      screen.getByText('EditListingPhotosForm.imageUploadFailed.uploadFailed')
    ).toBeInTheDocument();
  });

  it('shows the panel validation error instead of the upload error', () => {
    renderGallery({
      images: imagesOf(2),
      uploadImageError: { status: 400 },
      photoError: 'EditListingDetailsPanel.photosMinRequired',
    });

    expect(screen.getByText('EditListingDetailsPanel.photosMinRequired')).toBeInTheDocument();
    expect(
      screen.queryByText('EditListingPhotosForm.imageUploadFailed.uploadFailed')
    ).not.toBeInTheDocument();
  });

  it('shows the add tip until the limit is reached', () => {
    const { unmount } = renderGallery({ images: imagesOf(3) });
    expect(screen.getByText('EditListingDetailsPanel.photosAddTip')).toBeInTheDocument();
    unmount();

    renderGallery({ images: imagesOf(10) });
    expect(screen.getByText('EditListingDetailsPanel.photosMaxReached')).toBeInTheDocument();
  });
});

describe('PhotoGallerySection reordering', () => {
  it('renders the four labelled slots, filling them with images first', () => {
    renderGallery({ images: imagesOf(2) });

    // Two uploaded images plus two remaining placeholders, all labelled.
    expect(screen.getByText('EditListingDetailsPanel.photoLabel1')).toBeInTheDocument();
    expect(screen.getByText('EditListingDetailsPanel.photoLabel4')).toBeInTheDocument();
    expect(document.querySelectorAll('img')).toHaveLength(2);
  });

  it('makes every image draggable so the order can be changed', () => {
    renderGallery({ images: imagesOf(5) });

    // @dnd-kit marks each sortable item with a draggable role/attributes.
    const sortables = document.querySelectorAll('[aria-roledescription="sortable"]');
    expect(sortables).toHaveLength(5);
  });

  // The drag itself cannot be driven here: @dnd-kit's pointer and keyboard
  // sensors need real layout measurements, which jsdom does not provide. The
  // ordering the drop computes is covered directly instead.
  it('moves the dragged image to the position it was dropped on', () => {
    const images = imagesOf(3);
    expect(getReorderedImages(images, 'img-1', 'img-3').map(i => i.id.uuid)).toEqual([
      'img-2',
      'img-3',
      'img-1',
    ]);
    expect(getReorderedImages(images, 'img-3', 'img-1').map(i => i.id.uuid)).toEqual([
      'img-3',
      'img-1',
      'img-2',
    ]);
  });

  it('leaves the order alone when an id is not in the list', () => {
    const images = imagesOf(3);
    expect(getReorderedImages(images, 'img-1', 'gone')).toBe(images);
    expect(getReorderedImages(images, 'gone', 'img-1')).toBe(images);
  });
});
