# Configuración de Stripe Connect para el marketplace en Live

Traducción al español de [stripe-connect-setup.md](stripe-connect-setup.md). Si las dos versiones no
coinciden, la versión en inglés es la de referencia.

Cómo configurar la cuenta de Stripe de Live para que las vendedoras puedan dar de alta sus pagos.
Todo se hace en el dashboard de Stripe; no hay que cambiar nada en Heroku ni en la Console de
Sharetribe. Los pasos siguen las guías de Stripe de Sharetribe (fuentes al final).

**Por qué existe esta guía:** el 2026-10-20, el alta de pagos de una vendedora en
`www.archivovintach.com` falló con este error de Stripe:

> You must complete your platform profile to use Connect and create live connected accounts.

(En español: "Debes completar el perfil de tu plataforma para usar Connect y crear cuentas
conectadas en modo real".) Mientras el perfil de plataforma de Connect no esté completo, Stripe se
niega a crear las cuentas conectadas de las vendedoras: ninguna vendedora puede recibir dinero y no
se puede iniciar ninguna compra. Se da seguimiento en el
[launch tracker](../pending/live-launch.md), §4 y E2.

**Quién:** la persona dueña de la cuenta de Stripe (Fernanda), con el dashboard en **modo Live** (el
interruptor "Test mode" / "Modo de prueba" apagado).

Los nombres de opciones entre comillas son los textos en inglés del dashboard. Si el dashboard está
en español, elige la opción equivalente.

## 1. Completar el perfil de plataforma de Connect

1. Abre el enlace del error, <https://dashboard.stripe.com/connect/accounts/overview>, y haz clic en
   el botón para terminar de configurar Connect / el perfil de plataforma.
2. **Modelo de negocio:** elige **Marketplace** y guarda.
3. Responde el cuestionario como recomienda Sharetribe:

   | Pregunta                                      | Respuesta                                                                               |
   | --------------------------------------------- | --------------------------------------------------------------------------------------- |
   | Cómo fluye el dinero                          | **"Buyers will purchase from you"** y luego **"Sellers will be paid out individually"** |
   | Creación de cuentas (alta de vendedoras)      | **"Onboarding hosted by Stripe"** (alta alojada por Stripe)                             |
   | Gestión de cuentas (panel de las vendedoras)  | **"Build your own with our API"** (la plataforma construye el suyo con la API)          |
   | Responsabilidad por reembolsos y contracargos | **Acepta** que la plataforma es responsable                                             |
   | Verificación continua                         | **Acepta** y confirma                                                                   |
   | Industria                                     | Ropa / reventa de moda de segunda mano, o la opción más cercana                         |
   | Nombre en el estado de cuenta de la clientela | El de la plataforma: **ARCHIVO VINTACH**                                                |
   | A quién contacta la clientela por disputas    | A la plataforma (Archivo Vintach)                                                       |

4. Omite los pasos opcionales "Test Connect" e "Integration tutorial", y cualquier sugerencia de
   crear productos.
5. Envía. Stripe dice que revisa en **un día hábil**. Revisa el correo de la cuenta de Stripe (y la
   carpeta de spam) por si piden más información. Si la revisión tarda más, contacta al soporte de
   Sharetribe con el correo de la cuenta de Stripe y la fecha en que enviaste la solicitud.

## 2. Configuración de pagos de Connect

**⚙ Settings (Configuración) → Connect → Payouts (Pagos) → External accounts (Cuentas externas)**:

- ¿Requerir al menos una cuenta bancaria? ("Require at least one bank account?") **Sí**
- ¿Permitir tarjetas de débito? ("Allow debit cards?") **No**
- ¿Recopilar varias cuentas externas por moneda? ("Collect multiple external accounts per
  currency?") **No**
- **Activa** "Collect external account information for accounts where the platform is responsible
  for collecting requirements" (recopilar la información de la cuenta externa cuando la plataforma
  es responsable de recopilar los requisitos).

## 3. Activar Accounts V1

Abre <https://dashboard.stripe.com/settings/features/feat_accounts_v1_support> y luego **Edit →
Enable → Save** (Editar → Activar → Guardar).

Si el enlace te lleva a la página principal del dashboard, la cuenta todavía no está verificada por
completo. Termina primero la verificación y luego vuelve.

## 4. Calendario de pagos de la plataforma

En la configuración de cuenta bancaria y pagos de la plataforma, Sharetribe recomienda un calendario
de pagos **Manual** para la cuenta propia de la plataforma. Esto es aparte de los pagos a las
vendedoras, que maneja Sharetribe. Verifica que esté en Manual.

## 5. Marca (opcional, recomendado)

**⚙ Settings → Connect → Onboarding interface → Customize** (Personalizar): agrega el logo, el azul
de la marca `#0f26e4` y el nombre, para que las vendedoras vean Archivo Vintach en las páginas de
alta de Stripe.

## 6. Revisar las claves (no se espera ningún cambio)

- La Console de Sharetribe **Live** → Payments debe tener la clave secreta **`sk_live_…`**, y el
  build de Heroku lleva la clave publicable **`pk_live_…`** (`REACT_APP_STRIPE_PUBLISHABLE_KEY`).
  Las dos deben ser de **esta misma** cuenta de Stripe.
- Si la cuenta de Stripe se volvió a crear en algún momento, actualiza las claves en los dos
  lugares. Cambiar la clave de Heroku requiere reconstruir la app, porque los valores `REACT_APP_*`
  se compilan dentro del bundle del navegador.
- Nunca compartas la clave secreta por chat, correo ni tickets; Sharetribe no agrega claves por ti.

## 7. Reintentar el alta de la vendedora

Cuando Stripe confirme que el perfil está aprobado, la vendedora abre la página de pagos de su
cuenta en `www.archivovintach.com` y completa el alta alojada por Stripe. Necesitará una
identificación oficial, la CLABE de 18 dígitos de su banco y sus datos fiscales; Stripe pide lo que
exige México.

Después, confirma en Live que la vendedora aparece conectada a Stripe (Integration API `users.show`
→ `stripeConnected: true`) y regístralo en el launch tracker, E2.

## Fuentes (en inglés)

- [How to set up Stripe for payments on your marketplace](https://www.sharetribe.com/help/en/articles/8413086-how-to-set-up-stripe-for-payments-on-your-marketplace)
  (Sharetribe Help)
- [How to set up Stripe](https://sharetribe.com/docs/the-new-sharetribe/how-to-stripe) (Sharetribe
  docs)
- [Stripe Connect platform review](https://sharetribe.com/docs/how-to/stripe-connect-platform-review)
  (Sharetribe docs)
