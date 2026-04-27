import React, { useEffect, useRef } from 'react';
import css from './BlockBrevoForm.module.css';

// Strips markdown code fences if the snippet was pasted inside ``` blocks
const stripCodeFences = raw => {
  const fenceMatch = raw.match(/^```[\w]*\n?([\s\S]*?)```$/m);
  return fenceMatch ? fenceMatch[1].trim() : raw.trim();
};

// Splits raw HTML into { html, scripts[] } so scripts can be executed after mount.
// dangerouslySetInnerHTML does not execute <script> tags — we re-create them.
const extractScripts = html => {
  const scriptPattern = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  const withoutScripts = html.replace(scriptPattern, (_, attrs, content) => {
    const srcMatch = attrs.match(/src=["']([^"']+)["']/);
    scripts.push({ src: srcMatch ? srcMatch[1] : null, content: content.trim() });
    return '';
  });
  return { html: withoutScripts, scripts };
};

const BlockBrevoForm = ({ blockId, text }) => {
  const containerRef = useRef(null);
  const raw = text?.content || (typeof text === 'string' ? text : '');
  const snippet = stripCodeFences(raw);
  const { html, scripts } = extractScripts(snippet);

  useEffect(() => {
    if (!containerRef.current || !scripts.length) return;
    const injected = [];

    scripts.forEach(({ src, content }) => {
      const el = document.createElement('script');
      if (src) {
        el.src = src;
        el.async = true;
      } else if (content) {
        el.textContent = content;
      }
      document.body.appendChild(el);
      injected.push(el);
    });

    return () => {
      injected.forEach(el => el.remove());
    };
  // Re-run only when the snippet changes (block reconfigured)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snippet]);

  if (!html) return null;

  return (
    <div id={blockId} className={css.root}>
      <div
        ref={containerRef}
        className={css.formWrap}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

export default BlockBrevoForm;
