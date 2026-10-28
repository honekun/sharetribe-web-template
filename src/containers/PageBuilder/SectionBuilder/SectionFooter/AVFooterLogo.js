import React from 'react';
import classNames from 'classnames';

import logoImageWhite from '../../../../assets/logo_av_white.png';
import { useConfiguration } from '../../../../context/configurationContext';
import { ExternalLink, NamedLink } from '../../../../components';

import css from './AVFooterLogo.module.css';

/** Footer-only static white logo, kept separate from upstream Logo/LinkedLogo. */
const AVFooterLogo = props => {
  const {
    id,
    className,
    rootClassName,
    logoClassName,
    logoImageClassName,
    linkToExternalSite,
    alt,
    ...rest
  } = props;
  const config = useConfiguration();
  const classes = classNames(rootClassName, className);
  const logo = (
    <div className={logoClassName}>
      <img
        className={classNames(logoImageClassName, css.logoWhite)}
        src={logoImageWhite}
        alt={alt || config.marketplaceName}
      />
    </div>
  );

  return linkToExternalSite?.href ? (
    <ExternalLink className={classes} href={linkToExternalSite.href} target="_self" {...rest}>
      {logo}
    </ExternalLink>
  ) : (
    <NamedLink id={id} className={classes} name="LandingPage" {...rest}>
      {logo}
    </NamedLink>
  );
};

export default AVFooterLogo;
