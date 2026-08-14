# Spanish Email-text reference

[`email-texts-es.json`](email-texts-es.json) is the paste-ready Spanish Email-text object for
**Sharetribe Test**. It was reconciled on 2026-08-14 from:

- the latest published `content/email-texts.json` asset (version `B0DfbP7tzRD3mHWGHj0JyQ`, last
  modified 2026-08-14 19:52:00 UTC);
- [Sharetribe's current official Spanish Email texts](https://github.com/sharetribe/sharetribe-texts/blob/main/email-texts/es.json)
  (`email-texts/es.json`, Git object `527441c804d23767e08fee23e755310561f73c37`); and
- every Email-text key referenced by the five transaction-process template families under
  `ext/transaction-processes/`.

The file contains 594 keys:

- 584 current Sharetribe Spanish defaults, including built-in account emails and the booking,
  inquiry, purchase, negotiation, and download process families.
- 10 used template keys missing from both the official Spanish file and the current Console asset:
  `BookingMoneyPaid.StartLabel`, `BookingMoneyPaid.EndLabel`, and the eight
  `PurchaseShippingReminderFinal.*` keys.

Of the 584 default keys, 316 are already present in Test Console and retain the exact Console value.
Thirty-three of those values differ from the current Sharetribe default. In every duplicate, the
Console value wins.

The current Test listing configuration uses `default-purchase/release-1`. The complete reference
also keeps the other four process families supported by this app so their Spanish Email texts are
present if those listing types are enabled. The two latest built-in attachment-message keys are also
included even though they have not yet been added to the current Console asset.

Eleven Console-only `UserJoined.*` keys were excluded because neither Sharetribe's current built-in
Email-text set nor any repository transaction template references them. The separate AV seller
welcome email is delivered through Brevo and does not read Sharetribe Email texts.

The misspelled `PurhcaseNewOrder.Cta` key is intentionally retained because the purchase template
actively calls that exact key. Also note that the local download template calls
`DownloadCompletedFromReportedToProvider.ContentParagraph1` for two different paragraphs; fixing
that template requires a separate transaction-process deployment and is not part of this reference
file.

Transaction templates load the hosted object with
`{{set-translations (asset "content/email-texts.json")}}`. A hosted value therefore overrides the
English fallback embedded in the template. There is no local Spanish Email-text JSON used at
runtime.

Test and Live are separate Sharetribe environments. Review and publish this object in Test first,
then copy the approved content to Live through the normal content-release process. Preserve ICU
arguments such as `{listingTitle}`, plural/select expressions, and HTML link placeholders such as
`<salelink>...</salelink>` exactly.
