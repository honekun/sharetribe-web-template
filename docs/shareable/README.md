# Shareable operator guide

[`../operator-guide.md`](../operator-guide.md) is the canonical, complete operator source.

- `operator-guide.html` is the English single-file edition. Rebuild it after every source change:

  ```sh
  node docs/shareable/build-shareable-guide.js
  ```

  Supplemental implementation and pending-work links point to the repository's `main` branch so they
  remain usable when the HTML is sent by itself; they require network access. All essential operator
  procedures must remain in the canonical guide itself.

- [`pending/operator-guide-es.html`](pending/operator-guide-es.html) is a manually maintained
  Spanish draft with no Markdown source. It is explicitly marked pending synchronization and is not
  an operationally current guide. Preserve its layout, translate changes section by section from the
  canonical guide, and compare the table of contents and section count before moving it back here
  for distribution. Never treat it as the source for a future guide.

After generation, open every edition intended for distribution, test search/navigation and table
overflow, and confirm no secret or environment-specific value was copied into it.
