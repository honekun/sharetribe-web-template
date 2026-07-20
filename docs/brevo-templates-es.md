# Plantillas transaccionales de Brevo (ES)

Create these as hosted Brevo transactional templates. Keep parameter names exactly as shown.
Promotional templates must include Brevo's unsubscribe link and the approved legal sender footer.

Common parameters:

- `{{ params.NOMBRE }}`
- `{{ params.MARKETPLACE_URL }}`
- `{{ params.SEARCH_URL }}`
- `{{ params.CREATE_LISTING_URL }}`
- `{{ params.GUIDE_URL }}`
- `{{ params.LISTING.title }}`, `{{ params.LISTING.priceFormatted }}`,
  `{{ params.LISTING.imageUrl }}`, `{{ params.LISTING_URL }}`
- `{{ params.LISTINGS }}` for a Brevo loop containing up to three listing objects

## `BREVO_TEMPLATE_VIEWED_LISTING_A`

- Asunto: `Una prenda de un closet chido te está esperando 👀`
- Preview: `Solo existe una. Ya la viste. Ya sabes.`

Hola {{ params.NOMBRE }},

Hay prendas que llegan a Archivo Vintach una sola vez. Esta es una de ellas.

{{ params.LISTING.imageUrl }}

{{ params.LISTING.title }} — {{ params.LISTING.priceFormatted }}

Viene de un closet curado, con criterio y con amor. No es fast fashion. Es la pieza que alguien
eligió — y ahora puede ser tuya.

CTA: `Ver la prenda` → `{{ params.LISTING_URL }}`

## `BREVO_TEMPLATE_VIEWED_LISTING_B`

- Asunto: `Esta prenda merece seguir siendo amada 🌱`
- Preview: `Darle nueva vida es el gesto más fashion que existe.`

Hola {{ params.NOMBRE }},

Encontraste algo que ya tiene historia — y podría tener mucha más contigo.

{{ params.LISTING.imageUrl }}

{{ params.LISTING.title }} — {{ params.LISTING.priceFormatted }}

Esta prenda que circula viene de un closet con muy buen ojo! Las piezas únicas en Archivo no
esperan. Cuando se van, se van!

CTA: `Comprar ahora` → `{{ params.LISTING_URL }}`

## `BREVO_TEMPLATE_ABANDONED_CHECKOUT`

- Asunto: `Alguien más también la está mirando 👀`
- Preview: `Viene de un closet chido. Ya sabes lo que eso significa.`

Hola {{ params.NOMBRE }},

La buena noticia: todavía está disponible. La realidad: en Archivo Vintach las piezas únicas se
mueven rápido.

{{ params.LISTING.imageUrl }}

{{ params.LISTING.title }} — {{ params.LISTING.priceFormatted }}

Esta pieza viene de un closet con criterio. No es cualquier prenda: alguien la eligió, la cuidó y
ahora la está soltando para que llegue a alguien que la merezca igual. Podría ser tuya hoy.

CTA: `Completar mi compra` → `{{ params.LISTING_URL }}`

— Archivo Vintach 🗂️

## `BREVO_TEMPLATE_MATCHING_LISTINGS_A`

- Asunto: `Acaban de soltar algo que es muy tú ✨`
- Preview: `Piezas nuevas en el archivo. Recién llegadas. Únicas.`

Hola {{ params.NOMBRE }},

Alguien abrió su closet y soltó algo especial. Basándonos en lo que te ha gustado, creemos que esto
te va a hablar directo:

Render `params.LISTINGS` as photo + price + closet, with each card linking to its `path` under
`params.MARKETPLACE_URL`.

Cada pieza existe una sola vez en Archivo Vintach. Las que ves hoy, mañana pueden ya no estar.

CTA: `Ver todo lo que llegó →` → `{{ params.SEARCH_URL }}`

— Archivo Vintach 🗂️<br>
Circula lo bonito.

## `BREVO_TEMPLATE_MATCHING_LISTINGS_B`

- Asunto: `Tu próxima prenda favorita ya está en Archivo`
- Preview: `Alguien la amó. Ahora puede ser tuya.`

Hola {{ params.NOMBRE }},

Cada prenda que circula cuenta una historia diferente. Estas acaban de llegar — y hacen match con tu
rollo:

Render `params.LISTINGS` as photo + price, with each card linking to its `path` under
`params.MARKETPLACE_URL`.

Elegir secondhand no es solo una decisión de moda. Es decirle que no a la sobreproducción — y sí a
prendas que ya tienen alma.

CTA: `Ver todo el archivo →` → `{{ params.SEARCH_URL }}`

— Archivo Vintach 🗂️<br>
Moda circular hecha en México.

## `BREVO_TEMPLATE_SIGNUP_NO_LISTING`

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

- Asunto: `Bienvenido a Archivo Vintach ✨`
- Preview: `Tu closet ahora tiene otro destino posible.`

Hola {{ params.NOMBRE }},

Ya eres parte de algo bonito. Archivo Vintach existe porque creemos que las prendas merecen más de
una historia. Y que los closets con criterio como el tuyo — tienen cosas que otras personas van a
querer, cuidar y usar!

Aquí no circula cualquier cosa. Circula lo que vale.

Para empezar:

1. Publica tu primera prenda — fotos honestas, descripción con alma, precio justo
2. Conecta con tu compradora — responde rápido, genera confianza
3. Coordina la entrega — tú decides cómo mover tus prendas

CTA: `Publicar mi primera prenda` → `{{ params.CREATE_LISTING_URL }}`

¿Primera vez vendiendo? `Descarga la guía para vendedoras` → `{{ params.GUIDE_URL }}`

Con mucho gusto de tenerte aquí,<br>
Sofi, Fer y el equipo de Archivo Vintach<br>
Moda circular hecha en México.

The application also attaches `ArchivoVintach-how-to.pdf`.

## `BREVO_TEMPLATE_LISTING_NO_ACTIVITY`

- Asunto: `Tu prenda merece más atención!`
- Preview: `Pequeños ajustes pueden cambiar todo.`

Hola {{ params.NOMBRE }},

Queremos ayudarte a que llegue más lejos. Las prendas que más se mueven en Archivo Vintach tienen
esto en común:

Fotos que enamoran — luz natural, fondo limpio. Frente + detalle + etiqueta si tiene.

Descripción con historia — no solo la talla. Cuéntale a la compradora qué hace especial esa pieza,
de dónde viene, por qué la tenías.

Precio que mueve — revisa prendas similares en el archivo. Un precio justo atrae a la persona
correcta más rápido.

CTA: `Editar mi prenda` → `{{ params.LISTING_URL }}`

Tu prenda tiene valor. Solo necesita la vitrina correcta.

— Archivo Vintach<br>
Cada pieza merece encontrar su siguiente dueño.
