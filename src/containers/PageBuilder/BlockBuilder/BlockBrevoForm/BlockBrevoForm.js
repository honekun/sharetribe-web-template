import React, { useEffect, useRef } from 'react';
import css from './BlockBrevoForm.module.css';

const stripCodeFences = raw => {
  const fenceMatch = raw.match(/^```[\w]*\n?([\s\S]*?)```$/m);
  return fenceMatch ? fenceMatch[1].trim() : raw.trim();
};

const BlockBrevoForm = ({ blockId, text }) => {
  const wrapRef = useRef(null);
  const raw = text?.content || (typeof text === 'string' ? text : '');
  const html = stripCodeFences(raw);

  // Sibforms iframes post their content height to the parent window.
  // Listen for it and update the iframe height so nothing is clipped.
  useEffect(() => {
    if (!wrapRef.current) return;

    const onMessage = e => {
      if (!e.data || typeof e.data !== 'object') return;
      const height = e.data.height || e.data.frameHeight;
      if (!height || !wrapRef.current) return;
      const iframe = wrapRef.current.querySelector('iframe');
      if (iframe) iframe.style.height = `${height}px`;
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!html) return null;

  return (
    <div id={blockId} className={css.root}>
      <div
        ref={wrapRef}
        className={css.formWrap}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

export default BlockBrevoForm;
