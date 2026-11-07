import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';

import { useConfiguration } from '../../context/configurationContext';
import { appIcon, favicon, themeColor } from '../../config/configAVBranding';

import Page from '../Page/Page';

// Override icon configuration at the composition root. The upstream Page keeps
// ownership of SEO, PNG/Apple links, the manifest link, and page behavior.
const AVPage = ({ children, config: configOverride, ...props }) => {
  const configuration = useConfiguration();
  const config = configOverride || configuration;
  const pageConfig = useMemo(
    () => ({ ...config, branding: { ...config.branding, favicon, appIcon } }),
    [config]
  );

  return (
    <Page {...props} config={pageConfig}>
      <Helmet>
        <link rel="icon" href="/static/icons/favicon.ico" sizes="16x16 32x32 48x48" />
        <link rel="icon" href="/static/icons/favicon.svg" type="image/svg+xml" sizes="any" />
        <meta name="theme-color" content={themeColor} />
      </Helmet>
      {children}
    </Page>
  );
};

export default AVPage;
