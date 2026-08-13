# Archivo Vintach — Operator Guide

This guide covers everything a marketplace operator needs to manage Archivo Vintach: configuring
content through the Sharetribe Console, setting up listing fields and categories, importing listings
in bulk, moderating users and listings, supporting transactions and shipping, and understanding the
application settings. No technical background is required.

> **Canonical source.** This Markdown file is the complete operator source used to build shorter or
> translated editions. Rebuild the English shareable HTML with
> `node docs/shareable/build-shareable-guide.js` after every change. The Spanish HTML is a derived
> draft without its own Markdown source, isolated under `docs/shareable/pending/`. Update and
> compare it section by section before distributing the Spanish edition; it does not block a current
> English-only release.

---

## Table of Contents

1. [Sharetribe Console Overview](#1-sharetribe-console-overview)
2. [Listing Categories](#2-listing-categories)
3. [Listing Fields](#3-listing-fields)
   - [Color](#31-color-field)
   - [Género](#32-género-field)
   - [Estado (Condition)](#33-estado-condition-field)
   - [Estilo](#34-estilo-field)
   - [Tallas (Sizes)](#35-tallas-sizes-field)
   - [Marca (Brand)](#36-marca-brand-field)
4. [Landing Page and CMS Sections](#4-landing-page-and-cms-sections)
   - [Hand-Picked Listing Carousel](#41-hand-picked-listing-carousel-avselections)
   - [Category Card Carousel](#42-category-card-carousel-avselectedcats)
   - [Tag or Category Filtered Carousel](#43-tag-or-category-filtered-carousel-avtaglistings)
   - [Recommended Listings Grid](#44-recommended-listings-grid-avrecommendeds)
   - [User Profile Carousel](#45-user-profile-carousel-avselectedusers)
   - [Instagram-Style Image Grid](#46-instagram-style-image-grid-avinstagrid)
   - [Hero Banner (Standard)](#47-hero-banner-standard-hero)
   - [Hero Banner (Multi-Instance)](#48-hero-banner-multi-instance-avhero2)
   - [Block-Based Hero](#49-block-based-hero-avhero3)
   - [Video + Text Split](#410-video--text-split-avvideo)
5. [Display Options](#5-display-options)
   - [Section Display Options](#51-section-display-options)
   - [Block Name Tokens](#52-block-name-tokens)
6. [Navigation Bar](#6-navigation-bar)
7. [The Hot List](#7-the-hot-list)
8. [Bulk Import Tool](#8-bulk-import-tool)
   - [Overview](#81-overview)
   - [How to Use It](#82-how-to-use-it)
   - [ZIP File Structure](#83-zip-file-structure)
   - [CSV Column Reference](#84-csv-column-reference)
   - [Field Values Quick Reference](#85-field-values-quick-reference)
   - [What Is Validated Before the Import Starts](#86-what-is-validated-before-the-import-starts)
   - [Troubleshooting](#87-troubleshooting)
9. [Application Settings](#9-application-settings)
10. [Custom Translation Strings](#10-custom-translation-strings)
11. [Favorites (Wish List)](#11-favorites-wish-list)
12. [Shopping Bag](#12-shopping-bag)
13. [Upload Chooser Page](#13-upload-chooser-page-create-type)
14. [Marketplace Operations](#14-marketplace-operations)
    - [Access and Environment Safety](#141-access-and-environment-safety)
    - [Content and Configuration Releases](#142-content-and-configuration-releases)
    - [User Management](#143-user-management)
    - [Listing Moderation](#144-listing-moderation)
    - [Transaction and Refund Support](#145-transaction-and-refund-support)
    - [Shipping and Label Support](#146-shipping-and-label-support)
    - [Notification Operations](#147-notification-operations)
    - [Incident Records and Escalation](#148-incident-records-and-escalation)

---

## 1. Sharetribe Console Overview

All marketplace configuration is managed through the **Sharetribe Console** at
[console.sharetribe.com](https://console.sharetribe.com). The main areas you will use:

| Console Area                   | What you manage there                                               |
| ------------------------------ | ------------------------------------------------------------------- |
| **Content → Pages**            | Landing page sections, about page, and other CMS pages              |
| **Content → Assets**           | Hosted JSON and other data files used by current integrations       |
| **Content → Translations**     | Text strings used by custom sections                                |
| **Build → Listing fields**     | Custom product attributes (color, size, brand, etc.)                |
| **Build → Listing types**      | Which fields apply to which listing types                           |
| **Build → Listing categories** | Category tree (Ropa, Bolsas, Zapatos, etc.)                         |
| **Manage → Listings**          | View, edit, and moderate listings                                   |
| **Manage → Users**             | View users and find their UUIDs                                     |
| **Manage → Transactions**      | Find transactions, review state, and use valid operator transitions |
| **Manage → Reviews**           | Review feedback and use available moderation actions                |

---

## 2. Listing Categories

The marketplace uses a three-level category hierarchy. When creating or editing a listing, sellers
choose from these categories.

### Category Tree

| Level 1           | Level 2                     | Level 3                                                                                                                       |
| ----------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Ropa**          | Tops                        | Blusas, T-shirts, Crop-tops, Manga larga, Manga corta, Strapless, Bodys                                                       |
|                   | Camisetas                   | Manga corta, Manga larga, Sin mangas, Oversized, Gráficas / Estampadas, Básicas                                               |
|                   | Camisas                     | Manga corta, Manga larga, Vaqueras, Formales, Casuales, Seda                                                                  |
|                   | Pantalones                  | Formales, Casuales, Leggings, Sweatpants, Vintage, Cargo                                                                      |
|                   | Jeans                       | Mom fit, Boyfriend jeans, Baggy / Oversized, Rectos, Wide leg, Carpenter / Cargo, Acampanados / Flare, Slim fit, Skinny jeans |
|                   | Faldas                      | Larga, Midi, Mini, Denim, Seda                                                                                                |
|                   | Vestidos                    | Vestidos formales, Vestidos casuales, Largos, Midi, Mini, Manga larga, Manga corta, Sin manga, Novia / Bridal                 |
|                   | Chamarras / Abrigos / Sacos | —                                                                                                                             |
|                   | Sudaderas                   | —                                                                                                                             |
|                   | Shorts                      | —                                                                                                                             |
|                   | Ropa deportiva              | —                                                                                                                             |
|                   | Trajes / Sets               | —                                                                                                                             |
|                   | Jumpsuits                   | —                                                                                                                             |
|                   | Lencería / Pijama           | —                                                                                                                             |
|                   | De baño                     | —                                                                                                                             |
|                   | Maternidad                  | —                                                                                                                             |
| **Bolsas**        | De mano                     | —                                                                                                                             |
|                   | Cruzadas                    | —                                                                                                                             |
|                   | Clutch                      | —                                                                                                                             |
|                   | Formales                    | —                                                                                                                             |
|                   | Mochilas casuales           | —                                                                                                                             |
|                   | Mochilas de deporte         | —                                                                                                                             |
|                   | Totes                       | —                                                                                                                             |
|                   | Riñoneras                   | —                                                                                                                             |
|                   | Carteras                    | —                                                                                                                             |
|                   | Monederos                   | —                                                                                                                             |
| **Zapatos**       | Tacones                     | —                                                                                                                             |
|                   | Sandalias                   | —                                                                                                                             |
|                   | Sandalias con tacón         | —                                                                                                                             |
|                   | Zapatillas y Flats          | —                                                                                                                             |
|                   | Mocasines                   | —                                                                                                                             |
|                   | Plataformas                 | —                                                                                                                             |
|                   | Tenis casuales              | —                                                                                                                             |
|                   | Tenis deportivos            | —                                                                                                                             |
|                   | Botas                       | —                                                                                                                             |
|                   | Botas vaqueras              | —                                                                                                                             |
|                   | Botas con tacón             | —                                                                                                                             |
|                   | Botas de montaña            | —                                                                                                                             |
|                   | Botín                       | —                                                                                                                             |
|                   | Botín con tacón             | —                                                                                                                             |
| **Accesorios**    | Gorras / Gorros             | —                                                                                                                             |
|                   | Sombreros                   | —                                                                                                                             |
|                   | Lentes                      | —                                                                                                                             |
|                   | Cinturones                  | —                                                                                                                             |
|                   | Bufandas / Pañuelos         | —                                                                                                                             |
|                   | Joyerías                    | Collares, Aretes, Anillos, Pulseras, Relojes                                                                                  |
|                   | Guantes                     | —                                                                                                                             |
|                   | Otros                       | —                                                                                                                             |
| **Home Antiques** | Antigüedades                | —                                                                                                                             |

### Adding or Editing Categories

Go to **Console → Build → Listing categories**. You can add, rename, or reorder categories. Changes
take effect immediately for new listings. Existing listings already assigned to a category keep
their current assignment.

> **Important:** Category IDs (the short internal codes like `ropa-tops`, `zapatos-botas`) are set
> when a category is created and cannot be changed later. Choose IDs carefully. The display name can
> always be updated.

---

## 3. Listing Fields

Listing fields are the attributes sellers fill in when creating a listing (color, size, brand,
etc.).

> **Important — where each field lives:** Archivo Vintach uses **two sources** for listing fields.
> Most are managed in the Sharetribe Console, but three are defined in the application code and
> **cannot be edited in the Console**.
>
> | Field       | Where it lives                           | Who can edit          |
> | ----------- | ---------------------------------------- | --------------------- |
> | `color`     | App code (`src/config/configListing.js`) | Development team only |
> | `all_sizes` | App code (`src/config/configListing.js`) | Development team only |
> | `brand`     | App code (`src/config/configListing.js`) | Development team only |
> | `genero`    | Console → Build → Listing fields         | Operator              |
> | `estado`    | Console → Build → Listing fields         | Operator              |
> | `estilo`    | Console → Build → Listing fields         | Operator              |
>
> When a field with the same key exists in both Console and code, the **code definition wins**. So
> adding `color`, `all_sizes`, or `brand` in the Console has no effect — the app will ignore the
> Console version and use the code version. To add, rename, or remove options for these three
> fields, ask the development team to update `src/config/configListing.js`.
>
> The sections below describe the canonical setup. For the three code-only fields, the tables
> document what the app expects; you do **not** need to recreate them in the Console.

Fields managed in the Console (**Console → Build → Listing fields**) have:

- **Key** — the internal ID (never changes once created)
- **Schema type** — `enum` (pick one) or `multi-enum` (pick several)
- **Scope** — always `public` for searchable fields
- **Options** — the values sellers can choose from

After creating fields, go to **Console → Build → Listing types**, open your listing type, and add
the fields there so they appear in the listing form.

---

### 3.1 Color Field

> **Code-only field.** `color` is defined in `src/config/configListing.js`. Operators cannot edit it
> in the Console — changes require a development update.

| Property    | Value                                           |
| ----------- | ----------------------------------------------- |
| Key         | `color`                                         |
| Schema type | `multi-enum` (sellers can pick multiple colors) |
| Scope       | `public`                                        |

**Code-defined options:**

| Display Name | Option Key     |
| ------------ | -------------- |
| Rojo         | `rojo`         |
| Rosa         | `rosa`         |
| Amarillo     | `amarillo`     |
| Naranja      | `naranja`      |
| Dorado       | `dorado`       |
| Plateado     | `plateado`     |
| Verde        | `verde`        |
| Azul         | `azul`         |
| Morado       | `morado`       |
| Negro        | `negro`        |
| Gris         | `gris`         |
| Blanco       | `blanco`       |
| Crema        | `crema`        |
| Café         | `cafe`         |
| Animal Print | `animal-print` |
| Floral       | `floral-print` |
| Multicolor   | `multicolor`   |

> **Important:** The option keys must match exactly as shown above (lowercase, hyphens not spaces).
> Adding a color is a development change: update the code-owned option list and add the matching
> swatch image in the same release.

---

### 3.2 Género Field

| Property    | Value             |
| ----------- | ----------------- |
| Key         | `genero`          |
| Schema type | `enum` (pick one) |
| Scope       | `public`          |

**Options:**

| Display Name | Option Key |
| ------------ | ---------- |
| Mujer        | `mujer`    |
| Hombre       | `hombre`   |
| Unisex       | `unisex`   |

---

### 3.3 Estado (Condition) Field

| Property    | Value             |
| ----------- | ----------------- |
| Key         | `estado`          |
| Schema type | `enum` (pick one) |
| Scope       | `public`          |

**Options (add in this order — best to most worn):**

| Display Name       | Option Key           |
| ------------------ | -------------------- |
| Nuevo con etiqueta | `nuevo-con-etiqueta` |
| Nuevo sin etiqueta | `nuevo-sin-etiqueta` |
| Como nuevo         | `como-nuevo`         |
| Buen estado        | `buen-estado`        |
| Usado              | `usado`              |

---

### 3.4 Estilo Field

| Property    | Value                                           |
| ----------- | ----------------------------------------------- |
| Key         | `estilo`                                        |
| Schema type | `multi-enum` (sellers can pick multiple styles) |
| Scope       | `public`                                        |

**Options:**

| Display Name        | Option Key          |
| ------------------- | ------------------- |
| Vintage             | `vintage`           |
| Urbano / Streetwear | `urbano_streetwear` |
| Fiesta / Noche      | `fiesta_noche`      |
| Formal              | `formal`            |
| Casual              | `casual`            |
| Boho                | `boho`              |
| Retro               | `retro`             |
| Oficina             | `oficina`           |
| Vacaciones          | `vacaciones`        |
| Seda                | `seda`              |

---

### 3.5 Tallas (Sizes) Field

> **Code-only field.** `all_sizes` is defined in `src/config/configListing.js`. Operators cannot
> edit it in the Console — changes require a development update.

| Property    | Value                                          |
| ----------- | ---------------------------------------------- |
| Key         | `all_sizes`                                    |
| Schema type | `multi-enum` (sellers can pick multiple sizes) |
| Scope       | `public`                                       |

The grouping (Estándar, MX, US, Curvy, Calzado/Shoes, Anillos/Rings) is handled by the app
automatically. The list below documents the canonical options defined in code.

**Estándar group**

| Display Name | Option Key |
| ------------ | ---------- |
| Unitalla     | `unitalla` |
| XXS          | `xxs`      |
| XS           | `xs`       |
| S            | `s`        |
| M            | `m`        |
| L            | `l`        |
| XL           | `xl`       |

**MX group**

| Display Name | Option Key |
| ------------ | ---------- |
| MX 24        | `mx_24`    |
| MX 25        | `mx_25`    |
| MX 26        | `mx_26`    |
| MX 27        | `mx_27`    |
| MX 28        | `mx_28`    |
| MX 29        | `mx_29`    |
| MX 30        | `mx_30`    |
| MX 31        | `mx_31`    |
| MX 32        | `mx_32`    |
| MX 33        | `mx_33`    |
| MX 34        | `mx_34`    |

**US group**

| Display Name | Option Key |
| ------------ | ---------- |
| US 00        | `us_00`    |
| US 0         | `us_0`     |
| US 2         | `us_2`     |
| US 4         | `us_4`     |
| US 6         | `us_6`     |
| US 8         | `us_8`     |
| US 10        | `us_10`    |
| US 12        | `us_12`    |

**Curvy group**

| Display Name | Option Key |
| ------------ | ---------- |
| 0XL          | `curvy_0x` |
| 1XL          | `curvy_1x` |
| 2XL          | `curvy_2x` |
| 3XL          | `curvy_3x` |
| 4XL          | `curvy_4x` |
| 5XL          | `curvy_5x` |

**Calzado / Shoes group (MX, half sizes)**

| Display Name | Option Key       |
| ------------ | ---------------- |
| MX 22        | `mx_shoes_22x`   |
| MX 22.5      | `mx_shoes_22.5x` |
| MX 23        | `mx_shoes_23x`   |
| MX 23.5      | `mx_shoes_23.5x` |
| MX 24        | `mx_shoes_24x`   |
| MX 24.5      | `mx_shoes_24.5x` |
| MX 25        | `mx_shoes_25x`   |
| MX 25.5      | `mx_shoes_25.5x` |
| MX 26        | `mx_shoes_26x`   |
| MX 26.5      | `mx_shoes_26.5x` |
| MX 27        | `mx_shoes_27x`   |
| MX 27.5      | `mx_shoes_27.5x` |
| MX 28        | `mx_shoes_28x`   |
| MX 28.5      | `mx_shoes_28.5x` |
| MX 29        | `mx_shoes_29x`   |

**Anillos / Rings group**

| Display Name | Option Key |
| ------------ | ---------- |
| 4 / 14.8mm   | `rings_4`  |
| 5 / 15.7mm   | `rings_5`  |
| 6 / 16.5mm   | `rings_6`  |
| 7 / 17.3mm   | `rings_7`  |
| 8 / 18.1mm   | `rings_8`  |
| 9 / 18.9mm   | `rings_9`  |
| 10 / 19.8mm  | `rings_10` |
| 11 / 20.6mm  | `rings_11` |
| 12 / 21.4mm  | `rings_12` |

---

### 3.6 Marca (Brand) Field

> **Code-only field.** `brand` is defined in `src/config/configListing.js`. Operators cannot edit it
> in the Console — changes require a development update.

| Property    | Value                               |
| ----------- | ----------------------------------- |
| Key         | `brand`                             |
| Schema type | `enum` (pick one brand per listing) |
| Scope       | `public`                            |

The brand list has 625 options and is managed entirely in `src/config/configListing.js`. You can see
the full list in `docs/data/brand.csv`. To add or remove brands, ask the development team. Any
`brand` field configured in the Console is ignored by the app.

---

## 4. Landing Page and CMS Sections

The landing page is built in **Console → Content → Pages → Landing Page**. Other PageBuilder pages
are managed under **Console → Content → Pages**. Each section creates one visual block, but not
every custom type is available on every page:

| Section                                                                                               | Landing page | Other CMS pages |
| ----------------------------------------------------------------------------------------------------- | ------------ | --------------- |
| `avSelections`, `avSelectedCats`, `avTagListings`, `avRecommendeds`, `avSelectedUsers`, `avInstaGrid` | Yes          | No              |
| Standard `hero`, `avHero2`, `avHero3`, `avVideo`                                                      | Yes          | Yes             |

Do not add a landing-only section to another CMS page; those rendering components are not registered
there.

### How sections work

Every section has:

- **Section Type** — determines what the section does (the "template")
- **Section ID** — a unique name for this specific section
- **Section Name** — optional display name; also used to apply visual style tokens (see
  [Section 5 — Display Options](#5-display-options))
- **Blocks** — individual items inside the section (listings, categories, images, etc.)
- **Block Name** — used by custom sections to pass data; also carries display tokens for block-level
  styling (see [Block Name Tokens](#52-block-name-tokens))

---

### 4.1 Hand-Picked Listing Carousel (`avSelections`)

Displays a horizontal scrollable carousel of specific listings you choose manually.

**Setup:**

1. Add a section. Set **Section Type** to `avSelections`.
2. Set **Section ID** to `av-selections` or `av-selections-[any-name]` (e.g.
   `av-selections-verano`). Each unique ID is a separate independent carousel.
3. Add one block per listing. In each block, set **Block Name** to the listing's UUID.
   - Find a listing's UUID in Console → Manage → Listings → open the listing → copy the ID from the
     URL.
4. Optionally add a Title, Description, and Call to Action to the section header.

**Notes:**

- Only published listings appear. Drafts and closed listings are silently skipped.
- The order of blocks controls the order of listings in the carousel.
- You can have multiple `av-selections-*` sections on the same page.

---

### 4.2 Category Card Carousel (`avSelectedCats`)

Displays a horizontal carousel of category cards. Each card shows a photo and category name, and
clicking it opens the search page filtered to that category. No automatic data loading — all content
comes from what you enter in the Console.

**Setup:**

1. Set **Section Type** to `avSelectedCats`.
2. Set **Section ID** to `av-selected-cats` or `av-selected-cats-[name]`.
3. Add one block per category:
   - **Block Name** — the category ID (e.g. `ropa`, `ropa-vestidos`, `bolsas`, `zapatos`)
   - **Title** — optional display name. If omitted, the app uses the category's name from your
     category configuration.
   - **Media** — upload the photo shown on the card.

**Notes:**

- The category ID in Block Name must exactly match the ID in your category configuration.
- Cards link to the search page filtered by that category.

---

### 4.3 Tag or Category Filtered Carousel (`avTagListings`)

Displays a carousel of listings automatically fetched by a filter. The filter is defined in the
first block's Block Name.

**Setup:**

1. Set **Section Type** to `avTagListings`.
2. Set **Section ID** to `av-tag-listings-[name]` (e.g. `av-tag-listings-hot`).
3. Add **one block**. Set its **Block Name** using one of these formats:

| Block Name format | What it fetches                             |
| ----------------- | ------------------------------------------- |
| `tag:hot-list`    | Listings tagged `hot-list`                  |
| `cat:ropa`        | Listings whose level-1 category is `ropa`   |
| `hot-list`        | Same as `tag:hot-list` (tag is the default) |

**Notes:**

- Shows up to 24 published listings.
- Only the first block's Block Name is used as the filter. Additional blocks are ignored.
- `cat:` filters only `categoryLevel1`. Use a level-1 ID such as `ropa`; nested IDs such as
  `ropa-vestidos` are not resolved as level-2 filters by this section.
- You can have multiple `av-tag-listings-*` sections, each with its own filter.

---

### 4.4 Recommended Listings Grid (`avRecommendeds`)

Displays a multi-column grid of hand-picked listings. Works the same as the carousel but renders as
a grid.

**Setup:**

1. Set **Section ID** to exactly `av-recommendeds` (this is fixed — only one per page).
2. Set **Section Type** to `avRecommendeds`.
3. Add one block per listing, setting **Block Name** to the listing's UUID.

---

### 4.5 User Profile Carousel (`avSelectedUsers`)

Displays a horizontal carousel of user profile cards. Useful for featuring sellers or brand
partners.

**Setup:**

1. Set **Section Type** to `avSelectedUsers`.
2. Set **Section ID** to `av-selected-users` or `av-selected-users-[name]`.
3. Add one block per user. Set **Block Name** to the user's UUID.
   - Find a user's UUID in Console → Manage → Users → open the user → copy the ID from the URL.

---

### 4.6 Instagram-Style Image Grid (`avInstaGrid`)

Displays a responsive photo grid from images you upload directly in the Console. Best for lookbook
galleries or mood boards. No listing data is loaded.

**Setup:**

1. Set **Section Type** to `avInstaGrid`.
2. Set **Section ID** to `av-insta-grid` or `av-insta-grid-[name]`.
3. Add one block per image. Upload the image in the block's **Media** field. Block title and
   description are optional overlays.

**Column behavior by screen size:**

| Screen width              | Number of columns |
| ------------------------- | ----------------- |
| Very small (under 550 px) | 2                 |
| Small (550–767 px)        | 3                 |
| Medium (768–1023 px)      | 4                 |
| Large (1024 px and up)    | 6                 |

---

### 4.7 Hero Banner (Standard) (`hero`)

The standard Sharetribe hero is available on the landing page and other PageBuilder pages. Use it
when one background image, one title, one description, and one call-to-action are enough.

**Setup:**

1. Set **Section Type** to `hero`.
2. Give the section a unique Section ID.
3. Upload the background image in the section appearance settings.
4. Fill in the title, description, and optional Call to Action fields.
5. Preview on desktop and mobile before publishing; keep important text away from image edges where
   responsive cropping may hide it.

This is the standard component, so AV-only translation patterns and display tokens documented for
`avHero2` do not apply to it.

---

### 4.8 Hero Banner (Multi-Instance) (`avHero2`)

A flexible hero banner: a background image with a title, description, and up to two CTA buttons. It
supports an optional mobile-only background, an optional whole-section link, and per-instance button
styling. You can place several independent `avHero2` instances on the same page — each is keyed by
its Section ID.

**How it renders:**

- One hero panel: background image (full-bleed) with the title, description, and buttons overlaid.
- The **instance name** is the part of the Section ID after `av-hero2-` (e.g. `av-hero2-summer` →
  `summer`). All translation keys below use that name: `AVHero2.summer.cta1Text`, etc.

**Setup (Console → Content → Pages → [page] → Add section):**

1. Set **Section Type** to `avHero2`.
2. Set **Section ID** to `av-hero2-[unique-name]` (e.g. `av-hero2-summer`).
3. Set the **desktop background image** in the section's **appearance** settings.
4. Fill in the **Title** and **Description** in the section fields.
5. Add the buttons and any options via the translation keys in the table below (Console → Content →
   Translations).

**Buttons (CTAs):** Each button appears only when its **text** key is set.

- A button uses `AVHero2.<name>.cta1Text` / `cta2Text` for its label and `AVHero2.<name>.cta1Link` /
  `cta2Link` for its destination (default `/s`).
- On **CMS pages** (`/p/...`) you may instead fill the section's built-in **Call to Action** fields;
  the translation keys, when set, take precedence. On the **Landing page**, buttons come **only**
  from the translation keys.

**Translation strings** (Console → Content → Translations; replace `<name>` with the Section ID
suffix):

| Key                                  | Default | Effect                                                                                  |
| ------------------------------------ | ------- | --------------------------------------------------------------------------------------- |
| `AVHero2.<name>.cta1Text`            | empty   | First button label. The button only shows when this is set.                             |
| `AVHero2.<name>.cta1Link`            | `/s`    | First button destination (used when `cta1Text` is set).                                 |
| `AVHero2.<name>.cta1Style`           | empty   | First button style tokens (see below). Empty → Section Name CTA tokens, then `primary`. |
| `AVHero2.<name>.cta2Text`            | empty   | Second button label. The button only shows when this is set.                            |
| `AVHero2.<name>.cta2Link`            | `/s`    | Second button destination.                                                              |
| `AVHero2.<name>.cta2Style`           | empty   | Second button style tokens. Empty → Section Name CTA tokens, then `secondary`.          |
| `AVHero2.<name>.mobileBackgroundUrl` | empty   | Background image shown only on mobile (≤767 px), layered above the desktop background.  |
| `AVHero2.<name>.bgLink`              | empty   | Makes the whole section a link to this URL. Leave unset or set to `#` for no link.      |

**Button styling — two ways:**

1. **Per button (translation):** `cta1Style` / `cta2Style` take space-separated **short** tokens.
   Combine a colour with shape/font tokens, e.g. `blue rounded` or `purple solid`.
   - Colour: `primary`, `secondary`, `blue`, `lightBlue`, `purple`, `pink`, `yellow`
   - Shape / border: `roundedFull`, `rounded`, `square`, `dashed`, `solid`, `noOutline`
   - Font: `headingFont`, `bodyFont`, `accentFont`
2. **Both buttons (Section Name):** If you leave `cta1Style` / `cta2Style` empty, any CTA tokens on
   the **Section Name** style **both** buttons — e.g. Section Name
   `Summer Hero - SectionCtaBtnBlue - Rounded`. See
   [Section display options](#51-section-display-options) for the full token list. When neither is
   set, buttons fall back to the default `primary` / `secondary` styles.

**Section Name display tokens:** Beyond the CTA tokens above, this section honours the standard
Section Name tokens (title colour/alignment, paddings, etc. — see
[Section display options](#51-section-display-options)). The hero-specific one is **`- ShortHero`**,
which reduces the hero's height.

---

### 4.9 Block-Based Hero (`avHero3`)

A two-panel hero. Each panel is a full-bleed background image with a text overlay and an optional
button. Best for split layouts such as "Women / Men" or "New In / Sale".

**How it renders:**

- The section uses its **first two blocks** as the two panels. A single block renders one full-width
  panel; any blocks beyond the first two are ignored.
- Panels sit **side by side on desktop** (≥768 px) and **stack vertically on mobile** (<768 px).
- Each panel's title and description are overlaid in white at the **bottom-left** of the image.
  (Per-block text alignment is not operator-configurable.)

**Setup (Console → Content → Pages → [page] → Add section):**

1. Set **Section Type** to `avHero3`.
2. Set **Section ID** to `av-hero3-[name]` (e.g. `av-hero3-shop`). The part after `av-hero3-` (here,
   `shop`) is the instance name used by the optional style keys below.
3. Add up to two blocks. For each block:
   - **Block image (Media):** upload the panel's background image. Required for the panel to show an
     image.
   - **Block title / Block text:** optional overlay text.
   - **Block image link** (optional): set the block image's **Link** to make the **whole panel**
     clickable — an internal path (e.g. `/s?pub_categoryLevel1=ropa`) or an external URL.
   - **Call to action** (optional): add a **button** with its own text and Internal/External link
     address. This link is **independent** of the Block image link.

**Two clickable areas, two destinations:** The Block image link makes the entire panel a link; the
Call to action button has its own separate link. They may point to different places. The button is
layered above the panel link, so both work and there are no invalid nested links.

**Behavior matrix (per panel):**

| Block image link | Call to action | Result                                                                          |
| ---------------- | -------------- | ------------------------------------------------------------------------------- |
| set              | set            | Whole panel links to the image-link address; the button shows with its own link |
| set              | empty          | Whole panel links to the image-link address; no button                          |
| empty            | set            | Panel is not clickable; only the button (with its own link) shows               |
| empty            | empty          | Static panel — image + text, nothing clickable                                  |

**Optional — button styling:** Button appearance is controlled by **name tokens**, not translation
strings. If you set none, buttons use the default `primary` style.

- **Both panels at once** — add CTA tokens to the section's **Section Name** (e.g.
  `- SectionCtaBtnBlue - Rounded`). See [Section display options](#51-section-display-options) for
  the full token list.
- **A single panel** — add tokens to that block's **Block Name** using the `token ::` syntax (each
  token ends with a space + `::`). This overrides the section-level style for just that panel. See
  [Block Name Tokens](#52-block-name-tokens) for the full list.
  - Colour (pick one): `blockCtaBtnBlue`, `blockCtaBtnLightBlue`, `blockCtaBtnPurple`,
    `blockCtaBtnPink`, `blockCtaBtnYellow`, `blockCtaBtnSecondary` (white, black text + border)
  - Shape / style: `roundedFull`, `rounded`, `square`, `dashed`, `solid`, `noOutline`,
    `ctaBtnCenter`
  - Example Block Name: `blockCtaBtnBlue :: rounded ::`

**Translation strings:** None are used by this section. The background image, the panel link, the
button text and link, and the button styling all come from the block (and Section/Block Name
tokens).

---

### 4.10 Video + Text Split (`avVideo`)

A full-width section split in two halves: an autoplay video on the left, and title, description, and
CTA on the right. On mobile the halves stack vertically.

**Setup:**

1. Set **Section Type** to `avVideo`.
2. Set **Section ID** to `av-video-[name]`.
3. Fill in Title, Description, and Call to Action for the right side.
4. To set the video URL, go to Console → Content → Translations and add:

Use the suffix after `av-video-`, not the complete Section ID. For example, section ID
`av-video-summer` uses:

> `AVVideo.summer.videoUrl` = (direct video file URL, e.g. an MP4 link)

**Notes:**

- The video autoplays muted and loops.
- Browser autoplay policies may prevent autoplay on some devices unless the video is muted.

---

## 5. Display Options

Both sections and individual blocks accept name-based style tokens that change their visual
appearance without any code changes. These tokens are set directly in the **Section Name** or
**Block Name** fields in the Sharetribe Console — no developer involvement needed.

- **Section Name tokens** (prefix `- Token`) — apply to the whole section: layout width, title
  colour, padding, button colour, and more. See
  [Section Display Options](#51-section-display-options).
- **Block Name tokens** (suffix `token ::`) — apply to a single block: title style, button colour,
  embedded components, and more. See [Block Name Tokens](#52-block-name-tokens).

Multiple tokens of either kind can be combined freely.

---

### 5.1 Section Display Options

Any section's **Section Name** field can carry extra style tokens that change how that section
looks, with no code changes. Write each token **after** the section's normal name as a space, a
dash, a space, then the token (`- Token`). Combine as many as you like.

**Example:** `My Hero Section - Large - CenterTitleText - NoPaddings`

> Tokens are matched as whole words, so similar tokens never collide — `- Large` does not trigger
> `- LargeDesc`, and `- NoPaddings` is not triggered by any longer token.

#### Layout and width

| Token              | Effect                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `- Large`          | Widens the content area (up to 1370 px) so the section spans most of the page instead of the default reading width.                                        |
| `- FullW`          | Full browser width, edge to edge — removes horizontal padding and the rounded corners on images. Best for full-bleed banners and image strips.             |
| `- FullWHeader`    | Lets the header (title + description) stretch the full content width instead of being capped at the default reading width. Pairs well with centered text.  |
| `- ShortHero`      | **Hero banners only** (`avHero2`): cuts the hero height to roughly half the screen.                                                                        |
| `- 2/3 cols`       | **Two-column sections only**: splits the two columns into a one-third / two-thirds ratio instead of an even 50 / 50 split.                                 |
| `- AvFeature`      | Feature layout — image and text sit side by side, full-bleed with no padding. This already includes full-width behaviour, so you do **not** add `- FullW`. |
| `- ReverseFeature` | The same feature layout as `- AvFeature`, but with the image on the opposite side.                                                                         |

#### Title and text

| Token               | Effect                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `- BlueTitle`       | Colours the section title (heading levels 1–3) in AV brand blue and adds a little space below the header.                                                   |
| `- WhiteTitle`      | Colours the section title (heading levels 1–3) white — use on dark backgrounds.                                                                             |
| `- CenterTitleText` | Centres the section title horizontally.                                                                                                                     |
| `- CenterDescText`  | Centres the section's description paragraph.                                                                                                                |
| `- LargeDesc`       | Widens the description (up to 968 px on larger screens) so a long intro wraps onto fewer lines.                                                             |
| `- SmallerTitles`   | Shifts every heading down one size level: H1 → 30 px, H2 → 20 px, H3 → 18 px, H4 → 16 px, H5 → 14 px. Use when a section's default headings feel too large. |

#### Spacing

| Token            | Effect                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `- NoPaddings`   | Removes all padding (top, bottom, left and right) around the content.                                                                    |
| `- SmallGapCols` | **Column / grid sections only**: tightens the horizontal gap between columns to 8 px (default 32 px).                                    |
| `- SmallGapRows` | **Column / grid sections only**: tightens the vertical gap between rows to 8 px (default 32 px). Combine with `- SmallGapCols` for both. |
| `- NoGapCols`    | **Column / grid sections only**: removes the horizontal gap between columns entirely (0 px).                                             |
| `- NoGapRows`    | **Column / grid sections only**: removes the vertical gap between rows entirely (0 px). Combine with `- NoGapCols` for a flush grid.     |

#### Call-to-action button colour

Restyles the CTA buttons inside the section (hero buttons, feature buttons, etc.). Pick **one**
colour.

| Token                      | Effect                                        |
| -------------------------- | --------------------------------------------- |
| `- SectionCtaBtnBlue`      | Blue button                                   |
| `- SectionCtaBtnLightBlue` | Light-blue button                             |
| `- SectionCtaBtnPurple`    | Purple button                                 |
| `- SectionCtaBtnPink`      | Pink button                                   |
| `- SectionCtaBtnYellow`    | Yellow button                                 |
| `- SectionCtaBtnSecondary` | White button with black text and black border |

#### Call-to-action button shape and font

Combine these freely with one colour token above (e.g.
`- SectionCtaBtnBlue - RoundedFull - HeadingFont`). Used on their own — with no colour token — they
restyle the section's default button.

| Token            | Effect                                        |
| ---------------- | --------------------------------------------- |
| `- RoundedFull`  | Fully rounded (pill) corners.                 |
| `- Rounded`      | Slightly rounded corners (10 px).             |
| `- Square`       | Nearly straight corners (4 px).               |
| `- Dashed`       | Dashed outline.                               |
| `- Solid`        | Solid outline.                                |
| `- NoOutline`    | Removes the button's outline.                 |
| `- HeadingFont`  | Heading font on the button label.             |
| `- BodyFont`     | Body font on the button label.                |
| `- AccentFont`   | Accent (decorative) font on the button label. |
| `- CtaBtnCenter` | Centres a single button horizontally.         |

---

### 5.2 Block Name Tokens

Block-level styling is controlled by tokens placed inside a block's **Block Name** field in Console.
Each token ends with `::` (a space, then a double colon). Combine as many as you like, in any order.

**Example:** `2Buttons :: smallerTitles ::`

#### Layout and structure

| Token                | Effect                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2Buttons ::`        | Adds a row of two buttons below the block content. Button text, links and styles come from the intl keys `TwoButtons.<blockId>.*` (see §10).                                                                                                            |
| `photoSlider ::`     | Adds a photo carousel that auto-advances every 7 seconds, in place of the block's image. Image URLs come from `PhotoSlider.<blockId>.image_1` … `.image_4` (see §10); blank keys are skipped, and if none is set the block shows its own image instead. |
| `mediaTitle ::`      | Moves the block's image to sit **between** the title and the rest of the content (title → image → text/button) instead of above the title.                                                                                                              |
| `imgTop ::`          | When the block media is cropped (e.g. inside an AvFeature row), anchors it to the **top** instead of the default centre (`object-position: top`).                                                                                                       |
| `icon img ::`        | Renders the block's image as a small centred icon (48 px) and tightens the surrounding text — for icon-and-label feature blocks.                                                                                                                        |
| `social links ::`    | Shows social-media icon links (rendered by the footer block).                                                                                                                                                                                           |
| `newsletter form ::` | Embeds the Brevo email signup form. Disclaimer / success / error text come from the `NewsletterForm.*` keys (see §10).                                                                                                                                  |

#### Title style

| Token              | Effect                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `smallerTitles ::` | Shifts every heading in the block down one size level (H1 → 30 px, H2 → 20 px, H3 → 18 px, H4 → 16 px, H5 → 14 px). Block-level mirror of section `- SmallerTitles`.                        |
| `blueTitle ::`     | Colours only the block's own title in AV brand blue. Does **not** affect headings inside the body text. Block-level mirror of section `- BlueTitle`.                                        |
| `fullLinks ::`     | Keeps links inside the block's body paragraphs whole — a word or URL is never broken mid-character (`word-break: keep-all`); a too-long link overflows at full size instead of being split. |

#### Block CTA button colour

These set the colour of a single block's call-to-action button. They are mainly used to override the
section-level button colour on one `avHero3` panel (see §4.9). Pick **one** colour.

| Token                     | Effect                                        |
| ------------------------- | --------------------------------------------- |
| `blockCtaBtnBlue ::`      | Blue button                                   |
| `blockCtaBtnLightBlue ::` | Light-blue button                             |
| `blockCtaBtnPurple ::`    | Purple button                                 |
| `blockCtaBtnPink ::`      | Pink button                                   |
| `blockCtaBtnYellow ::`    | Yellow button                                 |
| `blockCtaBtnSecondary ::` | White button with black text and black border |

The same shape and font modifiers available for section buttons also work here with the `::` syntax,
layered on top of the colour: `roundedFull ::`, `rounded ::`, `square ::`, `dashed ::`, `solid ::`,
`noOutline ::`, `headingFont ::`, `bodyFont ::`, `accentFont ::`, `ctaBtnCenter ::`. A modifier on
its own (e.g. `ctaBtnCenter ::`) keeps whatever colour the section already set.

**Example Block Name:** `blockCtaBtnBlue :: rounded ::`

#### Block ID shorthands

These special **Block ID** values activate a specific block component automatically — you do not
need to set the Block Type field.

| Block ID          | Block component rendered                                       |
| ----------------- | -------------------------------------------------------------- |
| `av-insta-feed`   | Instagram feed widget                                          |
| `av-table-*`      | Markdown table (e.g. `av-table-fees`); content from block text |
| `av-contact-form` | Brevo contact form                                             |

---

## 6. Navigation Bar

The desktop and mobile navigation can show up to three custom dropdowns. The labels are translation
keys (`Topbar.custom.menuOne`, `menuTwo`, and `menuThree`; currently Comprar/Explorar/Marcas in
Spanish), while the contents come from two different sources.

### Editing Dropdowns 1 and 2

The first two dropdowns are managed in `public/static/data/top-bar.json`, not in the Sharetribe
Console top-bar editor. Each entry is a category path resolved against the current hosted category
tree. Ask the development team to edit and deploy this file.

The current configuration is:

- **Dropdown 1 (Comprar):** Ver Todo, Tops, Camisetas, Camisas, Chamarras/Sacos, Pantalones, Jeans,
  Faldas, Vestidos, Ropa Deportiva, Jumpsuits, and Sets.
- **Dropdown 2 (Explorar):** empty, so it is not rendered.

If the local file loads and a dropdown is empty or omitted, no menu is shown for it. If the entire
file cannot be loaded, the application uses its built-in fallback definitions.

### Dropdown 3 — Marcas (Automatic)

Despite its current **Marcas** label, this menu is a directory of eligible store profiles, not the
625 listing-brand options. It is built automatically from users who meet both conditions:

- user type is `vendedor-tienda`; and
- the `localDesign` profile field is truthy.

The items are sorted by display name and open each store's profile page. Review the user's type,
display name, and `localDesign` value before expecting the menu to change; results are cached for
five minutes.

Defining a **user field schema for `userType`** in Console lets the server ask the API for store
users only. Without it the server has to read every user account (up to 2,000) to find them, which
makes the first load after each cache expiry slower as the marketplace grows. Nothing breaks either
way — the menu falls back to reading all users automatically. If the configured user-management flow
does not expose `localDesign` for editing, request a controlled development/administrative update
rather than substituting a brand field.

### Top-Right Action Icons (Desktop)

The top-right area of the desktop top bar shows a row of actions. From left to right:

| Item                              | Appearance                              | Links to                                                                                     | Shown when                |
| --------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------- |
| **VENDE** (Sell / Create listing) | Blue pill button                        | Upload chooser page (`/create-type`) — see [Section 13](#13-upload-chooser-page-create-type) | Signed in                 |
| **Favorites**                     | Black heart icon                        | Favorites page (`/favorites`)                                                                | Signed in                 |
| **Bag**                           | Black bag icon with an item-count badge | Bag page (`/bag`)                                                                            | Always (works logged out) |
| **Inbox**                         | Black envelope icon                     | Inbox                                                                                        | Signed in                 |

The three icons (heart, bag, envelope) are icon-only — their text is used as a hover tooltip and for
screen readers, not shown on screen. None of this requires configuration. The relevant labels are
`TopbarDesktop.favoritesLink`, `BagLink.label`, and `TopbarDesktop.inbox`. See
[Section 11 — Favorites](#11-favorites-wish-list) and [Section 12 — Shopping Bag](#12-shopping-bag)
for the full features.

---

## 7. The Hot List

The Hot List is a curated carousel of featured listings. Any published listing tagged with
`hot-list` automatically appears in it.

### Adding a listing to the Hot List

**Via Sharetribe Console:**

1. Go to Console → Manage → Listings.
2. Open the listing.
3. In the Extended Data / Public Data section, find the `tags` field and add `hot-list`.
4. Save.

**Via the bulk import tool:** Add `hot-list` to the `pub_tags` column for any listing row in your
CSV.

### Removing a listing from the Hot List

Remove `hot-list` from the listing's `tags` field. The listing will no longer appear in the Hot List
on the next page load.

### Creating additional curated carousels

You can create as many tag-based carousels as you want. For example, to create a "New Arrivals"
carousel:

1. Tag the relevant listings with `nueva-llegada` in their public data.
2. Add a `avTagListings` section to the landing page with Section ID `av-tag-listings-nuevas`.
3. Add one block with Block Name `nueva-llegada`.

---

## 8. Bulk Import Tool

### 8.1 Overview

The bulk import tool lets you create many listings at once by uploading a single ZIP file that
contains a CSV spreadsheet and all the listing images. It is available at `/admin/bulk-import` on
the marketplace.

**Who can use it.** Any signed-in user who can create listings can use the tool to bulk-create
listings **for their own account** — every listing is created under the person who uploads. There is
no separate operator password or allowlist to join. The new-listing screen (`/l/new`) also shows a
blue **"Bulk import"** button (on desktop) that links straight to the tool.

**Admins** (the small set of emails configured in `BULK_IMPORT_OPERATOR_EMAILS` — see
[Bulk import settings](#bulk-import)) get one extra power: they can add a `user_id` column to the
CSV to create listings **on behalf of other sellers**. For everyone else that column is ignored and
rejected.

**Key facts:**

- Each row in the CSV creates one listing; rows are processed one by one, so if one row fails the
  others still continue.
- Listings are created under the uploader's account by default (admins can override per row).
- The tool is **tiered** — admins can import bigger batches than regular sellers:

  | Limit               | Regular seller | Admin |
  | ------------------- | -------------- | ----- |
  | Listings per import | 25             | 100   |
  | Images per ZIP      | 100            | 400   |
  | ZIP file size       | 20 MB          | 50 MB |
  | Imports per hour    | 3              | 20    |

- You can only run **one import at a time** per account, and the server runs at most **3 imports at
  once** across all users — if it's busy you'll be asked to try again shortly.

---

### 8.2 How to Use It

1. **Open the tool** — go to `[your marketplace URL]/admin/bulk-import`, or click the blue **"Bulk
   import"** button on the new-listing screen. Just be signed in — there is no import key or
   password to enter.
2. **Download the CSV template** — click "Download CSV Template" to get a spreadsheet pre-filled
   with the current machine-readable headers (`title`, `description`, `price`, `pub_*`, and
   `imagen_*`) plus one example row. The "Ver ejemplo de ZIP" link in the help bar downloads a
   complete, ready-to-upload example ZIP (a CSV plus matching images) you can open to see exactly
   how a finished import looks. Spanish Google Sheets headers remain accepted only as compatibility
   aliases for older files.
3. **Fill in the CSV** — one row per listing, replacing the example row. See the
   [CSV Column Reference](#84-csv-column-reference) below. Leave the `user_id` column empty unless
   you are an admin importing for another seller.
4. **Prepare your images** — name each image file clearly. Image filenames in the CSV must exactly
   match the filename (including extension) of the image files in your ZIP. Images must be real
   `.jpg`, `.png`, or `.webp` files (the tool checks the actual file contents, not just the
   extension).
5. **Create the ZIP** — pack your completed CSV and all image files into a single `.zip` archive.
   Images can be in subfolders.
6. **Upload and start** — click "Select ZIP file", choose your archive, then click "Start Import".
7. **Monitor progress** — the page shows a live progress bar and reports which listings were created
   successfully and which rows had errors. Keep the page open; progress is tied to your account, so
   you can't check it from a different account.

---

### 8.3 ZIP File Structure

Your ZIP must contain exactly one CSV file (at any level inside the archive) and all the images
referenced by that CSV.

**Example:**

```
my-listings.zip
├── listings.csv
├── vestido-frente.jpg
├── vestido-trasera.jpg
└── photos/
    ├── jeans-frente.jpg
    └── jeans-detalle.jpg
```

**ZIP rules:**

- Exactly one CSV file (any filename, any folder level)
- All images referenced in the CSV must be present
- Two images cannot share the same filename, even in different folders
- Images must be genuine `.jpg`, `.png`, or `.webp` files
- Size and count limits depend on your tier (see the table in [8.1](#81-overview)): regular sellers
  up to 25 listings / 100 images / 20 MB; admins up to 100 listings / 400 images / 50 MB

---

### 8.4 CSV Column Reference

> **Template headers.** The downloadable template (`PLANTILLA_CARGA_MASIVA.csv`) uses the field
> names directly: the listing-attribute columns carry a **`pub_`** prefix (e.g. `pub_brand`,
> `pub_color`) and the image columns are **`imagen_1`–`imagen_4`**. Keep the headers from the
> template as-is. The importer is also backward-compatible — it still accepts the older `pd_`
> prefix, the `image_front`/`image_back`/`image_horizontal`/`image_details` names, and the Spanish
> Google Sheets headers — so old spreadsheets keep working without changes.

#### Required columns

| Column        | What to enter                                                                                                                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | Listing title. Cannot be empty.                                                                                                                                                                                                                             |
| `description` | Listing description. Cannot be empty.                                                                                                                                                                                                                       |
| `price`       | Price in pesos (e.g. `450.00`). Must be a positive number. A `$` sign and thousands separators are fine — `$4,500.00` is read as `4500` and `$99.50` as `99.5`. (If a value contains a comma, your spreadsheet wraps it in quotes automatically on export.) |

#### Optional core columns

| Column             | Default          | What to enter                                                                                                                                                 |
| ------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_id`          | The current user | **Admins only.** The Sharetribe UUID of the seller the listing should belong to. Leave empty for normal use — a non-admin who fills it in gets a clear error. |
| `currency`         | `MXN`            | Currency code. Leave blank for MXN.                                                                                                                           |
| `publish`          | `yes`            | `yes` to publish immediately, `no` to save as draft.                                                                                                          |
| `shipping_enabled` | `true`           | `true` or `false`                                                                                                                                             |
| `pickup_enabled`   | `false`          | `true` or `false`                                                                                                                                             |
| `location_address` | _(empty)_        | Human-readable address (optional).                                                                                                                            |
| `location_lat`     | _(empty)_        | Latitude number (optional, used for location search).                                                                                                         |
| `location_lng`     | _(empty)_        | Longitude number (optional).                                                                                                                                  |

> **About `user_id`.** Regular sellers should leave this column empty (or remove it) — every listing
> is automatically created under your own account. Admins find a seller's UUID in Console → Manage →
> Users. The older column name `author_id` and the Spanish header `ID Vendedor` still work as the
> same thing.

#### Image columns

Each listing has four labeled image slots in order: `imagen_1` = front, `imagen_2` = back,
`imagen_3` = horizontal (wide-angle), `imagen_4` = details. The first three are required, details is
optional.

| Column     | Slot       | Required | Description                                   |
| ---------- | ---------- | -------- | --------------------------------------------- |
| `imagen_1` | Front      | Yes      | Filename of the front-facing image            |
| `imagen_2` | Back       | Yes      | Filename of the back-facing image             |
| `imagen_3` | Horizontal | Yes      | Filename of the horizontal / wide-angle image |
| `imagen_4` | Details    | No       | Filename of the close-up details image        |

Filenames are **case-sensitive** and must match exactly the filename inside the ZIP (the folder path
is ignored — only the filename matters). The legacy `image_front`/`image_back`/`image_horizontal`/
`image_details` headers are also accepted.

#### Extended data columns (`pub_*` prefix)

These columns set the listing's searchable attributes. Each column name is the field name with a
`pub_` prefix; the prefix is stripped when saving — so `pub_brand` becomes the `brand` attribute on
the listing. (The legacy `pd_` prefix is still accepted.)

| CSV Column           | Required | Valid values                                                                                                        |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `pub_categoryLevel1` | Yes      | See [Category IDs](#category-ids) below                                                                             |
| `pub_categoryLevel2` | Yes      | See [Category IDs](#category-ids) below                                                                             |
| `pub_categoryLevel3` | No       | See [Category IDs](#category-ids) below                                                                             |
| `pub_color`          | Yes      | One or more color option keys, pipe-separated (e.g. `azul` or `azul\|negro`)                                        |
| `pub_all_sizes`      | Yes      | One or more size option keys, pipe-separated (e.g. `s\|m\|l`)                                                       |
| `pub_brand`          | Yes      | One brand option key (e.g. `zara`, `gucci`)                                                                         |
| `pub_genero`         | Yes      | One gender option key                                                                                               |
| `pub_estado`         | Yes      | One condition option key                                                                                            |
| `pub_estilo`         | Yes      | One or more style option keys, pipe-separated                                                                       |
| `pub_temporada`      | No       | Season slug (e.g. `primavera`, `verano`, `otono`, `invierno`). Saved as data but not currently a searchable filter. |
| `pub_originalPrice`  | No       | The original retail price in pesos (e.g. `650.00`). Must be higher than `price` to show as a strike-through.        |
| `pub_tags`           | No       | Pipe-separated tags (e.g. `hot-list` or `hot-list\|nueva-llegada`)                                                  |

> **Multi-value fields** (`pub_color`, `pub_all_sizes`, `pub_estilo`, `pub_tags`): separate multiple
> values with a pipe character `|`. A single value is also valid. Example: `azul|negro|crema`

---

### 8.5 Field Values Quick Reference

Use these exact option keys (the second column) in your CSV — not the display names.

#### Category IDs

Use these IDs in `pub_categoryLevel1`, `pub_categoryLevel2`, and `pub_categoryLevel3`.

| Category                    | ID to use                      |
| --------------------------- | ------------------------------ |
| **Level 1**                 |                                |
| Ropa                        | `ropa`                         |
| Bolsas                      | `bolsas`                       |
| Zapatos                     | `zapatos`                      |
| Accesorios                  | `accesorios`                   |
| Home Antiques               | `home_antiques`                |
| **Level 2 — Ropa**          |                                |
| Tops                        | `ropa-tops`                    |
| Camisetas                   | `ropa-camisetas`               |
| Camisas                     | `ropa-camisas`                 |
| Pantalones                  | `ropa-pantalones`              |
| Jeans                       | `ropa-jeans`                   |
| Faldas                      | `ropa-faldas`                  |
| Vestidos                    | `ropa-vestidos`                |
| Chamarras / Abrigos / Sacos | `ropa-sacos-chamarras`         |
| Sudaderas                   | `ropa-sudaderas`               |
| Shorts                      | `ropa-shorts`                  |
| Ropa deportiva              | `ropa-deportiva`               |
| Trajes / Sets               | `ropa-trajes`                  |
| Jumpsuits                   | `ropa-jumpsuits`               |
| Lencería / Pijama           | `ropa-lenceria`                |
| De baño                     | `ropa-debano`                  |
| Maternidad                  | `ropa-maternidad`              |
| **Level 2 — Bolsas**        |                                |
| De mano                     | `bolsas-mano`                  |
| Cruzadas                    | `bolsas-cruzadas`              |
| Clutch                      | `bolsas-clutch`                |
| Formales                    | `bolsas-formales`              |
| Mochilas casuales           | `bolsas-mochilas_casuales`     |
| Mochilas de deporte         | `bolsas-mochilas_deporte`      |
| Totes                       | `bolsas-totes`                 |
| Riñoneras                   | `bolsas-rinoneras`             |
| Carteras                    | `bolsas-carteras`              |
| Monederos                   | `bolsas-monederos`             |
| **Level 2 — Zapatos**       |                                |
| Tacones                     | `zapatos-tacones`              |
| Sandalias                   | `zapatos-sandalias`            |
| Sandalias con tacón         | `zapatos-sandalias_tacon`      |
| Zapatillas y Flats          | `zapatos-zapatillas_flats`     |
| Mocasines                   | `zapatos-mocasines`            |
| Plataformas                 | `zapatos-plataformas`          |
| Tenis casuales              | `zapatos-tenis_casuales`       |
| Tenis deportivos            | `zapatos-tenis_deportivos`     |
| Botas                       | `zapatos-botas`                |
| Botas vaqueras              | `zapatos-botas_vaqueras`       |
| Botas con tacón             | `zapatos-botas_tacon`          |
| Botas de montaña            | `zapatos-botas_montana`        |
| Botín                       | `zapatos-botin`                |
| Botín con tacón             | `zapatos-botin_tacon`          |
| **Level 2 — Accesorios**    |                                |
| Gorras / Gorros             | `accesorios-gorras_gorros`     |
| Sombreros                   | `accesorios-sombreros`         |
| Lentes                      | `accesorios-lentes`            |
| Cinturones                  | `accesorios-cinturones`        |
| Bufandas / Pañuelos         | `accesorios-bufandas_panuelos` |
| Joyerías                    | `accesorios-joyerias`          |
| Guantes                     | `accesorios-guantes`           |
| Otros                       | `accesorios-otros`             |
| **Level 3 — Tops**          |                                |
| Blusas                      | `ropa-tops-blusas`             |
| T-shirts                    | `ropa-tops-tshirts`            |
| Crop-tops                   | `ropa-tops-croptops`           |
| Manga larga                 | `ropa-tops-mangalarga`         |
| Manga corta                 | `ropa-tops-mangacorta`         |
| Strapless                   | `ropa-tops-strapless`          |
| Bodys                       | `ropa-tops-bodys`              |
| **Level 3 — Camisetas**     |                                |
| Manga corta                 | `ropa-camisetas-mangacorta`    |
| Manga larga                 | `ropa-camisetas-mangalarga`    |
| Sin mangas                  | `ropa-camisetas-sinmangas`     |
| Oversized                   | `ropa-camisetas-oversized`     |
| Gráficas / Estampadas       | `ropa-camisetas-graficas`      |
| Básicas                     | `ropa-camisetas-basicas`       |
| **Level 3 — Camisas**       |                                |
| Manga corta                 | `ropa-camisas-mangacorta`      |
| Manga larga                 | `ropa-camisas-mangalarga`      |
| Vaqueras                    | `ropa-camisas-vaqueras`        |
| Formales                    | `ropa-camisas-formales`        |
| Casuales                    | `ropa-camisas-casuales`        |
| Seda                        | `ropa-camisas-seda`            |
| **Level 3 — Pantalones**    |                                |
| Formales                    | `ropa-pantalones-formales`     |
| Casuales                    | `ropa-pantalones-casuales`     |
| Leggings                    | `ropa-pantalones-leggings`     |
| Sweatpants                  | `ropa-pantalones-sweatpants`   |
| Vintage                     | `ropa-pantalones-vintage`      |
| Cargo                       | `ropa-pantalones-cargo`        |
| **Level 3 — Jeans**         |                                |
| Mom fit                     | `ropa-jeans-momfit`            |
| Boyfriend jeans             | `ropa-jeans-boyfriend`         |
| Baggy / Oversized           | `ropa-jeans-baggy`             |
| Rectos                      | `ropa-jeans-rectos`            |
| Wide leg                    | `ropa-jeans-wideleg`           |
| Carpenter / Cargo           | `ropa-jeans-cargo`             |
| Acampanados / Flare         | `ropa-jeans-acampanados`       |
| Slim fit                    | `ropa-jeans-slimfit`           |
| Skinny jeans                | `ropa-jeans-skinny`            |
| **Level 3 — Faldas**        |                                |
| Larga                       | `ropa-faldas-larga`            |
| Midi                        | `ropa-faldas-midi`             |
| Mini                        | `ropa-faldas-mini`             |
| Denim                       | `ropa-faldas-denim`            |
| Seda                        | `ropa-faldas-seda`             |
| **Level 3 — Vestidos**      |                                |
| Vestidos formales           | `ropa-vestidos-formales`       |
| Vestidos casuales           | `ropa-vestidos-casuales`       |
| Largos                      | `ropa-vestidos-largos`         |
| Midi                        | `ropa-vestidos-midi`           |
| Mini                        | `ropa-vestidos-mini`           |
| Manga larga                 | `ropa-vestidos-mangalarga`     |
| Manga corta                 | `ropa-vestidos-mangacorta`     |
| Sin manga                   | `ropa-vestidos-sinmanga`       |
| Novia / Bridal              | `ropa-vestidos-novia`          |
| **Level 3 — Joyerías**      |                                |
| Collares                    | `accesorios-joyerias-collares` |
| Aretes                      | `accesorios-joyerias-aretes`   |
| Anillos                     | `accesorios-joyerias-anillos`  |
| Pulseras                    | `accesorios-joyerias-pulseras` |
| Relojes                     | `accesorios-joyerias-relojes`  |

#### Color option keys

| Display name | Use this key   |
| ------------ | -------------- |
| Rojo         | `rojo`         |
| Rosa         | `rosa`         |
| Amarillo     | `amarillo`     |
| Naranja      | `naranja`      |
| Dorado       | `dorado`       |
| Plateado     | `plateado`     |
| Verde        | `verde`        |
| Azul         | `azul`         |
| Morado       | `morado`       |
| Negro        | `negro`        |
| Gris         | `gris`         |
| Blanco       | `blanco`       |
| Crema        | `crema`        |
| Café         | `cafe`         |
| Animal Print | `animal-print` |
| Floral       | `floral-print` |
| Multicolor   | `multicolor`   |

#### Género option keys

| Display name | Use this key |
| ------------ | ------------ |
| Mujer        | `mujer`      |
| Hombre       | `hombre`     |
| Unisex       | `unisex`     |

#### Estado option keys

| Display name       | Use this key         |
| ------------------ | -------------------- |
| Nuevo con etiqueta | `nuevo-con-etiqueta` |
| Nuevo sin etiqueta | `nuevo-sin-etiqueta` |
| Como nuevo         | `como-nuevo`         |
| Buen estado        | `buen-estado`        |
| Usado              | `usado`              |

#### Estilo option keys

| Display name        | Use this key        |
| ------------------- | ------------------- |
| Vintage             | `vintage`           |
| Urbano / Streetwear | `urbano_streetwear` |
| Fiesta / Noche      | `fiesta_noche`      |
| Formal              | `formal`            |
| Casual              | `casual`            |
| Boho                | `boho`              |
| Retro               | `retro`             |
| Oficina             | `oficina`           |
| Vacaciones          | `vacaciones`        |
| Seda                | `seda`              |

#### Temporada option keys

The `Temporada` column is optional. Use one of these values exactly (with the accent on `Otoño`):

| Display name | Value to use |
| ------------ | ------------ |
| Primavera    | `Primavera`  |
| Verano       | `Verano`     |
| Otoño        | `Otoño`      |
| Invierno     | `Invierno`   |

#### Talla option keys

| Display name | Use this key     | Group    |
| ------------ | ---------------- | -------- |
| Unitalla     | `unitalla`       | Estándar |
| XXS          | `xxs`            | Estándar |
| XS           | `xs`             | Estándar |
| S            | `s`              | Estándar |
| M            | `m`              | Estándar |
| L            | `l`              | Estándar |
| XL           | `xl`             | Estándar |
| MX 24        | `mx_24`          | MX       |
| MX 25        | `mx_25`          | MX       |
| MX 26        | `mx_26`          | MX       |
| MX 27        | `mx_27`          | MX       |
| MX 28        | `mx_28`          | MX       |
| MX 29        | `mx_29`          | MX       |
| MX 30        | `mx_30`          | MX       |
| MX 31        | `mx_31`          | MX       |
| MX 32        | `mx_32`          | MX       |
| MX 33        | `mx_33`          | MX       |
| MX 34        | `mx_34`          | MX       |
| US 00        | `us_00`          | US       |
| US 0         | `us_0`           | US       |
| US 2         | `us_2`           | US       |
| US 4         | `us_4`           | US       |
| US 6         | `us_6`           | US       |
| US 8         | `us_8`           | US       |
| US 10        | `us_10`          | US       |
| US 12        | `us_12`          | US       |
| 0XL          | `curvy_0x`       | Curvy    |
| 1XL          | `curvy_1x`       | Curvy    |
| 2XL          | `curvy_2x`       | Curvy    |
| 3XL          | `curvy_3x`       | Curvy    |
| 4XL          | `curvy_4x`       | Curvy    |
| 5XL          | `curvy_5x`       | Curvy    |
| MX 22        | `mx_shoes_22x`   | Calzado  |
| MX 22.5      | `mx_shoes_22.5x` | Calzado  |
| MX 23        | `mx_shoes_23x`   | Calzado  |
| MX 23.5      | `mx_shoes_23.5x` | Calzado  |
| MX 24        | `mx_shoes_24x`   | Calzado  |
| MX 24.5      | `mx_shoes_24.5x` | Calzado  |
| MX 25        | `mx_shoes_25x`   | Calzado  |
| MX 25.5      | `mx_shoes_25.5x` | Calzado  |
| MX 26        | `mx_shoes_26x`   | Calzado  |
| MX 26.5      | `mx_shoes_26.5x` | Calzado  |
| MX 27        | `mx_shoes_27x`   | Calzado  |
| MX 27.5      | `mx_shoes_27.5x` | Calzado  |
| MX 28        | `mx_shoes_28x`   | Calzado  |
| MX 28.5      | `mx_shoes_28.5x` | Calzado  |
| MX 29        | `mx_shoes_29x`   | Calzado  |
| 4 / 14.8mm   | `rings_4`        | Anillos  |
| 5 / 15.7mm   | `rings_5`        | Anillos  |
| 6 / 16.5mm   | `rings_6`        | Anillos  |
| 7 / 17.3mm   | `rings_7`        | Anillos  |
| 8 / 18.1mm   | `rings_8`        | Anillos  |
| 9 / 18.9mm   | `rings_9`        | Anillos  |
| 10 / 19.8mm  | `rings_10`       | Anillos  |
| 11 / 20.6mm  | `rings_11`       | Anillos  |
| 12 / 21.4mm  | `rings_12`       | Anillos  |

#### Brand option keys

The full brand list has 625 entries. The most common ones are listed here. For the complete list,
see `docs/data/brand.csv`.

| Brand                   | Key            | Brand         | Key             |
| ----------------------- | -------------- | ------------- | --------------- |
| Zara                    | `zara`         | Gucci         | `gucci`         |
| Mango                   | `mango`        | Louis Vuitton | `louis-vuitton` |
| H&M                     | `h-m`          | Prada         | `prada`         |
| LEVI'S                  | `levi-s`       | Chanel        | `chanel`        |
| Nike                    | `nike`         | Dior          | `dior`          |
| Adidas                  | `adidas`       | Valentino     | `valentino`     |
| Free People             | `free-people`  | Versace       | `versace`       |
| Reformation             | `reformation`  | Balenciaga    | `balenciaga`    |
| Anthropologie / Aritzia | `aritzia`      | Zimmermann    | `zimmermann`    |
| Stradivarius            | `stradivarius` | Isabel Marant | `isabel-marant` |
| Pull & Bear             | `pull-bear`    | Jacquemus     | `jacquemus`     |
| Bershka                 | `bershka`      | Ganni         | `ganni`         |
| Vintage (no brand)      | `vintage`      | Otros         | `otros`         |

---

### 8.6 What Is Validated Before the Import Starts

Before a single listing is created, the tool runs a strict **pre-flight check** on your whole ZIP
and CSV. If anything in this check fails, the import is **rejected immediately** — no job is
started, no listings are touched — and you get back a list of **every** problem found, so you can
fix them all in one pass and re-upload.

This is different from the per-row errors you may see **while** an import is running. Once the
pre-flight check passes, rows are created one by one; if an individual row fails at that stage (for
example, an invalid colour value), it is reported in the errors table and the **other rows keep
going**. Successful rows are not listed individually — when every row imports cleanly, the page
shows a **View your listings** button that opens your listings page (`/listings`) instead. See
[Troubleshooting](#87-troubleshooting) for the error cases.

The pre-flight check runs in two passes.

#### Pass 1 — the ZIP file itself

- The file is a valid, readable `.zip` archive.
- It contains **exactly one** CSV file (any filename, at any folder level).
- The CSV file is not empty.
- **Every image is a genuine image** — the tool reads the actual file contents (magic bytes), so a
  non-image renamed to `.jpg` is rejected. Allowed types: `.jpg`/`.jpeg`, `.png`, `.webp`.
- **No two images share the same filename**, even across different subfolders.
- The archive stays within your tier's limits: total entries, image count, per-image size (10 MB),
  CSV size (5 MB), and total uncompressed size.
- macOS junk that Finder adds when zipping (`__MACOSX/`, `._*` resource forks, and `.DS_Store`
  files) is **ignored automatically** — it never causes an error.

#### Pass 2 — the CSV contents

This is the "missing values" check. It runs in two stages.

**File-level checks (stop the import right away):**

- The CSV has at least one data row.
- It has no more than your tier's row cap (regular sellers 25, admins 100; a hard ceiling of 100
  applies to everyone).
- The header row contains the three **required columns**: `title`, `price`, and `description`
  (Spanish template headers such as `Nombre de Producto*` are recognised and mapped automatically).
  If any required column is missing entirely, the check stops here.

**Per-row checks (every row is checked, and all problems are collected together):**

| What is checked                 | Rule the row must satisfy                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `title`                         | Not empty.                                                                                                         |
| `description`                   | Not empty.                                                                                                         |
| `price`                         | Reads as a **positive** number. A `$` sign and thousands separators are fine; `0`, negatives, and text are not.    |
| Required image columns          | `image_front`, `image_back`, and `image_horizontal` each have a filename. (`image_details` / image 4 is optional.) |
| Image filenames                 | Every filename referenced in the row **exists in the ZIP**. A typo or wrong extension fails here.                  |
| `pub_*` keys                    | A `pub_*`/`pd_*` column does not use a reserved name (`__proto__`, `constructor`, `prototype`).                    |
| `location_lat` / `location_lng` | If present, both are valid numbers.                                                                                |
| `stock`                         | Empty defaults to `1`; otherwise must be a whole number that is zero or greater.                                   |
| `user_id`                       | May only be filled in by an **admin**. A non-admin who sets it gets a clear error and the row is rejected.         |

**What is _not_ checked at this stage** (important):

- **Option values are not verified against the Console.** Values for fields like colour, size,
  brand, `categoría`, `género`, `estado`, `estilo`, and `temporada` are passed through as-is. A typo
  such as `pub_color = blu` **passes** the pre-flight check and only fails later, per row, as an API
  error in the errors table. Always use the exact option keys from
  [8.5 Field Values Quick Reference](#85-field-values-quick-reference).
- **Category existence** is likewise confirmed by the Sharetribe API during processing, not here.

#### What you see when it fails

All problems are returned together under the heading **"Falta información para completar en tu
archivo CSV. Completa la información en la plantilla y vuelve a exportar."**, with one line per
issue. Row-specific problems are prefixed **`Fila N:`** (where `N` is the data-row number, starting
at 1). For example, for a CSV using the accepted Spanish alias headers:

```
Falta información para completar en tu archivo CSV. Completa la información en la plantilla y vuelve a exportar.
Fila 2: "Nombre de Producto*" está vacío.
Fila 2: "Precio Venta (MXN)*" debe ser un número positivo, se recibió "abc".
Fila 5: "Nombre imagen 1*" es obligatorio.
Fila 7: La imagen "vestido-frente.jpg" (Nombre imagen 1*) no se encontró en los archivos subidos.
```

Fix every listed line, then upload the ZIP again.

#### Errors name your own column headers

Every error message quotes the **exact column header you typed in your CSV** — never an internal
name. This matters because the importer accepts several header "dialects" (the current downloaded
template, Spanish/Google Sheets aliases, and internal English names) and maps them all to the same
fields behind the scenes. Whatever heading is in _your_ file is what you'll see in the error, so you
can find and fix the offending column without translating anything.

**Why this helps.** Internally the tool refers to the four image columns as `image_front`,
`image_back`, `image_horizontal`, and `image_details`. If your spreadsheet's first image column is
headed `Nombre imagen 1*`, an older error might have told you `"image_front" es obligatorio` — a
name that appears **nowhere** in your file. Now the same error reads
`"Nombre imagen 1*" es obligatorio`, pointing straight at the column you need to fix.

**How your header appears, by template.** The same missing first-image error is phrased using
whichever header your file uses:

| Header dialect in your CSV  | First-image column header | Error you see                                  |
| --------------------------- | ------------------------- | ---------------------------------------------- |
| Current downloaded template | `imagen_1`                | `Fila N: "imagen_1" es obligatorio.`           |
| Accepted Spanish alias      | `Nombre imagen 1*`        | `Fila N: "Nombre imagen 1*" es obligatorio.`   |
| Google Sheets export        | `Imagen 1: Frontal*`      | `Fila N: "Imagen 1: Frontal*" es obligatorio.` |
| Internal English names      | `image_front`             | `Fila N: "image_front" es obligatorio.`        |

This applies to **all** the per-row value errors — empty title/description, invalid price, a missing
or unresolved image, and an invalid `stock` — not just the image columns.

**Two edge cases where you'll still see the field's generic name:**

- **A required column is missing entirely.** If your CSV has no title/price/description column at
  all, there is no header to quote, so the error names the field itself
  (`Falta la columna obligatoria: "title".`). Add the missing column and re-export.
- **The `user_id` (admin) override.** The "not permitted" message always says `user_id` — the
  documented admin column name — regardless of the alias you used (`user_id` or `ID Vendedor`).

---

### 8.7 Troubleshooting

| Problem                                                                                    | Likely cause                                                                     | What to do                                                                                                     |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| "…requiere una sesión iniciada" error                                                      | You are signed out                                                               | Sign in to the marketplace and try again                                                                       |
| "Token de acción… inválido o expirado"                                                     | The short-lived upload token expired                                             | Reload the page and start the upload again                                                                     |
| `La sustitución de "user_id" no está permitida`                                            | A non-admin filled in the `user_id` column                                       | Remove the `user_id` column (your listings are created under you)                                              |
| "El ZIP supera tu límite…" / "Demasiadas imágenes" / "El CSV tiene … filas. Tu límite es…" | The import is over your tier's limit                                             | Split it into smaller batches, or ask an admin to run the larger import                                        |
| "Demasiadas importaciones" (try again later)                                               | You hit your hourly import limit                                                 | Wait up to an hour and try again (3/hr seller, 20/hr admin)                                                    |
| "Ya tienes una importación en curso"                                                       | A previous import of yours is still running                                      | Wait for it to finish before starting another                                                                  |
| "La capacidad de importación está llena"                                                   | Three imports are already running across all users                               | Wait a few minutes and retry                                                                                   |
| "El ZIP no contiene ningún archivo .csv"                                                   | CSV is missing from the archive                                                  | Make sure you included exactly one CSV file inside the ZIP                                                     |
| "El ZIP contiene N archivos .csv"                                                          | Multiple CSVs in the archive                                                     | Remove extra CSV files — only one is allowed                                                                   |
| "…nombre de imagen duplicado…"                                                             | Two images share the same filename in different folders                          | Rename images so all filenames are unique across the entire ZIP                                                |
| "…no coincide con su extensión de archivo"                                                 | A file isn't a real image (e.g. renamed to `.jpg`)                               | Re-export it as a genuine `.jpg`, `.png`, or `.webp`                                                           |
| "…no se encontró en los archivos subidos"                                                  | Filename in the CSV doesn't match the image file                                 | Check spelling, case, and file extension — they must match exactly                                             |
| `Falta la columna obligatoria: "X"`                                                        | A required header column (`title`/`price`/`description`) is missing              | Add the missing column header and re-export the CSV                                                            |
| `Fila N: "X" es obligatorio` / `Fila N: "X" está vacío`                                    | A required field (title, description, or a required image) is empty              | Fill in that field for the listed row                                                                          |
| `Fila N: "price" debe ser un número positivo`                                              | Price is zero, negative, or not a number                                         | Enter a positive number like `450.00`                                                                          |
| All rows fail with API error                                                               | Integration API credentials are wrong                                            | Contact your administrator to check the server configuration                                                   |
| All rows fail "user not found" (409)                                                       | The server's Integration API points at a different marketplace than your account | Admin: ensure the Integration API and the marketplace your users sign into are the same Sharetribe marketplace |
| Job not found (after waiting)                                                              | Job data expired, or the server restarted mid-import                             | Jobs expire after 1 hour and don't survive a server restart. Re-run the import.                                |

---

## 9. Application Settings

These settings are configured in the server environment, not in the Console. They are set once by
the development team when deploying the application. This section explains what each setting does in
plain language.

### Marketplace identity

| Setting              | What it controls                                            |
| -------------------- | ----------------------------------------------------------- |
| **Marketplace name** | The name shown in the browser tab and emails                |
| **Marketplace URL**  | The full web address of the marketplace (no trailing slash) |

### Sharetribe connection

| Setting                                                            | What it controls                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **Marketplace API Client ID**                                      | Identifies this app to Sharetribe. Found in Console → Build → Applications.                             |
| **Marketplace API Client Secret** (`SHARETRIBE_SDK_CLIENT_SECRET`) | Server-side secret paired with the Marketplace API application. Keep it in the deployment secret store. |
| **Integration API Client ID**                                      | Allows server-side operations (bulk import, notifications). Found in Console → Build → Integrations.    |
| **Integration API Client Secret**                                  | The password for the Integration API. Keep this private.                                                |

### Payments

| Setting                    | What it controls                                                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stripe Publishable Key** | Connects the browser to the matching Stripe account. Obtain `pk_test_…` or `pk_live_…` from Stripe Dashboard; Sharetribe Console → Build → Payments holds the matching secret/platform configuration. |

### Bulk import

The bulk import tool no longer uses an access password or a default-author setting — any signed-in
user imports for their own account. The only access-related setting is the admin list.

| Setting                                                 | What it controls                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin emails** (`BULK_IMPORT_OPERATOR_EMAILS`)        | A comma-separated list of emails treated as bulk-import **admins**. Admins may add a `user_id` column to import on behalf of other sellers, and get the larger size/rate limits. Optional — leave empty if no one needs admin powers. |
| **Listing Type** (`BULK_IMPORT_LISTING_TYPE`)           | The listing type all imported listings use. The deployment template configures `av-listing`; if omitted, the server fallback is `product-selling`. It must match a published Console listing type.                                    |
| **Transaction alias** (`BULK_IMPORT_TRANSACTION_ALIAS`) | The hosted process alias assigned to imported listings. Configured/default: `default-purchase/release-1`; it must exist in the selected Sharetribe environment.                                                                       |
| **Unit type** (`BULK_IMPORT_UNIT_TYPE`)                 | Unit type assigned to imported listings. Configured/default: `item`; it must match the selected listing type/process.                                                                                                                 |

> Removed settings: the old **Bulk Import API Key**, **Default Author ID**, and operator user-ID
> allowlist are no longer used and have been deleted from the server configuration.

### Email notifications

| Setting                                                               | What it controls                                                                                                                                                            |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notification poller** (`AV_NOTIFICATIONS_ENABLED`)                  | Master flag for event-driven notification channels. When `true`, all channel flags below must also be explicit and readiness must pass.                                     |
| **Seller welcome email** (`AV_WELCOME_EMAIL_NOTIFICATIONS_ENABLED`)   | Enables the Brevo seller-welcome send when the poller is enabled and its template/sender configuration is complete.                                                         |
| **Lifecycle campaigns** (`AV_BREVO_CAMPAIGNS_ENABLED`)                | Enables implemented lifecycle campaign triggers. Keep `false` until the templates, consent flow, and Live data have passed the release smoke test.                          |
| **Brevo API Key**                                                     | Connects to the Brevo account for enabled email sends.                                                                                                                      |
| **Brevo List ID**                                                     | The newsletter list subscribers are added to when they use the newsletter signup form; also required by enabled lifecycle campaigns.                                        |
| **Sender Email**                                                      | The verified "from" address used for transactional emails. Confirm the exact approved address in Brevo before deployment.                                                   |
| **Sender Name**                                                       | The "from" display name used for emails (e.g. `Archivo Vintach`).                                                                                                           |
| **Notification database** (`DATABASE_URL`, deployment-managed secret) | Durable poller cursor, leadership, send claims, consent records, and label-purchase claims. Migrations and readiness must be healthy before notifications or labels launch. |

### WhatsApp notifications

| Setting                                                    | What it controls                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **WhatsApp enabled** (`AV_WHATSAPP_NOTIFICATIONS_ENABLED`) | Keep `false`. WhatsApp is code-level release-locked out of the first release; the flag cannot override that lock.        |
| **WhatsApp Access Token**                                  | Permanent Meta system-user token for server-side sends. Keep private.                                                    |
| **WhatsApp Phone Number ID**                               | Numeric ID of the registered WhatsApp sender number.                                                                     |
| **Admin Phone**                                            | Consenting operator destination for admin alerts, stored as canonical E.164 (`+` plus country code and national number). |

The sender implementation is retained for a future release, but event sends and operator retries are
blocked and signup does not collect the WhatsApp phone field. Existing contact/shipping phone fields
and the bulk-import WhatsApp support link are separate and remain available. See the
[WhatsApp guide](integrations/whatsapp.md) and [pending blockers](pending/notifications.md) before a
reviewed code change removes the release lock.

### Shipping (eShip)

Buyer shipping prices are quoted live from eShip at checkout. Shipping labels are enabled as a
capability, but purchase is **manual by default**: after payment, the seller clicks **Generar
guía**. Automatic purchase happens only when the label capability and `ESHIP_LABEL_AUTOBUY=true` are
both enabled.

| Setting                                                      | What it controls                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **eShip API Key** (`ESHIP_API_KEY`)                          | Connects to the eShip carrier account used to quote shipping and buy labels. Without it, buyers see _Contactar a AV_ instead of priced options. Keep private.                                                                      |
| **eShip Base URL** (`ESHIP_BASE_URL`)                        | Which eShip environment to use — the test/QA carrier system or the live one. Set by the dev team per environment.                                                                                                                  |
| **Shipping markup** (`ESHIP_MARKUP_PCT`)                     | The margin buffer added on top of the raw carrier cost to get the buyer's shipping price. Default: 18%.                                                                                                                            |
| **Label capability** (`AV_SHIPPING_LABELS_ENABLED`)          | Enables label-purchase storage, readiness checks, the seller action, and the shared poller path. It does not turn on auto-buy by itself.                                                                                           |
| **Label retry operators** (`SHIPPING_LABEL_OPERATOR_EMAILS`) | Comma-separated support emails authorized to use the label API for any seller. There is no operator UI; cross-seller or unknown retries require the approved engineering procedure. Sellers retry their own labels in the sale UI. |
| **Auto-buy labels** (`ESHIP_LABEL_AUTOBUY`)                  | `true` plus enabled label capability = buy automatically after confirmed payment. Default/unset/`false` = seller buys with **Generar guía**. Keep off until cancellation/refund policy is approved.                                |

> The eShip carrier account is billed directly for every label, so **the marketplace (not the
> seller) pays the carrier**. Because of that, the buyer's shipping payment is kept by the
> marketplace to cover the label cost — it is **not** added to the seller's payout. (Provider
> commission is charged on the item price only, so it is unaffected.)
>
> A purchased-label cancellation/refund policy and final IVA treatment are still business/accounting
> decisions. Follow [pending work](pending/README.md) and do not improvise an automatic refund or
> carrier-cost adjustment.

### Seller earnings estimator

| Setting                            | What it controls                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Provider commission percentage** | The marketplace fee percentage charged to sellers. Shown in the earnings estimator when sellers set a price. Default: 10% |
| **Stripe fee percentage**          | The Stripe processing fee percentage. Default: 2.9%                                                                       |
| **Stripe fixed fee**               | The fixed Stripe fee per transaction in centavos. Default: 1500 (= MXN \$15.00)                                           |

These values are used to show sellers an estimate of their net earnings while creating a listing.
The actual fees charged are configured separately in Console → Build → Transactions.

---

## 10. Custom Translation Strings

Custom translation strings control operator-editable text throughout the app. They live in two
places:

- **App translation files** (`en_av.json` / `es_av.json`) — the baseline defaults shipped with the
  code. Updated by the development team.
- **Sharetribe Console → Content → Translations** — operator overrides. Console values take
  precedence over the app files.

### How to update a string in the Console

1. Go to **Console → Content → Translations**.
2. Use the search box to find the key you want (e.g. `AVWelcomePopup.vendedor.title`).
3. If the key already exists, click it and edit the value in the text field, then save.
4. If the key does not appear yet (common for per-section dynamic keys like
   `AVHero2.my-section.mobileBackgroundUrl`), click **Add translation**, enter the key exactly as
   shown in the tables below, type the value, and save.

Changes take effect on the next page load. Most keys below have defaults in `en_av.json` and
`es_av.json`, so removing a Console override restores the shipped value. Only explicitly optional
dynamic keys—such as per-instance `AVHero2` buttons, mobile backgrounds, and `AVVideo` URLs—use a
missing or blank value to hide that optional element. Do not blank a standard key to hide its UI.

> **Two languages:** Add the same key in both English and Spanish tabs, or whichever languages your
> marketplace supports.

---

### Listing field controls

| Area           | Key                                    | English default       | Spanish default          | Operator note                                                |
| -------------- | -------------------------------------- | --------------------- | ------------------------ | ------------------------------------------------------------ |
| Listing card   | `AVListingCard.sizeLabel`              | `Size:`               | `Talla:`                 | Prefix label before the size value on listing cards.         |
| Size selector  | `ListingField.allSizes.group.standard` | `Clothing (Standard)` | `Ropa (Estándar)`        | Group heading for standard letter sizes.                     |
| Size selector  | `ListingField.allSizes.group.mx`       | `Clothing (MX)`       | `Ropa (MX)`              | Group heading for Mexican numeric sizes.                     |
| Size selector  | `ListingField.allSizes.group.us`       | `Clothing (US)`       | `Ropa (US)`              | Group heading for US numeric sizes.                          |
| Size selector  | `ListingField.allSizes.group.curvy`    | `Curvy Sizes`         | `Tallas Curvy`           | Group heading for curvy sizes.                               |
| Size selector  | `ListingField.allSizes.group.shoes`    | `Shoes (MX)`          | `Calzado (MX)`           | Group heading for Mexican shoe sizes (half sizes).           |
| Size selector  | `ListingField.allSizes.group.rings`    | `Rings`               | `Anillos`                | Group heading for ring sizes.                                |
| Size selector  | `FieldGroupedMultiSelect.placeholder`  | `Select sizes…`       | `Selecciona tallas…`     | Empty field placeholder.                                     |
| Size selector  | `FieldGroupedMultiSelect.clearAll`     | `Clear all`           | `Borrar todo`            | Clear all selected sizes button.                             |
| Size selector  | `FieldGroupedMultiSelect.expand`       | `Expand`              | `Expandir`               | Collapsed dropdown toggle label.                             |
| Size selector  | `FieldGroupedMultiSelect.collapse`     | `Collapse`            | `Contraer`               | Expanded dropdown toggle label.                              |
| Size selector  | `FieldGroupedMultiSelect.removeOption` | `Remove {label}`      | `Quitar {label}`         | Chip remove button. `{label}` is the selected size.          |
| Color selector | `FieldColorDropdown.placeholder`       | `Select colors…`      | `Selecciona colores…`    | Empty color field placeholder.                               |
| Color selector | `FieldColorDropdown.title`             | `Select Color`        | `Seleccionar Color`      | Dropdown panel heading.                                      |
| Color selector | `FieldColorDropdown.close`             | `Close`               | `Cerrar`                 | Dropdown close button.                                       |
| Color selector | `FieldColorDropdown.clearAll`          | `Clear all`           | `Borrar todo`            | Clear-all-selected-colors button.                            |
| Color selector | `FieldColorDropdown.expand`            | `Expand`              | `Expandir`               | Collapsed dropdown toggle label.                             |
| Color selector | `FieldColorDropdown.collapse`          | `Collapse`            | `Contraer`               | Expanded dropdown toggle label.                              |
| Size selector  | `FieldGroupedMultiSelect.maxHint`      | `Select up to {max}`  | `Selecciona hasta {max}` | Hint shown when the field caps how many sizes can be picked. |
| Brand selector | `FieldSearchableSelect.placeholder`    | `Search brand…`       | `Buscar marca…`          | Empty brand field placeholder.                               |
| Brand selector | `FieldSearchableSelect.clear`          | `Clear`               | `Borrar`                 | Clear (×) button.                                            |
| Brand selector | `FieldSearchableSelect.expand`         | `Expand`              | `Expandir`               | Collapsed dropdown toggle label.                             |
| Brand selector | `FieldSearchableSelect.collapse`       | `Collapse`            | `Contraer`               | Expanded dropdown toggle label.                              |

### Listing form — photos and pricing

| Area                  | Key                                                       | English default                                             | Spanish default                                                | Operator note                                                                                      |
| --------------------- | --------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Photo upload (inline) | `EditListingDetailsPanel.photosTitle`                     | `Photos`                                                    | `Fotos`                                                        | Section heading above the inline photo uploader. Displayed in ALL CAPS by CSS.                     |
| Details form heading  | `EditListingDetailsPanel.detailsTitle`                    | `Detalles del producto`                                     | `Detalles del producto`                                        | Section heading above the details fields (below the photo uploader). Displayed in ALL CAPS by CSS. |
| Photo upload (inline) | `EditListingDetailsPanel.photosMinRequired`               | `Add at least 3 photos to continue.`                        | `Agrega al menos 3 fotos para continuar.`                      | Validation message when too few photos are uploaded.                                               |
| Photo upload (inline) | `EditListingDetailsPanel.photosAddTip`                    | `You can add up to 100 photos.`                             | `Puedes agregar hasta 100 fotos.`                              | Helper text under the uploader.                                                                    |
| Photo upload (inline) | `EditListingDetailsPanel.photosMaxReached`                | `Maximum of 100 photos reached.`                            | `Has alcanzado el máximo de 100 fotos.`                        | Shown when the photo limit is hit.                                                                 |
| Photo upload (inline) | `EditListingDetailsPanel.photosUploadInProgress`          | `Please wait for all photos to finish uploading.`           | `Espera a que terminen de subir todas las fotos.`              | Shown while photos are still uploading.                                                            |
| Photo upload (slots)  | `EditListingPhotosForm.slotLabel.front`                   | `Front`                                                     | `Frente`                                                       | Label for the front-photo slot.                                                                    |
| Photo upload (slots)  | `EditListingPhotosForm.slotLabel.back`                    | `Back`                                                      | `Trasera`                                                      | Label for the back-photo slot.                                                                     |
| Photo upload (slots)  | `EditListingPhotosForm.slotLabel.horizontal`              | `Horizontal`                                                | `Horizontal`                                                   | Label for the horizontal-photo slot.                                                               |
| Photo upload (slots)  | `EditListingPhotosForm.slotLabel.details`                 | `Details`                                                   | `Detalles`                                                     | Label for the optional details-photo slot.                                                         |
| Photo upload (slots)  | `EditListingPhotosForm.frontImageRequired`                | `The front photo is required.`                              | `La foto de frente es obligatoria.`                            | Validation when front photo is missing.                                                            |
| Photo upload (slots)  | `EditListingPhotosForm.minImagesRequired`                 | `At least 3 photos are required (Front, Back, Horizontal).` | `Se requieren al menos 3 fotos (Frente, Trasera, Horizontal).` | Validation when required slots are empty.                                                          |
| Photo upload (slots)  | `EditListingPhotosForm.addImagesTip`                      | `Tip: Upload at least 3 good-quality photos.`               | `Tip: Sube al menos 3 fotos de buena calidad.`                 | Helper tip below the slot uploader.                                                                |
| Original price field  | `EditListingPricingForm.originalPrice`                    | `Original Price (optional)`                                 | `Precio original (opcional)`                                   | Label for the strike-through original price field.                                                 |
| Original price field  | `EditListingPricingForm.originalPricePlaceholder`         | `Add original price…`                                       | `Agrega el precio original…`                                   | Placeholder in the original price input.                                                           |
| Earnings estimator    | `EarningsEstimator.title`                                 | `Estimated Earnings`                                        | `Ganancias estimadas`                                          | Card heading in the pricing panel.                                                                 |
| Earnings estimator    | `EarningsEstimator.listingPrice`                          | `Listing price`                                             | `Precio del artículo`                                          | Row label for the listing price.                                                                   |
| Earnings estimator    | `EarningsEstimator.marketplaceFeeLabel`                   | `Marketplace fee`                                           | `Comisión del marketplace`                                     | Row label for the marketplace commission.                                                          |
| Earnings estimator    | `EarningsEstimator.stripeFee`                             | `Payment processing`                                        | `Procesamiento de pago`                                        | Row label for the Stripe processing fee.                                                           |
| Earnings estimator    | `EarningsEstimator.yourEarnings`                          | `Your earnings`                                             | `Tus ganancias`                                                | Row label for the net earnings.                                                                    |
| Earnings estimator    | `EarningsEstimator.enterPrice`                            | `Enter a price to see estimated earnings.`                  | `Ingresa un precio para ver tus ganancias estimadas.`          | Shown before a price is entered.                                                                   |
| Earnings estimator    | `EarningsEstimator.disclaimer`                            | `This is an estimate. Actual fees may vary.`                | `Esto es un estimado. Las tarifas reales pueden variar.`       | Small disclaimer below the estimate.                                                               |
| Order breakdown       | `OrderBreakdown.providerCommissionFixed`                  | `{marketplaceName} fixed fee`                               | `Tarifa fija de {marketplaceName}`                             | Line item label for the fixed provider commission.                                                 |
| Photo upload (inline) | `EditListingDetailsPanel.photoLabel1`                     | `Front photo`                                               | `Foto frontal`                                                 | Caption under photo slot 1.                                                                        |
| Photo upload (inline) | `EditListingDetailsPanel.photoLabel2`                     | `Back photo`                                                | `Foto posterior`                                               | Caption under photo slot 2.                                                                        |
| Photo upload (inline) | `EditListingDetailsPanel.photoLabel3`                     | `Label or detail`                                           | `Etiqueta o detalle`                                           | Caption under photo slot 3.                                                                        |
| Photo upload (inline) | `EditListingDetailsPanel.photoLabel4`                     | `Selfie (optional)`                                         | `Selfie (si quieres)`                                          | Caption under photo slot 4.                                                                        |
| Photo upload (inline) | `EditListingDetailsPanel.photosTipText`                   | `Learn how to take the best photos {link}.`                 | `Aprende a tomar las mejores fotos {link}.`                    | Tip under the uploader; `{link}` renders the link text below.                                      |
| Photo upload (inline) | `EditListingDetailsPanel.photosTipLinkText`               | `here`                                                      | `aquí`                                                         | Link text inside the photos tip.                                                                   |
| Pricing (with stock)  | `EditListingPricingAndStockForm.originalPrice`            | `Original Price (optional)`                                 | `Precio Original (opcional)`                                   | "Was" price label on the pricing + stock panel.                                                    |
| Pricing (with stock)  | `EditListingPricingAndStockForm.originalPricePlaceholder` | `Add original price…`                                       | `Agrega el precio original…`                                   | Placeholder for that original price input.                                                         |

### Search filters

| Area         | Key                             | English default | Spanish default | Operator note                              |
| ------------ | ------------------------------- | --------------- | --------------- | ------------------------------------------ |
| Brand filter | `BrandFilter.searchPlaceholder` | `Search brand…` | `Buscar marca…` | Placeholder inside the brand search input. |
| Size filter  | `SearchPage.groupedSizesLabel`  | `Size`          | `Talla`         | Sidebar grouped size filter label.         |

### Navigation

| Area                     | Key                                                   | English default      | Spanish default      | Operator note                                              |
| ------------------------ | ----------------------------------------------------- | -------------------- | -------------------- | ---------------------------------------------------------- |
| Topbar highlighted link  | `Topbar.custom.leftOne`                               | `Hot list`           | `Lista destacada`    | Label for the single highlighted link in the top bar.      |
| Topbar highlighted link  | `Topbar.custom.leftOneHref`                           | `?pub_tags=hot-list` | `?pub_tags=hot-list` | Search query URL for the highlighted link.                 |
| Topbar menu 1 label      | `Topbar.custom.menuOne`                               | `Shop`               | `Comprar`            | First dropdown menu label.                                 |
| Topbar menu 2 label      | `Topbar.custom.menuTwo`                               | `Explore`            | `Explorar`           | Second dropdown menu label.                                |
| Topbar menu 3 label      | `Topbar.custom.menuThree`                             | `Brands`             | `Marcas`             | Third dropdown menu label.                                 |
| Desktop favorites icon   | `TopbarDesktop.favoritesLink`                         | `Favorites`          | `Favoritos`          | Heart icon tooltip in the top bar (also the profile menu). |
| Mobile menu              | `TopbarMobileMenu.favoritesLink`                      | `Favorites`          | `Favoritos`          | Mobile menu link to the favorites page.                    |
| Account sidebar tab      | `UserNav.favorites`                                   | `Favorites`          | `Favoritos`          | Tab label in the account navigation sidebar.               |
| Desktop bag icon         | `BagLink.label`                                       | `Shopping bag`       | `Bolsa de compras`   | Tooltip / label for the top-bar bag icon.                  |
| Mobile menu              | `TopbarMobileMenu.bagLink`                            | `My bag`             | `Mi bolsa`           | Mobile menu link to the bag page.                          |
| Desktop profile menu     | `TopbarDesktop.myPurchasesLink`                       | `My Purchases`       | `Mis Compras`        | Profile dropdown link to the purchases page.               |
| Desktop profile menu     | `TopbarDesktop.mySalesLink`                           | `My Sales`           | `Mis Ventas`         | Profile dropdown link to the sales page.                   |
| Desktop profile menu     | `TopbarDesktop.myBalanceLink`                         | `My Balance`         | `Mi Balance`         | Profile dropdown link to the balance page.                 |
| Mobile menu              | `TopbarMobileMenu.myPurchasesLink`                    | `My Purchases`       | `Mis Compras`        | Mobile menu link to the purchases page.                    |
| Mobile menu              | `TopbarMobileMenu.mySalesLink`                        | `My Sales`           | `Mis Ventas`         | Mobile menu link to the sales page.                        |
| Mobile menu              | `TopbarMobileMenu.myBalanceLink`                      | `My Balance`         | `Mi Balance`         | Mobile menu link to the balance page.                      |
| Account sidebar tab      | `UserNav.myPurchases`                                 | `My Purchases`       | `Mis Compras`        | Tab label in the account navigation sidebar.               |
| Account sidebar tab      | `UserNav.mySales`                                     | `My Sales`           | `Mis Ventas`         | Tab label in the account navigation sidebar.               |
| Account sidebar tab      | `UserNav.myBalance`                                   | `My Balance`         | `Mi Balance`         | Tab label in the account navigation sidebar.               |
| Account settings sidebar | `LayoutWrapperAccountSettingsSideNav.profileTabTitle` | `Profile`            | `Perfil`             | Label for the Profile tab in the account settings sidebar. |

### Welcome popup (shown after first registration)

The popup is shown once to new sellers after they register. All fields are optional — leaving a key
blank hides that element. Fill them in via **Console → Content → Translations**.

**When it appears:** It is shown to sellers (account types `vendedor` and `vendedor-tienda`) who
have not yet completed onboarding. It is intentionally **not** shown on the signup page (`/signup`)
so it does not cover the "check your email" confirmation message displayed right after registration
— it appears on the first regular page the seller lands on instead.

**Buttons:** A button only appears when **both** its label and its URL are filled in (e.g.
`primaryButtonLabel` _and_ `primaryButtonUrl`). Leave both blank to hide a button entirely. Clicking
either button — or closing the popup — marks onboarding as complete, so the popup will not appear
again.

**Vendedor popup** (shown to users who registered with the `vendedor` account type):

| Key                                            | What it controls                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `AVWelcomePopup.vendedor.imageUrl`             | URL of the image displayed at the top of the popup. Use a direct image link (e.g. from your CDN). |
| `AVWelcomePopup.vendedor.eyebrow`              | Small uppercase label shown above the title (e.g. "Ya eres parte de Archivo").                    |
| `AVWelcomePopup.vendedor.title`                | Popup heading text.                                                                               |
| `AVWelcomePopup.vendedor.text`                 | Body paragraph below the title.                                                                   |
| `AVWelcomePopup.vendedor.primaryButtonLabel`   | Label for the first (primary) button.                                                             |
| `AVWelcomePopup.vendedor.primaryButtonUrl`     | URL the primary button links to (e.g. `/l/new` to go to the new listing form).                    |
| `AVWelcomePopup.vendedor.secondaryButtonLabel` | Label for the second (secondary) button.                                                          |
| `AVWelcomePopup.vendedor.secondaryButtonUrl`   | URL the secondary button links to (e.g. `/s` for the search page).                                |

**Vendedor-tienda popup** (shown to users who registered with the `vendedor-tienda` account type):

| Key                                                   | What it controls                                |
| ----------------------------------------------------- | ----------------------------------------------- |
| `AVWelcomePopup.vendedor-tienda.imageUrl`             | URL of the image at the top.                    |
| `AVWelcomePopup.vendedor-tienda.eyebrow`              | Small uppercase label shown above the title.    |
| `AVWelcomePopup.vendedor-tienda.title`                | Popup heading text.                             |
| `AVWelcomePopup.vendedor-tienda.text`                 | Body paragraph.                                 |
| `AVWelcomePopup.vendedor-tienda.primaryButtonLabel`   | Primary button label.                           |
| `AVWelcomePopup.vendedor-tienda.primaryButtonUrl`     | Primary button URL (e.g. `/admin/bulk-import`). |
| `AVWelcomePopup.vendedor-tienda.secondaryButtonLabel` | Secondary button label.                         |
| `AVWelcomePopup.vendedor-tienda.secondaryButtonUrl`   | Secondary button URL.                           |

> The popup is shown once per user. After they close it, it will not appear again.

### Store sellers (tienda) wording

Store-seller accounts (user type `vendedor-tienda`) see store-specific wording in signup, profile
settings, and the account sidebar. These are per-user-type key variants — the `…Tienda` suffix —
used alongside the regular keys.

| Area             | Key                                                         | English default            | Spanish default                     | Operator note                                     |
| ---------------- | ----------------------------------------------------------- | -------------------------- | ----------------------------------- | ------------------------------------------------- |
| Signup           | `SignupForm.displayNameLabel`                               | `Display name`             | `Nombre personalizado`              | Display-name label for regular sellers.           |
| Signup           | `SignupForm.displayNameLabelTienda`                         | `Store name`               | `Nombre de la tienda`               | Display-name label for store sellers.             |
| Signup (social)  | `ConfirmSignupForm.displayNameLabelTienda`                  | `Store name`               | `Nombre de la tienda`               | Same label on the social-signup confirm step.     |
| Profile settings | `ProfileSettingsPage.headingTienda`                         | `Store profile settings`   | `Configuración de perfil de tienda` | Page heading for store sellers.                   |
| Profile settings | `ProfileSettingsForm.displayNameHeadingTienda`              | `Store name`               | `Nombre de la tienda`               | Display-name section heading.                     |
| Profile settings | `ProfileSettingsForm.displayNameLabelTienda`                | `Store name`               | `Nombre de la tienda`               | Display-name input label.                         |
| Profile settings | `ProfileSettingsForm.bioHeadingVendedor`                    | `Your custom description`  | `Tu descripción personalizada`      | Bio heading for regular sellers.                  |
| Profile settings | `ProfileSettingsForm.bioHeadingTienda`                      | `About your store`         | `Acerca de tu tienda`               | Bio heading for store sellers.                    |
| Profile settings | `ProfileSettingsForm.bioPlaceholderTienda`                  | `Tell us about your brand` | `Cuéntanos sobre tu marca`          | Bio textarea placeholder for store sellers.       |
| Profile settings | `ProfileSettingsForm.yourProfilePictureTienda`              | `Store logo`               | `Logo de tienda`                    | Avatar section heading for store sellers.         |
| Account sidebar  | `LayoutWrapperAccountSettingsSideNav.profileTabTitleTienda` | `Store Profile`            | `Perfil de Tienda`                  | Sidebar tab label for store sellers.              |
| Store tags       | `StoreTypeTags.ariaLabel`                                   | `Store type tags`          | `Etiquetas de tipo de tienda`       | Screen-reader label for the store-type tag chips. |

### Landing and PageBuilder sections

| Area                | Key / pattern                        | English default               | Spanish default                        | Operator note                                                                        |
| ------------------- | ------------------------------------ | ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| AV carousels        | `AVCarousel.previous`                | `Previous`                    | `Anterior`                             | Previous arrow label for listing, category, tag, and user carousels.                 |
| AV carousels        | `AVCarousel.next`                    | `Next`                        | `Siguiente`                            | Next arrow label.                                                                    |
| Multi-instance hero | `AVHero2.<name>.cta1Text`            | Empty                         | Empty                                  | `<name>` is the suffix after `av-hero2-`; e.g. `AVHero2.shop.cta1Text`.              |
| Multi-instance hero | `AVHero2.<name>.cta1Link`            | `/s`                          | `/s`                                   | Link used when `cta1Text` is set.                                                    |
| Multi-instance hero | `AVHero2.<name>.cta1Style`           | `primary`                     | `primary`                              | Style tokens such as `primary`, `secondary`, `blue`, `roundedFull`.                  |
| Multi-instance hero | `AVHero2.<name>.cta2Text`            | Empty                         | Empty                                  | Optional second CTA text.                                                            |
| Multi-instance hero | `AVHero2.<name>.cta2Link`            | `/s`                          | `/s`                                   | Link used when `cta2Text` is set.                                                    |
| Multi-instance hero | `AVHero2.<name>.cta2Style`           | `secondary`                   | `secondary`                            | Optional second CTA style tokens.                                                    |
| Multi-instance hero | `AVHero2.<name>.mobileBackgroundUrl` | Empty                         | Empty                                  | Optional mobile-specific background image URL.                                       |
| Clickable hero      | `AVHero2.<name>.bgLink`              | Empty                         | Empty                                  | Makes the entire hero section a link.                                                |
| Video section       | `AVVideo.<name>.videoUrl`            | Empty                         | Empty                                  | `<name>` is the suffix after `av-video-`; direct video file URL (MP4) for `avVideo`. |
| Instagram grid      | `SectionInstaGrid.dialogLabel`       | `Instagram post`              | `Publicación de Instagram`             | Modal dialog accessible label.                                                       |
| Instagram grid      | `SectionInstaGrid.closePost`         | `Close post`                  | `Cerrar publicación`                   | Modal close button label.                                                            |
| Instagram grid      | `SectionInstaGrid.viewPost`          | `View Instagram post {index}` | `Ver publicación de Instagram {index}` | Grid cell button label. `{index}` is 1-based.                                        |
| Instagram feed      | `InstagramFeed.dialogLabel`          | `Instagram post`              | `Publicación de Instagram`             | Modal dialog label for the Instagram feed block.                                     |
| Instagram feed      | `InstagramFeed.closePost`            | `Close post`                  | `Cerrar publicación`                   | Modal close button label.                                                            |
| Instagram feed      | `InstagramFeed.viewPost`             | `View Instagram post {index}` | `Ver publicación de Instagram {index}` | Grid cell button label. `{index}` is 1-based.                                        |
| Instagram feed      | `InstagramFeed.mediaAlt`             | `Instagram post`              | `Publicación de Instagram`             | Fallback image alt text when caption is missing.                                     |
| Instagram feed      | `InstagramFeed.mute`                 | `Mute`                        | `Silenciar`                            | Video mute button aria label.                                                        |
| Instagram feed      | `InstagramFeed.unmute`               | `Unmute`                      | `Activar sonido`                       | Video unmute button aria label.                                                      |
| Instagram feed      | `InstagramFeed.pause`                | `Pause`                       | `Pausar`                               | Video pause button aria label.                                                       |
| Instagram feed      | `InstagramFeed.play`                 | `Play`                        | `Reproducir`                           | Video play button aria label.                                                        |
| Footer              | `Footer.belowSlogan`                 | Empty                         | Empty                                  | Optional extra line of text displayed below the footer slogan.                       |

### PageBuilder block key patterns

| Area               | Key / pattern                               | English default | Spanish default | Operator note                                                                 |
| ------------------ | ------------------------------------------- | --------------- | --------------- | ----------------------------------------------------------------------------- |
| Two-buttons block  | `TwoButtons.<blockId>.titleEyebrow`         | Empty           | Empty           | Optional eyebrow above the block title.                                       |
| Two-buttons block  | `TwoButtons.<blockId>.cta1Text`             | —               | —               | First CTA text.                                                               |
| Two-buttons block  | `TwoButtons.<blockId>.cta1Link`             | —               | —               | First CTA link.                                                               |
| Two-buttons block  | `TwoButtons.<blockId>.cta1Style`            | Empty           | Empty           | Optional style tokens.                                                        |
| Two-buttons block  | `TwoButtons.<blockId>.cta2Text`             | —               | —               | Second CTA text.                                                              |
| Two-buttons block  | `TwoButtons.<blockId>.cta2Link`             | —               | —               | Second CTA link.                                                              |
| Two-buttons block  | `TwoButtons.<blockId>.cta2Style`            | Empty           | Empty           | Optional style tokens.                                                        |
| Photo slider block | `PhotoSlider.<blockId>.image_1` … `image_4` | Empty           | Empty           | Image URLs for `photoSlider ::` blocks. Set at least one; blanks are skipped. |

### Newsletter form

| Key                               | English default                                                                                                                                 | Spanish default                                                                                                                                                | Operator note                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `NewsletterForm.emailPlaceholder` | `Your Email`                                                                                                                                    | `Tu Email`                                                                                                                                                     | Email input placeholder.          |
| `NewsletterForm.disclaimerText`   | `By entering your email, you agree to receive promotional emails from Archivo Vintach per our Privacy Policy. You may unsubscribe at any time.` | `Al ingresar tu correo, aceptas recibir correos promocionales de Archivo Vintach y nuestra Política de Privacidad. Puedes darte de baja en cualquier momento.` | Disclaimer below the email field. |
| `NewsletterForm.successMessage`   | `Thanks! Please check your inbox.`                                                                                                              | `¡Gracias! Revisa tu bandeja de entrada.`                                                                                                                      | Shown after successful signup.    |
| `NewsletterForm.errorMessage`     | `Subscription failed. Try again later.`                                                                                                         | `Error en la suscripción. Inténtalo más tarde.`                                                                                                                | Server error state.               |
| `NewsletterForm.invalidEmail`     | `Please enter a valid email.`                                                                                                                   | `Introduce un email válido.`                                                                                                                                   | Client-side validation message.   |
| `NewsletterForm.networkError`     | `Network error. Try again.`                                                                                                                     | `Error de red. Inténtalo de nuevo.`                                                                                                                            | Network failure state.            |

### My Purchases, My Sales, My Balance pages

| Area            | Key                              | English default                                  | Spanish default                                          | Operator note           |
| --------------- | -------------------------------- | ------------------------------------------------ | -------------------------------------------------------- | ----------------------- |
| Purchases page  | `MyPurchasesPage.heading`        | `My Purchases`                                   | `Mis Compras`                                            | Page heading.           |
| Purchases page  | `MyPurchasesPage.title`          | `My Purchases \| Archivo Vintach`                | `Mis Compras \| Archivo Vintach`                         | Browser tab title.      |
| Purchases page  | `MyPurchasesPage.loadingError`   | `Failed to load purchases. Please try again.`    | `No se pudieron cargar las compras. Inténtalo de nuevo.` | Error state.            |
| Purchases page  | `MyPurchasesPage.noResults`      | `You haven't made any purchases yet.`            | `Aún no has realizado ninguna compra.`                   | Empty state.            |
| Sales page      | `MySalesPage.heading`            | `My Sales`                                       | `Mis Ventas`                                             | Page heading.           |
| Sales page      | `MySalesPage.title`              | `My Sales \| Archivo Vintach`                    | `Mis Ventas \| Archivo Vintach`                          | Browser tab title.      |
| Sales page      | `MySalesPage.loadingError`       | `Failed to load sales. Please try again.`        | `No se pudieron cargar las ventas. Inténtalo de nuevo.`  | Error state.            |
| Sales page      | `MySalesPage.noResults`          | `You don't have any sales yet.`                  | `Aún no tienes ninguna venta.`                           | Empty state.            |
| Balance page    | `MyBalancePage.heading`          | `My Balance`                                     | `Mi Balance`                                             | Page heading.           |
| Balance page    | `MyBalancePage.title`            | `My Balance \| Archivo Vintach`                  | `Mi Balance \| Archivo Vintach`                          | Browser tab title.      |
| Balance page    | `MyBalancePage.loadingError`     | `Failed to load balance data. Please try again.` | `No se pudieron cargar los datos. Inténtalo de nuevo.`   | Error state.            |
| Balance page    | `MyBalancePage.noResults`        | `No transactions found.`                         | `No se encontraron transacciones.`                       | Empty state.            |
| Balance summary | `BalanceSummary.totalEarnings`   | `Total Earnings`                                 | `Ganancias totales`                                      | Summary card heading.   |
| Balance summary | `BalanceSummary.pending`         | `Pending`                                        | `Pendiente`                                              | Summary card heading.   |
| Balance summary | `BalanceSummary.cancelled`       | `Cancelled`                                      | `Cancelado`                                              | Summary card heading.   |
| Balance summary | `BalanceSummary.tabAllTime`      | `All Time`                                       | `Todo el tiempo`                                         | Time-range tab label.   |
| Balance summary | `BalanceSummary.tabCurrentMonth` | `This Month`                                     | `Este mes`                                               | Time-range tab label.   |
| Payout row      | `PayoutItem.gross`               | `Gross`                                          | `Bruto`                                                  | Column header.          |
| Payout row      | `PayoutItem.net`                 | `Net`                                            | `Neto`                                                   | Column header.          |
| Payout row      | `PayoutItem.statusCompleted`     | `Completed`                                      | `Completado`                                             | Status badge text.      |
| Payout row      | `PayoutItem.statusPending`       | `Pending`                                        | `Pendiente`                                              | Status badge text.      |
| Payout row      | `PayoutItem.statusCancelled`     | `Cancelled`                                      | `Cancelado`                                              | Status badge text.      |
| Filters         | `TransactionFilters.status`      | `Status`                                         | `Estado`                                                 | Filter label.           |
| Filters         | `TransactionFilters.process`     | `Type`                                           | `Tipo`                                                   | Filter label.           |
| Filters         | `TransactionFilters.dateFrom`    | `From`                                           | `Desde`                                                  | Date range start label. |
| Filters         | `TransactionFilters.dateTo`      | `To`                                             | `Hasta`                                                  | Date range end label.   |
| Filters         | `TransactionFilters.clearAll`    | `Clear filters`                                  | `Limpiar filtros`                                        | Clear button.           |
| Filters         | `TransactionFilters.all`         | `All`                                            | `Todos`                                                  | Status option.          |
| Filters         | `TransactionFilters.completed`   | `Completed`                                      | `Completado`                                             | Status option.          |
| Filters         | `TransactionFilters.pending`     | `Pending`                                        | `Pendiente`                                              | Status option.          |
| Filters         | `TransactionFilters.cancelled`   | `Cancelled`                                      | `Cancelado`                                              | Status option.          |
| Filters         | `TransactionFilters.purchase`    | `Purchase`                                       | `Compra`                                                 | Process type option.    |
| Filters         | `TransactionFilters.booking`     | `Booking`                                        | `Reserva`                                                | Process type option.    |
| Filters         | `TransactionFilters.negotiation` | `Negotiation`                                    | `Negociación`                                            | Process type option.    |

### Bulk import page

| Key                               | English default                                                | Spanish default                                                        | Operator note                                                         |
| --------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `BulkImportPage.heading`          | `Bulk Listing Import`                                          | `Importación Masiva de Listings`                                       | Page heading.                                                         |
| `BulkImportPage.description`      | `Upload a single ZIP file containing your CSV and all images…` | `Sube un solo archivo ZIP con tu CSV y todas las imágenes…`            | Intro paragraph.                                                      |
| `BulkImportPage.zipLabel`         | `ZIP File`                                                     | `Archivo ZIP`                                                          | Upload field label.                                                   |
| `BulkImportPage.zipHelp`          | `Pack your CSV and all images into a single .zip file…`        | `Empaca tu CSV y todas las imágenes en un solo archivo .zip…`          | Helper text below the upload field.                                   |
| `BulkImportPage.zipSelected`      | `Selected: {name}`                                             | `Seleccionado: {name}`                                                 | Shown after a file is selected.                                       |
| `BulkImportPage.startImport`      | `Start Import`                                                 | `Iniciar Importación`                                                  | Primary action button.                                                |
| `BulkImportPage.downloadTemplate` | `Download CSV Template`                                        | `Descargar Plantilla CSV`                                              | Template download link.                                               |
| `BulkImportPage.uploading`        | `Uploading files...`                                           | `Subiendo archivos...`                                                 | Status while uploading.                                               |
| `BulkImportPage.processing`       | `Processing...`                                                | `Procesando...`                                                        | Status while the server is working.                                   |
| `BulkImportPage.progress`         | `{processed} of {total} processed ({percent}%)`                | `{processed} de {total} procesados ({percent}%)`                       | Progress indicator text.                                              |
| `BulkImportPage.completed`        | `Import completed`                                             | `Importación completada`                                               | Final status heading.                                                 |
| `BulkImportPage.succeeded`        | `{count} succeeded`                                            | `{count} exitosos`                                                     | Success count in the result summary.                                  |
| `BulkImportPage.failed`           | `{count} failed`                                               | `{count} fallidos`                                                     | Failure count in the result summary.                                  |
| `BulkImportPage.errorsTitle`      | `Errors`                                                       | `Errores`                                                              | Table heading for failed rows.                                        |
| `BulkImportPage.errorsCapped`     | `Some errors were omitted — only the first 200 are shown.`     | `Algunos errores fueron omitidos — solo se muestran los primeros 200.` | Shown when there are more than 200 errors.                            |
| `BulkImportPage.tableRow`         | `Row`                                                          | `Fila`                                                                 | Error table column header.                                            |
| `BulkImportPage.tableTitle`       | `Title`                                                        | `Título`                                                               | Error table column header.                                            |
| `BulkImportPage.tableError`       | `Error`                                                        | `Error`                                                                | Error table column header.                                            |
| `BulkImportPage.newImport`        | `New Import`                                                   | `Nueva Importación`                                                    | Button to start another import after one finishes.                    |
| `BulkImportPage.viewListings`     | `View your listings`                                           | `Ver tus anuncios`                                                     | Button shown when every row imported successfully; opens `/listings`. |
| `BulkImportPage.title`            | `Bulk Import \| Archivo Vintach`                               | `Importación Masiva \| Archivo Vintach`                                | Browser tab title.                                                    |
| `BulkImportPage.stepsTitle`       | `Before uploading:`                                            | `Antes de subir:`                                                      | Heading of the three-step instructions sidebar.                       |
| `BulkImportPage.step1Title`       | `1. Complete the template`                                     | `1. Completa la plantilla`                                             | Step 1 title.                                                         |
| `BulkImportPage.step1Text`        | `Add one row per item.`                                        | `Agrega una fila por prenda.`                                          | Step 1 text.                                                          |
| `BulkImportPage.step2Title`       | `2. Photo instructions`                                        | `2. Instrucciones de fotos`                                            | Step 2 title.                                                         |
| `BulkImportPage.step2Text`        | `Each photo's filename must match the item name…`              | `El nombre de tus fotos debe ser igual al nombre…`                     | Step 2 text.                                                          |
| `BulkImportPage.step3Title`       | `3. Compress everything into a ZIP`                            | `3. Comprime todo en ZIP`                                              | Step 3 title.                                                         |
| `BulkImportPage.step3Text`        | `Include the template and the photos folder…`                  | `Incluye la plantilla y la carpeta de fotos…`                          | Step 3 text.                                                          |
| `BulkImportPage.dropzoneTitle`    | `Upload your ZIP file`                                         | `Sube tu archivo ZIP`                                                  | Drop-zone heading.                                                    |
| `BulkImportPage.dropzoneSubtitle` | `Drag your file here or select it from your computer.`         | `Arrastra tu archivo aquí o selecciónalo desde tu computadora.`        | Drop-zone subtitle.                                                   |
| `BulkImportPage.selectZip`        | `Select ZIP file`                                              | `Seleccionar archivo ZIP`                                              | File-picker button label.                                             |
| `BulkImportPage.noFileSelected`   | `No file selected`                                             | `Ningún archivo seleccionado`                                          | Shown before a file is chosen.                                        |
| `BulkImportPage.dividerOr`        | `or`                                                           | `o`                                                                    | Divider between drag-and-drop and the button.                         |
| `BulkImportPage.reviewNotice`     | `We'll review your file before creating your listings…`        | `Revisaremos tu archivo antes de crear tus publicaciones…`             | Review notice under the drop zone.                                    |
| `BulkImportPage.exampleZipTitle`  | `View ZIP example`                                             | `Ver ejemplo de ZIP`                                                   | Example-download card title.                                          |
| `BulkImportPage.exampleZipText`   | `Download an example of how your file should look.`            | `Descarga un ejemplo de cómo debe ir tu archivo.`                      | Example-download card text.                                           |
| `BulkImportPage.helpTitle`        | `Need help?`                                                   | `¿Necesitas ayuda?`                                                    | Help bar heading.                                                     |
| `BulkImportPage.whatsappContact`  | `Contact us on WhatsApp`                                       | `Contáctanos por WhatsApp`                                             | WhatsApp support link label.                                          |
| `ManageListingsPage.bulkImport`   | `Carga Masiva`                                                 | `Carga Masiva`                                                         | Blue bulk-import CTA on Manage listings and the new-listing flow.     |
| `BulkImportPage.errorNoZip`       | `Please select a ZIP file.`                                    | `Selecciona un archivo ZIP.`                                           | Validation message.                                                   |

### Checkout — delivery options and shipping address

The checkout (step shown after the buyer clicks **Comprar ahora**) has these AV-specific parts:

1. **Shipping address form** — a Mexico-only address layout: Nombre, Calle, Número Exterior / Número
   Interior, Colonia, C.P. / Ciudad, Estado (a dropdown of the 32 Mexican states) and Teléfono. The
   country is always Mexico, so there is no country field. The list of states is fixed in code.
2. **Delivery options (live quote)** — once the address is complete, the platform requests a **live
   shipping quote** from the carrier (eShip) using the listing's package size (S/M/L) and the
   buyer's address. The buyer then picks **Express** (the fastest rate) or **Estándar** (the
   cheapest rate); below them, every rate the carrier returned is listed for transparency. Buyer
   prices include a margin buffer over the raw carrier cost. Prices are **not** set in the Console —
   they come from the carrier in real time. The **Pay** button stays disabled until a delivery
   option is chosen.
3. **No automatic quote → Contactar AV** — if the seller hasn't set a shipping-origin address, the
   item is package size **especial**, or the carrier can't be reached, the buyer sees a retry and/or
   a **Contactar a AV** button instead of priced options (they cannot complete an automatic
   purchase).

> **Seller requirement:** each seller must set their **shipping-origin address** under **Account →
> Dirección de origen** (`/account/shipping-origin`). Without it, their listings can't be quoted and
> buyers see _Contactar a AV_. Sellers missing it get a reminder banner on **Manage listings**.

**After the sale — the shipping label.** On the sale detail page (**My Sales → open a sale**) the
seller manages the carrier label. By default the seller buys it themselves with a **Generar guía**
button; once bought, that becomes a **Descargar guía** button to download the label PDF (an error
note shows if a purchase fails). If **Auto-buy labels** (`ESHIP_LABEL_AUTOBUY`, Section 9) is turned
on, the label is bought automatically after confirmed payment, so the seller usually sees
**Descargar guía** immediately. A definitive failure may be retried with **Generar guía**; an
unknown outcome must be checked in eShip before an allowlisted operator releases a retry. Buyers
never see this control, and it does not appear for _especial_ (Contactar AV) sales. Support staff
listed under **Label retry operators** (Section 9) can buy/retry the label for any seller's sale.
There is no operator label screen: cross-seller and unknown-outcome actions require the approved
authenticated API/engineering procedure after eShip reconciliation. The keys are `AVShippingLabel.*`
(see below).

> **Shipping deadline: 7 days.** Once an order is paid, the seller has **7 days** to mark it as
> shipped/delivered. If they don't, the order is **canceled automatically** and the buyer receives a
> full refund. The seller gets reminder emails on **day 3** and a last-chance warning on **day 5**
> (Sharetribe built-in emails; Spanish copy for `PurchaseShippingReminder.*` and
> `PurchaseShippingReminderFinal.*` is managed under **Console → Content → Email texts**). The
> separate window for the **buyer** to confirm receipt after delivery remains **14 days**.

The current delivery keys are `AVShippingSelector.*`:

| Area             | Key                                                          | English meaning                                      | Spanish (shipped)                               | Operator note                                         |
| ---------------- | ------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| Delivery options | `AVShippingSelector.express`                                 | `Express`                                            | `Express`                                       | Fastest-rate bucket label.                            |
| Delivery options | `AVShippingSelector.estandar`                                | `Standard`                                           | `Estándar`                                      | Cheapest-rate bucket label.                           |
| Delivery options | `AVShippingSelector.days`                                    | `{days} days`                                        | `{days} días`                                   | Transit-time note on each option.                     |
| Delivery options | `AVShippingSelector.loading`                                 | `Calculating shipping…`                              | `Calculando envío…`                             | Shown while the quote loads.                          |
| Delivery options | `AVShippingSelector.errorTransient`                          | `We couldn't calculate shipping right now.`          | `No pudimos calcular el envío en este momento.` | Transient carrier error (shows **Retry**).            |
| Delivery options | `AVShippingSelector.errorPermanent`                          | `Automatic shipping isn't available…`                | `El envío automático no está disponible…`       | No origin / especial (shows **Contactar**).           |
| Delivery options | `AVShippingSelector.retry`                                   | `Try again`                                          | `Reintentar`                                    | Retry button on a transient error.                    |
| Delivery options | `AVShippingSelector.contactSeller`                           | `Contact AV`                                         | `Contactar a AV`                                | Fallback button when no quote is possible.            |
| Delivery options | `AVShippingSelector.rawListTitle`                            | `All available rates`                                | `Todas las tarifas disponibles`                 | Heading above the raw rate list.                      |
| Seller origin    | `ShippingOriginPage.heading`                                 | `Shipping origin address`                            | `Dirección de origen de envíos`                 | Account settings page heading.                        |
| Seller origin    | `ShippingOriginBanner.message`                               | `Add your shipping origin address…`                  | `Agrega tu dirección de origen…`                | Manage-listings reminder banner.                      |
| Seller origin    | `ShippingOriginBanner.cta`                                   | `Complete address`                                   | `Completar dirección`                           | Reminder banner button.                               |
| Seller origin    | `ShippingOriginPage.title`                                   | `Shipping origin address`                            | `Dirección de origen de envíos`                 | Browser tab title.                                    |
| Seller origin    | `ShippingOriginPage.intro`                                   | `We use this address to quote shipping…`             | `Usamos esta dirección para cotizar el envío…`  | Intro paragraph.                                      |
| Seller origin    | `ShippingOriginPage.submit`                                  | `Save address`                                       | `Guardar dirección`                             | Save button.                                          |
| Seller origin    | `ShippingOriginPage.saveSuccess`                             | `Shipping origin saved.`                             | `Dirección de origen guardada.`                 | Success message.                                      |
| Seller origin    | `ShippingOriginPage.saveError`                               | `Could not save your shipping origin…`               | `No pudimos guardar tu dirección de origen…`    | Error message.                                        |
| Seller origin    | `LayoutWrapperAccountSettingsSideNav.shippingOriginTabTitle` | `Shipping origin`                                    | `Dirección de origen`                           | Account sidebar tab.                                  |
| Buyer address    | `MyAddressesPage.title`                                      | `My addresses`                                       | `Mis direcciones`                               | Browser tab title.                                    |
| Buyer address    | `MyAddressesPage.heading`                                    | `My shipping address`                                | `Mi dirección de envío`                         | Page heading.                                         |
| Buyer address    | `MyAddressesPage.intro`                                      | `Save your shipping address so checkout…`            | `Guarda tu dirección de envío para que…`        | Intro paragraph.                                      |
| Buyer address    | `MyAddressesPage.submit`                                     | `Save address`                                       | `Guardar dirección`                             | Save button.                                          |
| Buyer address    | `MyAddressesPage.saveSuccess`                                | `Address saved.`                                     | `Dirección guardada.`                           | Success message.                                      |
| Buyer address    | `MyAddressesPage.saveError`                                  | `Could not save your address…`                       | `No pudimos guardar tu dirección…`              | Error message.                                        |
| Buyer address    | `LayoutWrapperAccountSettingsSideNav.myAddressesTabTitle`    | `My addresses`                                       | `Mis direcciones`                               | Account sidebar tab.                                  |
| Shipping label   | `AVShippingLabel.heading`                                    | `Shipping label`                                     | `Guía de envío`                                 | Heading above the label control (sale detail page).   |
| Shipping label   | `AVShippingLabel.download`                                   | `Download label`                                     | `Descargar guía`                                | Button to download the purchased label PDF.           |
| Shipping label   | `AVShippingLabel.generate`                                   | `Generate label`                                     | `Generar guía`                                  | Retry button when no label is bought yet / it failed. |
| Shipping label   | `AVShippingLabel.generating`                                 | `Generating…`                                        | `Generando…`                                    | Shown on the button while a retry runs.               |
| Shipping label   | `AVShippingLabel.error`                                      | `The label couldn't be generated. Please try again.` | `No se pudo generar la guía. Intenta de nuevo.` | Error under the button after a failed retry.          |

The address text below is operator-editable. These are AV-owned keys, so they will **not** appear in
Console until you add them (use **Add translation** — see
[How to update a string](#how-to-update-a-string-in-the-console)). Número Interior is the only
optional field; everything else is required.

| Area         | Key                                     | English meaning                | Spanish (shipped)                    | Operator note                           |
| ------------ | --------------------------------------- | ------------------------------ | ------------------------------------ | --------------------------------------- |
| Address form | `ShippingDetails.mxTitle`               | `Shipping Address`             | `Dirección de Envío`                 | Form heading.                           |
| Address form | `ShippingDetails.mxNameLabel`           | `Name`                         | `Nombre`                             | Recipient name label.                   |
| Address form | `ShippingDetails.mxNamePlaceholder`     | `Name of the recipient`        | `Nombre de quien recibe`             | Recipient name placeholder.             |
| Address form | `ShippingDetails.mxNameRequired`        | `Name is required.`            | `El nombre es obligatorio.`          | Validation message.                     |
| Address form | `ShippingDetails.mxStreetLabel`         | `Street`                       | `Calle`                              | Street label.                           |
| Address form | `ShippingDetails.mxStreetPlaceholder`   | `Street`                       | `Calle`                              | Street placeholder.                     |
| Address form | `ShippingDetails.mxStreetRequired`      | `Street is required.`          | `La calle es obligatoria.`           | Validation message.                     |
| Address form | `ShippingDetails.mxExteriorLabel`       | `Exterior Number`              | `Número Exterior`                    | Exterior number label.                  |
| Address form | `ShippingDetails.mxExteriorPlaceholder` | `Exterior Number`              | `Número Exterior`                    | Exterior number placeholder.            |
| Address form | `ShippingDetails.mxExteriorRequired`    | `Exterior number is required.` | `El número exterior es obligatorio.` | Validation message.                     |
| Address form | `ShippingDetails.mxInteriorLabel`       | `Interior Number`              | `Número Interior`                    | Interior number label (optional field). |
| Address form | `ShippingDetails.mxInteriorPlaceholder` | `Interior Number`              | `Número Interior`                    | Interior number placeholder.            |
| Address form | `ShippingDetails.mxColoniaLabel`        | `Neighborhood`                 | `Colonia`                            | Colonia label.                          |
| Address form | `ShippingDetails.mxColoniaPlaceholder`  | `Neighborhood`                 | `Colonia`                            | Colonia placeholder.                    |
| Address form | `ShippingDetails.mxColoniaRequired`     | `Neighborhood is required.`    | `La colonia es obligatoria.`         | Validation message.                     |
| Address form | `ShippingDetails.mxPostalLabel`         | `Postal Code`                  | `C.P.`                               | Postal code label.                      |
| Address form | `ShippingDetails.mxPostalPlaceholder`   | `Postal Code`                  | `C.P.`                               | Postal code placeholder.                |
| Address form | `ShippingDetails.mxPostalRequired`      | `Postal code is required.`     | `El código postal es obligatorio.`   | Validation message.                     |
| Address form | `ShippingDetails.mxCityLabel`           | `City`                         | `Ciudad`                             | City label.                             |
| Address form | `ShippingDetails.mxCityPlaceholder`     | `City`                         | `Ciudad`                             | City placeholder.                       |
| Address form | `ShippingDetails.mxCityRequired`        | `City is required.`            | `La ciudad es obligatoria.`          | Validation message.                     |
| Address form | `ShippingDetails.mxStateLabel`          | `State`                        | `Estado`                             | Estado dropdown label.                  |
| Address form | `ShippingDetails.mxStatePlaceholder`    | `Select...`                    | `Select...`                          | Empty dropdown option.                  |
| Address form | `ShippingDetails.mxStateRequired`       | `State is required.`           | `El estado es obligatorio.`          | Validation message.                     |
| Address form | `ShippingDetails.mxPhoneLabel`          | `Phone`                        | `Teléfono`                           | Phone label.                            |
| Address form | `ShippingDetails.mxPhonePlaceholder`    | `+52 55 1234 5678`             | `+52 55 1234 5678`                   | Phone placeholder.                      |
| Address form | `ShippingDetails.mxPhoneRequired`       | `Phone is required.`           | `El teléfono es obligatorio.`        | Validation message.                     |

---

## 11. Favorites (Wish List)

Favorites let a shopper save listings they like and revisit them later from a personal page. It
works like a "wish list" or "likes" feature. **There is nothing to configure** — it is on by
default. This section explains how it behaves so you can support users and, if you wish, customize
the wording.

### What the shopper sees

- **Heart button on every listing card.** A small heart appears in the top-right corner of each
  listing card everywhere cards are shown — search results, the landing page carousels, the Hot
  List, category pages, and profile pages. Clicking it saves (or unsaves) the listing. Clicking the
  heart does **not** open the listing; it only toggles the favorite.
- **Heart button on the listing page.** The individual listing page shows a heart in the top-right
  of the photo gallery. It stays in sync with the heart on the cards — favoriting in one place
  updates the other.
- **The Favorites page (`/favorites`).** A dedicated page that lists every listing the shopper has
  favorited, shown in the same grid layout and card style as search results, newest favorite first.

### How a shopper reaches the Favorites page

The favorites page is linked from four places (all created automatically):

| Location                     | What it looks like                                                |
| ---------------------------- | ----------------------------------------------------------------- |
| **Desktop top bar**          | A black **heart icon**, between the envelope and bag icons.       |
| **Desktop profile dropdown** | A "Favorites" entry in the avatar dropdown menu.                  |
| **Mobile menu**              | A "Favorites" entry in the slide-out mobile menu.                 |
| **Account sidebar**          | A "Favorites" tab alongside My Purchases / My Sales / My Balance. |

### Rules and behavior

- **Sign-in required.** Favorites are tied to a user account. If a signed-out visitor clicks a
  heart, they are sent to the sign-up page. There is no "guest" favorites list.
- **Private to each user.** A user's favorites are visible only to that user. Sellers cannot see who
  favorited their listings, and there is no public "likes" count on listings.
- **Limit of 100.** A shopper can keep up to 100 favorites. Adding the 101st automatically removes
  the oldest one.
- **Deleted or closed listings disappear.** If a favorited listing is later removed or closed, it
  simply stops showing on the favorites page — no action is needed from the shopper or operator.
- **Nothing for the operator to manage.** Favorites are stored on each user's own profile. They do
  not appear in the Console listing data, and there is no admin screen for them.

### Customizing the wording

All favorites text can be changed via **Console → Content → Translations** (see
[Section 1](#1-sharetribe-console-overview) for how translations work). The navigation labels are
also listed in the [Navigation](#navigation) table above.

| Area            | Key                                  | English default                                                                   | Spanish default                                                                            | Operator note                                                  |
| --------------- | ------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Heart button    | `FavoriteButton.addToFavorites`      | `Add to favorites`                                                                | `Agregar a favoritos`                                                                      | Tooltip/label shown when a listing is not favorited.           |
| Heart button    | `FavoriteButton.removeFromFavorites` | `Remove from favorites`                                                           | `Quitar de favoritos`                                                                      | Tooltip/label shown when a listing is favorited.               |
| Desktop top bar | `TopbarDesktop.favoritesLink`        | `Favorites`                                                                       | `Favoritos`                                                                                | Heart icon tooltip in the top bar; also the profile-menu link. |
| Mobile menu     | `TopbarMobileMenu.favoritesLink`     | `Favorites`                                                                       | `Favoritos`                                                                                | Mobile menu link.                                              |
| Account sidebar | `UserNav.favorites`                  | `Favorites`                                                                       | `Favoritos`                                                                                | Account sidebar tab.                                           |
| Favorites page  | `FavoritesPage.title`                | `Favorites`                                                                       | `Favoritos`                                                                                | Browser tab / page title.                                      |
| Favorites page  | `FavoritesPage.heading`              | `My favorites`                                                                    | `Mis favoritos`                                                                            | Heading at the top of the page.                                |
| Favorites page  | `FavoritesPage.noFavorites`          | `You haven't liked any listings yet. Tap the heart on a listing to save it here.` | `Aún no has guardado ningún artículo. Toca el corazón en un artículo para guardarlo aquí.` | Empty state (no favorites yet).                                |
| Favorites page  | `FavoritesPage.queryError`           | `Loading favorites failed. Please try again.`                                     | `No se pudieron cargar tus favoritos. Inténtalo de nuevo.`                                 | Error state.                                                   |

---

## 12. Shopping Bag

The shopping bag lets a shopper collect listings they intend to buy and check them out one at a
time. It behaves like a "cart" / "wishlist to buy". **There is nothing to configure** — it is on by
default. This section explains how it works so you can support shoppers and, if you wish, customize
the wording.

> **Bag vs. Favorites:** the **bag** is for items a shopper plans to buy now (checkout from it); the
> **favorites/wish list** ([Section 11](#11-favorites-wish-list)) is for items they want to save for
> later. They are separate lists.

### What the shopper sees

- **"Add to bag" button on the listing page.** On a product listing, below the "Comprar ahora" (Buy
  now) button, a full-width **Add to bag** button adds the item to the bag. Once added it reads **In
  your bag**; clicking again removes it.
- **Bag icon in the top bar.** A blue bag icon (with a small number badge showing how many items are
  in the bag) sits between the Favorites heart and the Inbox envelope. It is visible to everyone,
  including signed-out visitors. Clicking it opens the full bag page (`/bag`).
- **Bag dropdown (quick view).** Hovering the bag icon (when the bag has items), or adding an item,
  opens a small dropdown under the icon listing the bag's contents. Each row shows the seller, a
  thumbnail, title, price, size, a **Remove** action, a per-item **total**, and a **Checkout**
  button. A **Go to bag** link opens the full page. The dropdown closes on clicking away, pressing
  Escape, or navigating to another page.
- **The Bag page (`/bag`).** A full page listing every item in the bag using the same item cards as
  the dropdown (seller, image, title, price, size, remove, per-item total, and checkout).

### How a shopper reaches the bag

| Location            | What it looks like                                          |
| ------------------- | ----------------------------------------------------------- |
| **Desktop top bar** | The blue bag icon with the item-count badge → opens `/bag`. |
| **Mobile menu**     | A "My bag" entry in the slide-out menu.                     |
| **Direct URL**      | `/bag`.                                                     |

### Rules and behavior

- **Stored in the browser, not the account.** The bag is saved in the visitor's own browser (local
  storage). It works without signing in, but it **does not follow the shopper across devices or
  browsers**, and clearing browser data empties it. It is intentionally different from favorites,
  which are saved to the account.
- **Up to 50 items**, newest first. Adding beyond 50 drops the oldest item. A listing can be in the
  bag only once (this is a one-item marketplace).
- **Checkout is one item at a time.** There is no combined "cart" order — each Sharetribe
  transaction is for a single listing. "Checkout" on a bag item starts the normal buy flow for that
  one item (quantity 1). Shipping is quoted at checkout, so the bag shows a "Shipping calculated at
  checkout" note rather than a shipping total. The item stays in the bag after checkout starts (in
  case the purchase is abandoned); the shopper can remove it manually.
- **Sold or removed listings drop off automatically.** If a listing in the bag is later removed or
  closed, it simply stops appearing — no action needed.
- **Nothing for the operator to manage.** Bags live in each visitor's browser; they do not appear in
  the Console and there is no admin screen for them.

### Customizing the wording

All bag text can be changed via **Console → Content → Translations** (see
[Section 1](#1-sharetribe-console-overview)).

> **Watch the `{count, plural, …}` parts.** Two strings (`BagPopup.titleCount` and
> `AVBagItemCard.checkout`) use a plural placeholder that adapts to the number of items. Keep the
> `{count, plural, one {…} other {…}}` structure and the `#` intact — only change the words around
> them — or the count will stop displaying correctly.

| Area                | Key                          | English default                                                  | Spanish default                                                                 | Operator note                                                             |
| ------------------- | ---------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Listing button      | `AddToBagButton.addToBag`    | `Add to bag`                                                     | `Agregar a la bolsa`                                                            | Button on the listing when the item is not in the bag.                    |
| Listing button      | `AddToBagButton.inBag`       | `In your bag`                                                    | `En tu bolsa`                                                                   | Same button once the item has been added.                                 |
| Top bar             | `BagLink.label`              | `Shopping bag`                                                   | `Bolsa de compras`                                                              | Tooltip / screen-reader label for the top-bar bag icon.                   |
| Mobile menu         | `TopbarMobileMenu.bagLink`   | `My bag`                                                         | `Mi bolsa`                                                                      | Mobile menu link to the bag page.                                         |
| Bag dropdown        | `BagPopup.titleLabel`        | `Bag`                                                            | `Bolsa`                                                                         | Dropdown heading label; always shown in ALL CAPS.                         |
| Bag dropdown        | `BagPopup.titleCount`        | `({count, plural, one {# item} other {# items}})`                | `({count, plural, one {# artículo} other {# artículos}})`                       | Item count next to the heading (regular body font). Keep the plural part. |
| Bag dropdown        | `BagPopup.close`             | `Close`                                                          | `Cerrar`                                                                        | Close (×) button on the dropdown.                                         |
| Bag dropdown        | `BagPopup.goToBag`           | `Go to bag`                                                      | `Ir a la bolsa`                                                                 | Link from the dropdown to the full bag page.                              |
| Bag / dropdown item | `AVBagItemCard.items`        | `Item(s)`                                                        | `Artículo(s)`                                                                   | Label in the per-item totals block.                                       |
| Bag / dropdown item | `AVBagItemCard.total`        | `Total`                                                          | `Total`                                                                         | Total label in the per-item totals block.                                 |
| Bag / dropdown item | `AVBagItemCard.shippingNote` | `Shipping calculated at checkout`                                | `Envío calculado al finalizar la compra`                                        | Note under the item total.                                                |
| Bag / dropdown item | `AVBagItemCard.checkout`     | `Checkout {count, plural, one {# item} other {# items}}`         | `Comprar {count, plural, one {# artículo} other {# artículos}}`                 | Per-item checkout button. Keep the plural part.                           |
| Bag / dropdown item | `BagPage.remove`             | `Remove`                                                         | `Eliminar`                                                                      | Remove link on each item (page and dropdown).                             |
| Bag page            | `BagPage.title`              | `My bag`                                                         | `Mi bolsa`                                                                      | Browser tab / page title.                                                 |
| Bag page            | `BagPage.heading`            | `My bag`                                                         | `Mi bolsa`                                                                      | Heading at the top of the page.                                           |
| Bag page            | `BagPage.empty`              | `Your bag is empty. Browse the catalog and add pieces you love.` | `Tu bolsa está vacía. Explora el catálogo y agrega las piezas que te encanten.` | Empty state.                                                              |
| Bag page            | `BagPage.fetchError`         | `Loading your bag failed. Please try again.`                     | `No se pudo cargar tu bolsa. Inténtalo de nuevo.`                               | Error state.                                                              |

---

## 13. Upload Chooser Page (`/create-type`)

When a signed-in seller clicks the **VENDE** button in the desktop top bar, they land on the upload
chooser page instead of going straight into the listing form. The page asks how they want to upload
their products and offers two cards:

| Card                       | Button           | Where it goes                                                                       |
| -------------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| **Subir un Producto**      | `subir producto` | The normal one-at-a-time listing form (`/l/new`).                                   |
| **Subir varios Productos** | `subir varios`   | The bulk import tool (`/admin/bulk-import`) — see [Section 8](#8-bulk-import-tool). |

**There is nothing to configure** — the page is on by default. Notes:

- **Sign-in required.** The page (and both destinations) require a signed-in user; signed-out
  visitors are sent to the login page first.
- **Bulk import is open to every seller.** The "Subir varios" card links to the same bulk import
  tool described in [Section 8](#8-bulk-import-tool), with the usual per-account limits.
- **The mobile menu goes here too.** The "create listing" link in the mobile slide-out menu
  (`TopbarMobileMenu.newListingLink`) opens the same chooser page.
- The VENDE button label itself is the existing `TopbarDesktop.createListing` translation (see
  [Section 6](#6-navigation-bar)).

### Customizing the wording

All text on the page can be changed via **Console → Content → Translations** (see
[Section 1](#1-sharetribe-console-overview)).

| Area             | Key                          | English default                                                             | Spanish default                                                                | Operator note                               |
| ---------------- | ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------- |
| Browser tab      | `CreateTypePage.title`       | `Upload your products \| Archivo Vintach`                                   | `Sube tus productos \| Archivo Vintach`                                        | Browser tab / page title.                   |
| Page heading     | `CreateTypePage.heading`     | `Choose how you want to upload your products.`                              | `Elige cómo quieres subir tus productos.`                                      | Heading at the top of the page.             |
| Single-item card | `CreateTypePage.singleTitle` | `Upload one Product`                                                        | `Subir un Producto`                                                            | Title of the left card.                     |
| Single-item card | `CreateTypePage.singleText`  | `Ideal for uploading one garment or just a few at a time`                   | `Ideal para subir una prenda o pocas prendas a la vez`                         | Description of the left card.               |
| Single-item card | `CreateTypePage.singleCta`   | `upload product`                                                            | `subir producto`                                                               | Blue button — goes to the listing form.     |
| Bulk-upload card | `CreateTypePage.bulkTitle`   | `Upload multiple Products`                                                  | `Subir varios Productos`                                                       | Title of the right card.                    |
| Bulk-upload card | `CreateTypePage.bulkText`    | `Upload several garments with a template. Ideal for big closets or stores.` | `Sube varias prendas con una plantilla. Ideal para closets grandes o tiendas.` | Description of the right card.              |
| Bulk-upload card | `CreateTypePage.bulkCta`     | `upload multiple`                                                           | `subir varios`                                                                 | Blue button — goes to the bulk import tool. |

---

## 14. Marketplace Operations

This section is the day-to-day runbook for the people responsible for the marketplace. Identify the
environment and record IDs first, then take the smallest reversible action that resolves the issue.

### 14.1 Access and Environment Safety

Archivo Vintach has separate Sharetribe **Test** and **Live** environments. Their users, listings,
transactions, API applications, Integration API credentials, Stripe modes, and operational data are
separate. Content and configuration may be copied between environments, but marketplace records are
not copied. For the initial Live deployment, the approved plan reuses one Heroku app and its
PostgreSQL add-on only after the Test database contents are backed up and completely erased. No Test
poller, notification, consent, or label record may remain when Live credentials are installed.

Before any change:

1. Confirm the Console environment selector says **Test** or **Live** as intended.
2. Confirm the browser hostname belongs to the matching application deployment.
3. Record the user, listing, or transaction UUID instead of relying only on a display name.
4. For payment work, confirm Stripe is in the matching test/live mode.
5. For carrier work, confirm eShip is in QA for Test or production for Live.

Never paste API keys, access tokens, database URLs, webhook secrets, or customer protected data into
this guide, customer-visible support, screenshots, or chat. Store secrets only in the approved
deployment/provider secret stores.

Operator access is not one universal role:

- Sharetribe Console access controls marketplace administration.
- `BULK_IMPORT_OPERATOR_EMAILS` grants larger import limits and cross-seller `user_id` imports.
- `SHIPPING_LABEL_OPERATOR_EMAILS` permits label retries for another seller and reconciliation of an
  unknown carrier outcome.
- Brevo, Stripe, Meta, eShip, Heroku, and database access are separate provider permissions.

Review these grants periodically and remove access when a staff member no longer needs it.

### 14.2 Content and Configuration Releases

Use Test as the editing and approval environment whenever the change can be staged.

1. Record the requested change and the current Live behavior.
2. Make the change in **Test**. For page content, use the section-availability table in Section 4;
   for translations, preserve placeholders such as `{count}`, plural expressions, and links.
3. Preview the affected page in English and Spanish at mobile and desktop widths.
4. Test every CTA, category filter, external URL, image crop, and empty state.
5. Have another operator compare the result with the request when the change affects pricing,
   payments, legal/consent copy, navigation, or the home page.
6. Copy or reproduce the approved change in **Live**, review the Console diff, and publish it.
7. Recheck the public production page in a signed-out window and, when relevant, as a buyer and a
   seller.
8. Record the date, operator, environment, affected page/asset/translation keys, and rollback value.

Do not edit transaction process aliases, unit types, payment settings, or payout behavior as a
routine content change. Those changes require engineering review, a matching hosted process, and a
full Test-environment transaction pass.

### 14.3 User Management

The common configured account types are:

| User type         | Operational meaning                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `comprador`       | Buyer/customer account.                                                                                                                           |
| `vendedor`        | Individual seller; receives the seller onboarding experience.                                                                                     |
| `vendedor-tienda` | Store seller; receives store wording and may appear in the Marcas menu when `localDesign` is truthy.                                              |
| `vendedor-stock`  | Legacy/special seller value recognized by some seller UI rules; do not assign it unless the current product configuration explicitly requires it. |

For a user-support or moderation request:

1. Open **Console → Manage → Users** in the correct environment and locate the account by email or
   UUID.
2. Verify the display name, user type, email-verification state, and current account status.
3. For seller issues, also verify Stripe payout onboarding and the shipping-origin requirement.
4. For store-directory issues, confirm the user is `vendedor-tienda`, has a useful display name, and
   has a truthy `localDesign` value. Allow five minutes for the menu cache to refresh.
5. Use only the moderation/status actions exposed by the current Console. Do not change protected
   data or impersonate a user merely to make the UI look correct.
6. Record the UUID, reason, action, and operator. Avoid copying phone numbers or addresses unless
   they are essential to the case.

Changing an account's email does not automatically grant bulk-import or label-operator privileges;
those allowlists are deployment settings and need a controlled configuration change.

### 14.4 Listing Moderation

Open **Console → Manage → Listings** and check the following before featuring, reopening, or
investigating a listing:

- correct seller and listing state;
- title, description, price, stock, and required images;
- valid three-level category path where applicable;
- color, size, brand, condition, style, and gender values from the current application lists;
- delivery/package-size behavior and seller shipping origin; and
- tags such as `hot-list` only when the listing is intentionally curated.

The `color`, `all_sizes`, and `brand` option lists are owned by application configuration. Creating
different enum options in Console will not override those code-owned lists. Escalate changes to
those option sets to development.

Use the current Console's close/unpublish/moderation action for a policy violation or unsafe
listing. Closed, deleted, draft, or otherwise unpublished listings do not belong in curated
sections. If a carousel still references one, remove the stale block UUID or tag rather than
republishing the listing to fill the slot.

For a bulk-import problem, keep the job summary and failing CSV row numbers, then use Section 8. Do
not rerun a large ZIP blindly: rows that succeeded already created listings and a retry can create
duplicates.

### 14.5 Transaction and Refund Support

For every payment, dispute, cancellation, delivery, or offer case, first open **Console → Manage →
Transactions** in the correct environment, find the transaction by UUID, and record:

- transaction UUID and environment;
- buyer, seller, and listing UUIDs;
- transaction process alias and last transition;
- Stripe payment/refund state; and
- `protectedData.avShipping` plus label state when shipping is involved.

Use only an operator transition that is valid in the active hosted process. A button being absent
usually means the current state does not permit that transition; do not simulate it by editing
transaction data. Local files under `ext/transaction-processes/` document expected processes but do
not change the deployed Sharetribe process by themselves.

For a cancellation or refund:

1. Confirm whether payment was only authorized, captured, transferred, or already refunded.
2. Confirm whether the label state is absent, purchased, processing, or unknown. A Sharetribe/Stripe
   refund does not automatically cancel the label or recover the carrier charge.
3. For a processing or unknown label outcome, stop. Check eShip before canceling or retrying because
   the carrier may already have accepted the purchase.
4. Use the supported Sharetribe operator cancellation transition. The current purchase process gives
   the buyer a full refund, including shipping, and creates no seller payout. Do not issue a partial
   Stripe Dashboard refund or invent a deduction from the seller payout.
5. Escalate any purchased label for manual reconciliation under the proposed policy in
   [pending eShip work](pending/eship.md). Until that policy is approved and tested, do not promise
   a label credit or decide who absorbs an unrecovered carrier charge.
6. Record the amount, currency, transition, Stripe reference, label outcome, cancellation cause, and
   approver.

Negotiation listings follow a different state machine from purchase listings. The current `offer`
mode begins with a customer quote request and a provider's first numeric offer; it is not a direct
buyer-bid shortcut. Do not change listing process aliases to resolve an individual support case.

### 14.6 Shipping and Label Support

When checkout shows **Contactar AV** instead of a price, check in this order:

1. The listing is not explicitly `especial`.
2. The seller saved a complete address at `/account/shipping-origin`.
3. The buyer entered a complete Mexican destination address.
4. The listing's package size and category mapping are valid.
5. The deployment has the correct eShip base URL/key for its environment and the carrier is
   responding.

After payment, the normal launch posture is seller-triggered label purchase with **Generar guía**.
`AV_SHIPPING_LABELS_ENABLED=true` enables the capability; it does not auto-buy unless
`ESHIP_LABEL_AUTOBUY=true` is also set.

| Label state                           | Operator action                                                                                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Purchased / **Descargar guía**        | Verify tracking and PDF; do not buy another label.                                                                                                                                                                                   |
| Definitive failure / **Generar guía** | The seller can retry in their sale UI. An allowlisted operator has API authorization only and must use the approved engineering procedure.                                                                                           |
| Processing                            | Wait for completion; do not send another purchase request.                                                                                                                                                                           |
| Unknown outcome                       | Check the eShip dashboard first. The carrier may have charged AV even though the app lost the response. After proving no label exists, an allowlisted operator uses the approved API/engineering procedure; there is no operator UI. |
| `especial` / Contactar AV             | No automatic quote or label; follow the approved manual arrangement.                                                                                                                                                                 |

Keep `ESHIP_LABEL_AUTOBUY=false` until the purchased-label cancellation/refund policy is approved.
For money-flow and IVA details, use the [eShip integration guide](integrations/eship.md).

### 14.7 Notification Operations

The production notification pipeline is healthy only when:

- `GET /api/notifications/readiness` returns HTTP `200`;
- `GET /api/brevo/health` returns HTTP `200` for the enabled Brevo features;
- the PostgreSQL migrations are current;
- exactly one active process reports poller leadership; and
- logs do not show recurring `[notificationAlert]`, provider, or backlog errors.

Channel flags are explicit. WhatsApp notifications are code-level release-locked out of the first
release; keep `AV_WHATSAPP_NOTIFICATIONS_ENABLED=false`. Do not work around the lock by adding a
phone number or token. A later reviewed rollout must first complete the recipient, consent, and Meta
API version work in [pending notifications](pending/notifications.md).

For Brevo/newsletter cases:

- marketing membership requires affirmative consent; account creation alone is not newsletter
  consent;
- withdrawals, hard bounces, complaints, blocks, and unsubscribes can suppress later marketing
  sends;
- never manually re-add or unsuppress a contact without a new authorized opt-in; and
- use provider event details and the first-party consent record when investigating a missing send.

When a readiness endpoint returns `503`, capture its named missing/failed checks and escalate the
configuration or database issue. Do not enable more channels until readiness is restored.

### 14.8 Incident Records and Escalation

For an incident, record enough evidence to reproduce it without exposing secrets:

- Test or Live, public URL, and timestamp with timezone;
- account role and relevant UUIDs;
- expected behavior, actual behavior, and exact visible error;
- transaction transition, HTTP status/error code, or import row number;
- screenshots with addresses, phones, payment data, tokens, and keys redacted; and
- reversible actions already taken.

Escalate immediately when an issue may create duplicate charges or labels, expose protected data,
misdirect notifications, alter payouts, block all checkout, or affect multiple Live users. Stop
retries while the external outcome is unknown.

For the initial deployment boundary, follow the approved
[Heroku Test-to-Live runbook](operations/heroku-deployment.md) and
[release checklist](operations/release-checklist.md). Do not switch the production app between Test
and Live as an ordinary support action. After an operator-visible fix, update this canonical guide
first, rebuild the English shareable HTML, and synchronize every translated edition intended for
distribution.
