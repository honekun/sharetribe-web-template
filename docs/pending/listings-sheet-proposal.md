# Proposal: Listings Sheet — create many listings from one screen

Status: awaiting client approval. No development has started.

## The problem today

Sellers with a lot of stock have two options, and neither is good.

**One at a time.** The normal listing form is a multi-step wizard. For 20 items that is 20
trips through the same screens.

**Bulk import (`/admin/bulk-import`).** Faster, but it pushes the work outside the site.
The seller has to build a spreadsheet by hand, then type each option value *exactly* as the
system stores it — `levi-s`, not `Levi's` — then name every photo file to match a column,
then zip everything and upload it. Nothing is checked until after the upload, so mistakes
come back as a list of failed rows and the seller starts over. Wrong values that happen to
be well-formed are not caught at all: they get saved, and the item quietly never shows up
in the right search filters.

## What we propose to build

A spreadsheet inside Archivo Vintach, at `/admin/listings-sheet`.

- **One row per item, one column per field.** The sheet scrolls sideways so every column
  stays wide enough to read.
- **Every option field is a dropdown** — brand, colour, sizes, category, condition, style,
  season. These are the same controls sellers already use in the normal listing form, with
  the same colour swatches and grouped size lists. A seller cannot type an invalid value,
  because they never type one.
- **Categories cascade.** Choosing a category in a row narrows the sub-category choices for
  that row only.
- **One photo column per row**, using the same photo uploader as the normal listing form:
  drag photos in, drag to reorder, 3 to 10 photos per item. Photos upload in the background
  while the seller keeps typing, so pressing Submit is instant.
- **Mistakes are shown as you type**, on the cell that has the problem — not after the fact.
- **Work is saved automatically.** Closing the tab or refreshing by accident does not lose
  the sheet.

When the seller presses Submit, the items are created in the background and a progress bar
shows each row succeeding or failing, with the reason.

## Scope

**Included**

- The sheet page, with the same fields the current bulk import supports.
- Real dropdowns for every option field, sourced from the live marketplace configuration —
  so when new brands or categories are added, the sheet picks them up with no code change.
- Photo column with upload, reorder and per-row validation.
- Automatic draft saving.
- Progress and per-row results after submitting.
- Access rules identical to today's bulk import: any signed-in seller can use it for their
  own listings; operators can additionally create listings on behalf of other sellers.
- Documentation, plus a section in the operator guide.

**Not included in this release** — proposed as a second phase once the sheet is in real use:

- Duplicate a row.
- Fill a whole column with one value at once.
- Paste directly from Excel or Google Sheets.
- Support for very large batches (200+ rows in one sitting).

**Unchanged.** The existing CSV bulk import stays exactly as it is. It remains the right
tool for anyone who prefers to work in Google Sheets. The new page reuses the same
underlying import engine, so the two stay consistent with each other.

## Sizing

Comfortable working size is **10 to 25 items per sheet**, which matches how sellers
actually receive stock. Larger batches still work through the existing CSV import.

## Time and cost

| | |
| --- | --- |
| Estimated effort | **37 hours** |
| With contingency | **~45 hours** |

Cost is that figure at the agreed hourly rate.

Roughly 40% of the effort is the sheet itself (the grid, the dropdown behaviour and the
photo column). The remaining 60% is spread across reusing the existing import engine,
testing, documentation and quality assurance. The estimate is helped considerably by the
fact that the import engine, the photo uploader and all the dropdown controls already
exist and are being reused rather than rebuilt.

## What could move the estimate

- **Making dropdowns open cleanly over a sideways-scrolling sheet** is the least
  predictable piece of the work. It is the main reason for the contingency.
- **Adding any of the second-phase items** to this release. Indicative additional effort:
  duplicate a row ~2 h; fill a column ~4 h; paste from Excel ~8–12 h.
- **Changing the field list.** The estimate assumes the same fields the current bulk
  import handles. Adding fields is inexpensive; adding fields that need a new kind of
  control is not.

## Known limitations we are accepting

- If the server restarts while an import is running, that import is lost and has to be
  resubmitted. This is already true of the current bulk import. The automatic draft saving
  means the seller does not have to retype anything.
- Photos attached to a sheet that is abandoned stay on the server unused. Harmless, and
  already the case today.

## What we need to proceed

1. Approval of the scope and the estimate above.
2. Confirmation that the second-phase items can wait — in particular pasting from Excel,
   which is the most commonly requested and the most expensive.

Once approved, the internal implementation plan is ready and work can begin immediately.
