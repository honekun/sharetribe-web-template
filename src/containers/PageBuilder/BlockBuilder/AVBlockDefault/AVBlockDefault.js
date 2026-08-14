import React from 'react';

import { useIntl } from '../../../../util/reactIntl';
import {
  buildAvBlockProps,
  resolveAvBlockComponent,
} from '../../../../extensions/pageBuilder/av/blocks';
import sectionCss from '../../SectionBuilder/SectionBuilder.module.css';

import AVBlockDefaultView from './AVBlockDefaultView';

/**
 * AV replacement for upstream's `defaultBlock`.
 *
 * Registered through `options.blockComponents` (see
 * `extensions/pageBuilder/av/blocks.js` and the injection in `SectionBuilder`),
 * which is what lets upstream's `BlockBuilder` and `BlockDefault` stay
 * byte-identical. Everything AV used to patch into BlockBuilder happens here:
 *
 * 1. token-driven props parsed out of `blockName` (and the microcopy they key),
 * 2. CTA classes layered onto the class the section passed down,
 * 3. re-routing to an AV block component picked by `blockId` / `blockName`.
 *
 * The AV block components it re-routes to render `AVBlockDefaultView` directly,
 * never this component — otherwise a `photoSlider ::` block would dispatch to
 * itself forever.
 *
 * @component
 * @param {Object} props - block props as passed by BlockBuilder
 * @returns {JSX.Element}
 */
const AVBlockDefault = props => {
  const intl = useIntl();
  const avProps = buildAvBlockProps(props, intl, sectionCss, props.ctaButtonClass);
  const AVBlock = resolveAvBlockComponent(props);
  const Block = AVBlock || AVBlockDefaultView;

  return <Block {...props} {...avProps} />;
};

export default AVBlockDefault;
