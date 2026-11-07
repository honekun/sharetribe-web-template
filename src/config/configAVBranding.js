// Client-supplied icon artwork is code-owned. Keep the hosted branding config
// for logos, colors, and sharing images; override only the page's icon assets.
const iconPath = '/static/icons';

export const themeColor = '#0f26e4';

export const favicon = {
  type: 'imageAsset',
  attributes: {
    variants: Object.fromEntries(
      [16, 32, 48, 96].map(size => [
        `square${size}`,
        { url: `${iconPath}/favicon-${size}x${size}.png`, width: size, height: size },
      ])
    ),
  },
};

export const appIcon = {
  type: 'imageAsset',
  attributes: {
    variants: {
      square180: { url: `${iconPath}/apple-touch-icon.png`, width: 180, height: 180 },
    },
  },
};
