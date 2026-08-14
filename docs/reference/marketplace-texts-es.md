# Spanish marketplace-text reference

[`marketplace-texts-es.json`](marketplace-texts-es.json) is the paste-ready Spanish marketplace-text
object for **Sharetribe Test**. It was reconciled on 2026-08-14 from the latest published
`content/translations.json` asset (version `4M8YKwGH0ETFXvaKgKUxxA`, last modified 2026-08-14
18:38:35 UTC), the app's required `es_av.json` fallbacks, and used upstream Spanish defaults from
`es.json`.

The file contains 1,990 used keys:

- 1,532 retained from the current Test Console asset.
- 86 required local keys that were missing from that asset.
- 372 runtime keys whose Spanish defaults exist in upstream `es.json` but were missing from both
  Console and the AV overlay (169 direct message IDs plus 203 dynamic/pass-through IDs).

For duplicate keys, the Console value wins. This matches `src/app.js`, which passes
`{ ...localeMessages, ...hostedTranslations }` to React Intl. The local Spanish runtime fallback is
`es_av.json`; `es.json` is not loaded, so missing keys otherwise fall back to `en.json`.

The audit removed 13 confirmed stale AV keys from both overlay files and from this reference. Twelve
of them were also present in Console and are intentionally absent from the paste-ready replacement.
Four additional stale upstream keys were excluded while the dynamic transaction, configuration, and
PageBuilder key families were retained unless their runtime producer was conclusively absent.

Test and Live are separate Sharetribe environments. Review and publish this object in Test first,
then copy the approved content to Live through the normal content-release process. Preserve ICU
placeholders such as `{count}`, plural/select expressions, and link variables exactly.
