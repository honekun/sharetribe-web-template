# Plantillas transaccionales de Brevo (ES)

Create these as hosted Brevo transactional templates. Keep parameter names exactly as shown.
Promotional templates (all except the seller welcome) must include Brevo's unsubscribe link and a
legal sender footer (sender identity plus postal/contact address). The footer text has not been
written yet; it blocks Phase B, not the welcome.

These eight are the complete set: one per `BREVO_TEMPLATE_*` variable in
`server/services/marketingCampaigns.js` (`TEMPLATE_ENV`). Params are built there by
`buildSellerWelcomeEmail` and `buildCampaignEmail`.

Common parameters:

- `{{ params.NOMBRE }}` (the user's first name; `Usuario` if missing)
- `{{ params.MARKETPLACE_URL }}` (no trailing slash; append any app path to it)
- `{{ params.SEARCH_URL }}` (`/s`), `{{ params.CREATE_LISTING_URL }}` (`/l/new`),
  `{{ params.GUIDE_URL }}` (`/static/files/HowTo-AV_low.pdf`)
- `{{ params.LISTING.title }}`, `{{ params.LISTING.priceFormatted }}`,
  `{{ params.LISTING.imageUrl }}`, `{{ params.LISTING_URL }}`
- `{{ params.LISTINGS }}` for a Brevo loop containing up to three listing objects

The seller welcome receives only `NOMBRE`, `MARKETPLACE_URL`, `CREATE_LISTING_URL` and `GUIDE_URL`.
Campaigns receive all of them, but `LISTING` is empty (and `LISTING_URL` is the home page) unless
the campaign is about one listing.

`LISTING.imageUrl` can be `null` (listing without images), so never print it as text. Wrap the image
in a condition:

```html
{% if params.LISTING.imageUrl %}
<a href="{{ params.LISTING_URL }}">
  <img src="{{ params.LISTING.imageUrl }}" alt="{{ params.LISTING.title }}" />
</a>
{% endif %}
```

Each listing object also carries `closet` (the seller's display name), `id`, `slug` and `path`
(relative; link it as `{{ params.MARKETPLACE_URL }}{{ item.path }}` inside the loop). See the
[Brevo guide](brevo.md#hosted-transactional-templates) for every field. Listing data is captured
when the email is scheduled, so in the delayed emails the title, price and image may be up to 24 or
72 hours old. Only the matching-listings email reloads its listings just before sending.

## `BREVO_TEMPLATE_VIEWED_LISTING_A`

Sent 24 hours after a signed-in buyer spent 10 seconds on someone else's listing. It is cancelled if
they favorite it, send an inquiry or buy it, or if the listing is no longer published. A and B are
split by user.

- Asunto: `Una prenda de un closet chido te está esperando 👀`
- Preview: `Solo existe una. Ya la viste. Ya sabes.`

Hola {{ params.NOMBRE }},

Hay prendas que llegan a Archivo Vintach una sola vez. Esta es una de ellas.

[Image `params.LISTING.imageUrl`, guarded as shown above]

{{ params.LISTING.title }} — {{ params.LISTING.priceFormatted }}

Viene de un closet curado, con criterio y con amor. No es fast fashion. Es la pieza que alguien
eligió — y ahora puede ser tuya.

CTA: `Ver la prenda` → `{{ params.LISTING_URL }}`

## `BREVO_TEMPLATE_VIEWED_LISTING_B`

Same trigger as viewed A.

- Asunto: `Esta prenda merece seguir siendo amada 🌱`
- Preview: `Darle nueva vida es el gesto más fashion que existe.`

Hola {{ params.NOMBRE }},

Encontraste algo que ya tiene historia — y podría tener mucha más contigo.

[Image `params.LISTING.imageUrl`, guarded as shown above]

{{ params.LISTING.title }} — {{ params.LISTING.priceFormatted }}

Esta prenda que circula viene de un closet con muy buen ojo! Las piezas únicas en Archivo no
esperan. Cuando se van, se van!

CTA: `Comprar ahora` → `{{ params.LISTING_URL }}`

## `BREVO_TEMPLATE_ABANDONED_CHECKOUT`

Sent 30 minutes after Sharetribe expires an unpaid checkout (`transition/expire-payment`). The only
check before sending is that the transaction is still expired.

> **Step 3 updated 2026-10-10** (live in Brevo template 6). It replaces the pre-eShip "Coordina la
> entrega — tú decides cómo mover tus prendas". Sellers must set a shipping origin
> (`/account/shipping-origin`) or checkout can't quote shipping, and the buyer sees "Contactar AV".
> Once an order is paid, the seller generates the prepaid eShip label (Generar guía) and has 7 days
> to ship.

- Asunto: `Alguien más también la está mirando 👀`
- Preview: `Viene de un closet chido. Ya sabes lo que eso significa.`

Hola {{ params.NOMBRE }},

La buena noticia: todavía está disponible. La realidad: en Archivo Vintach las piezas únicas se
mueven rápido.

[Image `params.LISTING.imageUrl`, guarded as shown above]

{{ params.LISTING.title }} — {{ params.LISTING.priceFormatted }}

Esta pieza viene de un closet con criterio. No es cualquier prenda: alguien la eligió, la cuidó y
ahora la está soltando para que llegue a alguien que la merezca igual. Podría ser tuya hoy.

CTA: `Completar mi compra` → `{{ params.LISTING_URL }}`

— Archivo Vintach 🗂️

## `BREVO_TEMPLATE_MATCHING_LISTINGS_A`

Sent at 09:00 Mexico City time, at most once a day per user, when newly published listings match the
categories the user viewed or favorited in the last 90 days. Brand, size and color rank the matches.
It carries one to three listings, all still published at send time. A and B are split by user.

- Asunto: `Acaban de soltar algo que es muy tú ✨`
- Preview: `Piezas nuevas en el archivo. Recién llegadas. Únicas.`

Hola {{ params.NOMBRE }},

Alguien abrió su closet y soltó algo especial. Basándonos en lo que te ha gustado, creemos que esto
te va a hablar directo:

Render `params.LISTINGS` as photo + price + closet cards:

```html
{% for item in params.LISTINGS %}
<a href="{{ params.MARKETPLACE_URL }}{{ item.path }}">
  {% if item.imageUrl %}
  <img src="{{ item.imageUrl }}" alt="{{ item.title }}" />
  {% endif %}
  <p>{{ item.title }} — {{ item.priceFormatted }}</p>
  <p>{{ item.closet }}</p>
</a>
{% endfor %}
```

Cada pieza existe una sola vez en Archivo Vintach. Las que ves hoy, mañana pueden ya no estar.

CTA: `Ver todo lo que llegó →` → `{{ params.SEARCH_URL }}`

— Archivo Vintach 🗂️<br> Circula lo bonito.

## `BREVO_TEMPLATE_MATCHING_LISTINGS_B`

Same trigger as matching A.

- Asunto: `Tu próxima prenda favorita ya está en Archivo`
- Preview: `Alguien la amó. Ahora puede ser tuya.`

Hola {{ params.NOMBRE }},

Cada prenda que circula cuenta una historia diferente. Estas acaban de llegar — y hacen match con tu
rollo:

Render `params.LISTINGS` as photo + price cards: the loop from matching A without the
`{{ item.closet }}` paragraph.

Elegir secondhand no es solo una decisión de moda. Es decirle que no a la sobreproducción — y sí a
prendas que ya tienen alma.

CTA: `Ver todo el archivo →` → `{{ params.SEARCH_URL }}`

— Archivo Vintach 🗂️<br> Moda circular hecha en México.

## `BREVO_TEMPLATE_SIGNUP_NO_LISTING`

Sent to a `vendedor` or `vendedor-tienda` 24 hours after signup if they still have no published
listing. It is cancelled when their first listing is published.

- Asunto: `Alguien está buscando exactamente lo que tú tienes 🔍`
- Preview: `Publica hoy y empieza a ganar dinero`

Hola {{ params.NOMBRE }},

En este momento hay compradoras navegando Archivo Vintach buscando prendas como las tuyas. Piezas de
closets reales, con criterio, con historia. No fast fashion. No lo que está en todos lados. Lo que
tú tienes.

Publicar es gratis, rápido y vale la pena:

CTA: `Subir mi primera prenda →` → `{{ params.CREATE_LISTING_URL }}`

¿Dudas? `La guía rápida te explica todo en 3 minutos.` → `{{ params.GUIDE_URL }}`

— Archivo Vintach 🗂️

## `BREVO_TEMPLATE_SELLER_WELCOME`

Sent within one poll (about five minutes) of signup to `vendedor` and `vendedor-tienda` accounts
only. This is essential onboarding, so it is not consent-gated and has no unsubscribe link. It
arrives just after Sharetribe's verification email, so it must not ask the seller to verify.

- Asunto: `Te damos la bienvenida a Archivo Vintach ✨`
- Preview: `Tu closet ahora tiene otro destino posible.`

Hola {{ params.NOMBRE }},

Ya eres parte de algo bonito. Archivo Vintach existe porque creemos que las prendas merecen más de
una historia. Y que los closets con criterio como el tuyo — tienen cosas que otras personas van a
querer, cuidar y usar!

Aquí no circula cualquier cosa. Circula lo que vale.

Para empezar:

1. Publica tu primera prenda — fotos honestas, descripción con alma, precio justo
2. Conecta con tu compradora — responde rápido, genera confianza
3. Configura tu envío — agrega tu dirección de origen; cuando vendas, genera tu guía prepagada en un
   clic y envía en máximo 7 días

> **Approved as is (2026-10-10).** The client kept step 3 knowing it predates eShip: sellers now
> generate a prepaid label (Generar guía) and have 7 days to ship. The welcome also doesn't ask
> sellers to add a shipping origin address (`/account/shipping-origin`); the Manage Listings banner
> covers that instead.

CTA: `Publicar mi primera prenda` → `{{ params.CREATE_LISTING_URL }}`

¿Primera vez vendiendo? `Descarga la guía para vendedoras` → `{{ params.GUIDE_URL }}`

Con mucho gusto de tenerte aquí,<br> Sofi, Fer y el equipo de Archivo Vintach<br> Moda circular
hecha en México.

The application also attaches the seller guide, and `GUIDE_URL` links the same file:
`public/static/files/HowTo-AV_low.pdf`, a web-optimized (≈0.9 MB) export of the May 2026
`HowTo-AV.pdf`. Recipients see the attachment as `ArchivoVintach-how-to.pdf`.

## `BREVO_TEMPLATE_LISTING_NO_ACTIVITY`

Sent to the seller 72 hours after a listing is first published if nobody else has viewed it for 10
seconds, favorited it, sent an inquiry or bought it. It is skipped if the listing is no longer
published. One job is scheduled per listing, so the two-per-week cap is what stops a seller with
many listings getting many of these.

- Asunto: `Tu prenda merece más atención!`
- Preview: `Pequeños ajustes pueden cambiar todo.`

Hola {{ params.NOMBRE }},

Queremos ayudarte a que **{{ params.LISTING.title }}** llegue más lejos. Las prendas que más se
mueven en Archivo Vintach tienen esto en común:

Fotos que enamoran — luz natural, fondo limpio. Frente + detalle + etiqueta si tiene.

Descripción con historia — no solo la talla. Cuéntale a la compradora qué hace especial esa pieza,
de dónde viene, por qué la tenías.

Precio que mueve — revisa prendas similares en el archivo. Un precio justo atrae a la persona
correcta más rápido.

CTA: `Editar mi prenda` → `{{ params.LISTING_URL }}`

Tu prenda tiene valor. Solo necesita la vitrina correcta.

— Archivo Vintach<br> Cada pieza merece encontrar su siguiente dueño.
