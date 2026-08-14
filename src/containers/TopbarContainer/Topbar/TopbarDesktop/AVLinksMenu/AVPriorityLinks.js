import React, { useEffect, useRef } from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../../../util/reactIntl';

import { ExternalLink, NamedLink } from '../../../../../components';
import LinksMenuDropdown from './LinksMenuDropdown';

import css from './AVPriorityLinks.module.css';

/**
 * Create component that shows only a single "Post a new listing" (VENDE) link.
 * AV: points to the create-type chooser (single listing vs bulk import)
 * instead of NewListingPage directly.
 *
 * @param {*} props contains customLinksMenuClass
 * @returns div with only one link inside.
 */
export const CreateListingMenuLink = props => {
  return (
    <div className={props.customLinksMenuClass}>
      <NamedLink name="CreateTypePage" className={classNames(css.priorityLink, css.button)}>
        <span className={css.priorityLinkLabel}>
          <FormattedMessage id="TopbarDesktop.createListing" />
        </span>
      </NamedLink>
    </div>
  );
};

/**
 * Create component that shows only a single "Post a new listing" link.
 *
 * @param {*} props contains customLinksMenuClass
 * @returns div with only one link inside.
 */
export const CreateCusomMenusLinks = props => {
  const {
    intl,
    currentPage,
    menuLinksDropdown1,
    menuLinksDropdown2,
    menuLinksDropdown3,
    customLinksCss,
    wrapperStyle,
  } = props;

  return (
    <div style={wrapperStyle}>
      <div className={customLinksCss.leftLinkWrapper}>
        <NamedLink
          name="SearchPage"
          to={{ search: intl.formatMessage({ id: 'Topbar.custom.leftOneHref' }) }}
          className={customLinksCss.leftLink}
        >
          <span className={customLinksCss.leftLinkLabel}>
            <FormattedMessage id="Topbar.custom.leftOne" />
          </span>
        </NamedLink>
      </div>
      {menuLinksDropdown1.length > 0 ? (
        <LinksMenuDropdown
          id="linksMenuDropdown1"
          label={intl.formatMessage({ id: 'Topbar.custom.menuOne' })}
          currentPage={currentPage}
          items={menuLinksDropdown1}
          intl={intl}
        />
      ) : null}
      {menuLinksDropdown2.length > 0 ? (
        <LinksMenuDropdown
          id="linksMenuDropdown2"
          label={intl.formatMessage({ id: 'Topbar.custom.menuTwo' })}
          currentPage={currentPage}
          items={menuLinksDropdown2}
          intl={intl}
        />
      ) : null}
      {menuLinksDropdown3.length > 0 ? (
        <LinksMenuDropdown
          id="linksMenuDropdown3"
          label={intl.formatMessage({ id: 'Topbar.custom.menuThree' })}
          currentPage={currentPage}
          items={menuLinksDropdown3}
          intl={intl}
        />
      ) : null}
    </div>
  );
};

/**
 * Link component that can be used on TopbarDesktop.
 *
 * @param {*} props containing linkConfig including resolved 'route' params for NamedLink.
 * @returns NamedLink or ExternalLink component based on config.
 */
const PriorityLink = ({ linkConfig }) => {
  const { text, type, href, route, highlight } = linkConfig;
  const classes = classNames(css.priorityLink, { [css.highlight]: highlight });
  const id = `priority-link-${text.toLowerCase().replace(/ /g, '-')}`;

  // Note: if the config contains 'route' keyword,
  // then in-app linking config has been resolved already.
  if (type === 'internal' && route) {
    // Internal link
    const { name, params, to } = route || {};
    return (
      <NamedLink name={name} params={params} to={to} className={classes} id={id}>
        <span className={css.priorityLinkLabel}>{text}</span>
      </NamedLink>
    );
  }
  return (
    <ExternalLink href={href} className={classes}>
      <span className={css.priorityLinkLabel}>{text}</span>
    </ExternalLink>
  );
};

/**
 * Create priority links, which are visible on the desktop layout on the Topbar.
 * If space is limited, this doesn't include anything to the Topbar.
 *
 * @param {*} props contains links array and setLinks function
 * @returns list of priority links.
 */
const PriorityLinks = props => {
  const containerRef = useRef(null);

  // With this useEffect, we measure the widths of each rendered priority link
  // This is done once before the real rendering and it's done outside the viewport.
  useEffect(() => {
    const isMeasured = props.links?.[0]?.width;
    if (containerRef.current && !isMeasured) {
      const linksFromRenderedWrapper = [...containerRef.current.childNodes];
      let cumulatedWidth = 0;
      // Generate an array of link configs with width & cumulatedWidth included
      const linksWithWidths = props.links.reduce((links, l, i) => {
        const width = linksFromRenderedWrapper[i].offsetWidth;
        cumulatedWidth = cumulatedWidth + width;
        return [...links, { ...l, width, cumulatedWidth }];
      }, []);
      props.setLinks(linksWithWidths);
    }
  }, [containerRef]);

  const { links, priorityLinks } = props;
  const isMeasured = links?.[0]?.width && (priorityLinks.length === 0 || priorityLinks?.[0]?.width);
  const styleWrapper = !!isMeasured
    ? {}
    : {
        style: {
          position: 'absolute',
          top: '-2000px',
          left: '-2000px',
          width: '100%',
          height: 'var(--topbarHeightDesktop)',
          display: 'flex',
          flexDirection: 'row',
        },
      };
  const linkConfigs = isMeasured ? priorityLinks : links;

  // Always render inline in the Topbar tree so SSR and the initial client render match.
  // (Portaling to document.body caused hydration mismatches.)
  return (
    <ul className={css.priorityLinkWrapper} {...styleWrapper} ref={containerRef}>
      {linkConfigs.map((linkConfig, index) => {
        // AV: skip links whose label is empty (used to hide hosted links).
        if ('' === linkConfig.text.trim()) {
          return null;
        }
        return (
          <li key={`${linkConfig.text}_${index}`} className={css.priorityLinkItem}>
            <PriorityLink linkConfig={linkConfig} />
          </li>
        );
      })}
    </ul>
  );
};

export default PriorityLinks;
