# Pendientes de la comparación con el proyecto original

El **2026-08-12** se comparó `/armaduras-2d` contra el `armor2d` del proyecto original (`D:\programming\repos_clonados\thesis-structures\src\programs\armor2d\`) archivo por archivo. De ahí salieron dos cosas:

- Lo **pedagógico**, que sí se va a hacer ahora y está planificado en [`docs/armaduras-2d-plan.md`](./armaduras-2d-plan.md).
- Todo lo demás, que es **este documento**: lo que la comparación encontró y se decidió no abordar todavía, con la decisión que hay que tomar en cada caso.

> **Actualización del 2026-08-12.** Buena parte de este documento **dejó de estar en espera**: el usuario decidió cerrar `/armaduras-2d` por completo antes de propagar, y con eso **los grupos U y N entraron enteros en la lista de trabajo activa**, que es [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md). Del grupo S ya se hicieron **S1** y **S3**. Lo que sigue realmente en espera es **S2** (la navegación definitiva) y el **grupo M** entero.
>
> Los puntos se dejan escritos acá igual, porque este documento es donde vive **la decisión abierta de cada uno** — el orden y el estado están en el otro.

Existe para no volver a descubrirlo dentro de seis meses, y para que cuando le llegue el turno a cada punto la discusión arranque de donde quedó y no de cero.

**Cómo leerlo.** Cada punto tiene un id estable (`S`hell, `M`otor, `U`sabilidad, `N`uevo) y, sobre todo, **la decisión abierta** — que es lo que no se puede reconstruir mirando el código. El *qué falta* casi siempre es obvio; el *por qué no se hizo así nomás*, no.

**Regla de orden que atraviesa todo el documento**: los grupos S y M alcanzan a los cuatro sistemas. Cambiar algo en un sistema es barato; en cuatro, no. Todo lo que alcance a los cuatro conviene decidirlo **una vez** y aplicarlo de una pasada, igual que se resolvió con el hilo C del [roadmap](./refactor-roadmap.md#3-los-hilos-pendientes).

---

## Grupo S — El shell de la app

Alcanza a los cuatro sistemas. Es lo más barato de la lista y lo más visible: son las tres cosas que alguien nota en los primeros diez segundos.

| # | Qué falta | Decisión abierta | Tamaño |
|---|---|---|---|
| **S1** | ✅ **Hecho el 2026-08-12** (commit `b1ee999`). La app se llama **Eder Estructuras**, `lang="es"`, y el nombre y la descripción viven en `src/lib/site-config.ts` — que también exporta `systemLinks` | — | chico |
| **S2** | **Parcial.** Hay una navbar **provisional** desde el 2026-08-12 (el toggle de tema necesitaba vivir en algún lado): nombre, los cuatro sistemas y el toggle, sin estado de link activo y sin footer. La decisión de fondo sigue abierta | Ver abajo — **no cambió** | chico/mediano |
| **S3** | ✅ **Hecho el 2026-08-12** (commit `b9468e0`). `next-themes` montado con `attribute="class"`, y `/armaduras-2d` verificada en oscuro por captura. Faltan los otros tres sistemas en oscuro | Ver abajo — lo que queda es la verificación, no la decisión | chico |

### S2 · Qué forma tiene la navegación

El original tenía navbar + footer y tres zonas (`/programs`, `/learn`, `/thesis`). Acá hoy hay una home con cuatro links y nada más.

Lo que hay que decidir no es "poner una navbar", es **si el layout de los sistemas es el mismo que el del contenido educativo**. El contenido educativo es la Fase 8 del roadmap y probablemente quiera su propia navegación (índice, secciones, anterior/siguiente), mientras que un sistema quiere ancho completo para las matrices. Si eso es así, conviene un route group (`(programs)`) con su layout, antes que meter todo en `src/app/layout.tsx` y después separarlo.

**Conviene decidirlo antes de la Fase 8, no durante.**

### S3 · Modo oscuro: montar el provider no alcanza

> **Montado el 2026-08-12**, y la advertencia de abajo se confirmó: activar el switch fue el principio del trabajo. `/armaduras-2d` se miró entera en oscuro y quedó bien —incluidos los cuatro colores de zona de la partición, medidos—, pero **los otros tres sistemas siguen sin mirarse**.

Montar `ThemeProvider` y un toggle es de una tarde. Lo que había que tener en cuenta es que **nunca se había mirado ningún sistema en oscuro** (deuda D5 del roadmap), así que activar el switch es el principio del trabajo, no el final.

El caso delicado es `/armaduras-3d`: los materiales de three.js no aceptan clases de CSS, así que los colores se leen de los tokens `oklch` y se convierten en `src/components/custom/diagram-3d/theme-colors.ts`. Eso es una lectura, no una suscripción — **hay que verificar que la escena se repinte al cambiar de tema**, y no asumirlo. Está explicado en [`docs/diagram-3d-pattern.md`](./diagram-3d-pattern.md).

---

## Grupo M — El motor (los cuatro sistemas)

| # | Qué falta | Decisión abierta | Tamaño |
|---|---|---|---|
| **M1** | El original dejaba que el alumno **numerara los grados de libertad a mano** y eligiera si los restringidos van arriba o abajo. Acá `System.buildDOFOrder()` numera por orden de inserción y no hay forma de intervenir | Ver abajo — es la decisión más interesante del documento | mediano |
| **M2** | No se validan **nombres duplicados** de nudo ni de barra. El original sí (errores e100/e200). Acá los ids son UUID, así que dos nudos llamados `v1` pasan sin protestar y dejan ambiguas las etiquetas de todas las matrices | Ver abajo | chico |

### M1 · ¿Numeración propia del alumno, o reordenar filas?

**Por qué importa de verdad**: el alumno resuelve el ejercicio a mano con *su* numeración y quiere cotejar contra la app. Si la app numera distinto, sus matrices y las de la pantalla no se pueden comparar término a término, y el valor pedagógico se cae. No es un capricho del original: es exactamente el caso de uso académico.

Hay dos formas de darlo, y son muy distintas en costo:

1. **Numeración explícita** (lo que hacía el original): dos columnas más por nudo, un estado paralelo, y la tabla de orden mostrando "interno" contra "usuario". Duplica el estado y hay que validar que la numeración del usuario sea una permutación completa, sin huecos ni repetidos.
2. **Reordenar las filas** (no toca el motor): `buildDOFOrder()` numera por orden de inserción, y el orden de inserción lo decide el store. O sea que **arrastrar filas ya es cambiar la numeración**, y solo hace falta mostrar el índice resultante en la tabla. Mucho más barato, y el botón de insertar en el medio ya existe justamente porque el orden de las filas tiene sentido.

La segunda cubre el caso real con una fracción del trabajo. La pregunta abierta es si cubre *todos* los casos: con 2 DOF por nudo, reordenar filas permuta de a pares (`v1x`,`v1z` van juntos), y una numeración arbitraria del alumno podría intercalarlos. **Habría que ver si eso pasa en la práctica o es un caso de laboratorio.**

El toggle **"¿los restringidos van arriba?"** es un problema aparte y más simple: es una permutación de la *partición*, no del ensamblaje. Se puede resolver como una vista (permutar solo para mostrar) sin tocar `System`.

### M2 · Dónde va la validación de nombres

El motor no conoce los nombres —solo ids—, así que la validación es del store o de la UI de cada sistema, no de `System`. Las decisiones son dos:

- **¿Bloquear o auto-renombrar?** El original bloqueaba. Auto-renombrar es menos molesto pero pisa lo que el usuario escribió.
- **¿Dónde se muestra el error?** Hay un gancho ya listo y sin usar: `DomainError` (en `src/components/custom/errors-panel.tsx`) tiene un campo `refId` que hoy **no se usa para nada**. Está justamente para anclar el error a la fila que lo causó, en vez de listarlo suelto arriba. Si se implementa M2, conviene resolver de paso el resaltado de la fila para todos los errores, no solo para este.

---

## Grupo U — Usabilidad de `/armaduras-2d`

Esto es lo que en la comparación se llamó **P1**: mejoras reales de uso que no son narrativa pedagógica y por eso quedaron fuera del [plan P0](./armaduras-2d-plan.md).

| # | Qué falta | Decisión abierta | Tamaño |
|---|---|---|---|
| **U1** | Encabezados agrupados en la tabla de nudos. El original tenía `Coordenadas` / `Fuerza` / `Desplazamiento` / `Restringido` en dos niveles con `colSpan`; acá son nueve columnas planas ("Fuerza X", "Desplaz. X"…) | Al agrupar, la tabla se angosta bastante. Conviene revisar en la misma pasada si las dos columnas de restricción siguen como checkbox suelto o se compactan | chico |
| **U2** | Combobox buscable en "Desde" / "Hacia". El original lo tenía; acá es un `Select` plano | `cmdk` ya está en dependencias, así que `Command` + `Popover` es directo. La decisión es **cuándo**: con 4 nudos el `Select` está perfecto y el problema recién aparece a los 15. Sumar de paso el rechazo de "Desde = Hacia", que hoy solo se entera el motor (longitud cero) | chico |
| **U3** | Estado vacío del panel de resultados: `ResultsPanel` devuelve `null` si hay error, y queda el título "Resultados" con el selector de decimales al lado y nada debajo | ¿Un mensaje en el lugar de los resultados, o esconder la sección entera incluido el título? Lo segundo es más limpio pero hace saltar el layout | chico |
| ~~**U4**~~ | ✅ **Hecho el 2026-08-12**, junto con D6 como estaba previsto. El número va sobre cada barra de la forma deformada, al 25% del recorrido y corrido hacia afuera de la figura, del mismo color que la barra. Alcanza también a `/frame2d`, que comparte el módulo de diagramas. Ver [`diagram-pattern.md`](./diagram-pattern.md), "Dónde van los números" | — | — |
| **U5** | **Unidades.** No las tiene ninguna de las dos versiones | Ver abajo | mediano |

### U5 · Unidades: rotular es barato, convertir no

Que una app de análisis estructural no diga en ninguna parte si esos `20000000` son kN/m² o kgf/cm² es raro, y para un contexto académico es peor que raro: es justo lo que un profesor marca.

Hay dos alcances muy distintos:

- **Rotular con un sistema fijo y documentado** (kN, m, kN/m²): son etiquetas en los encabezados de las tablas y en los resultados. Barato, sin estado nuevo, y resuelve el 90% del problema.
- **Selector de sistema de unidades con conversión**: estado nuevo, factores de conversión, y la pregunta de si convierte los valores o solo cambia el rótulo (las dos cosas confunden a alguien).

**Recomendación: lo primero, y dejar la conversión para cuando alguien la pida.** Alcanza a los cuatro sistemas, así que aplica la regla de orden del principio.

---

## Grupo N — Lo que ninguna de las dos versiones tuvo nunca

Esto es el **P2**: no son regresiones, son las mejoras que harían que el rework sea *mucho* mejor y no solo *igual*.

| # | Qué | Decisión abierta | Tamaño |
|---|---|---|---|
| **N1** | **Guardar / cargar / compartir un problema.** Hoy un alumno no puede entregar su ejercicio ni retomarlo mañana: recargar la página lo pierde todo | Ver abajo | mediano |
| **N2** | **Ejemplos precargados** (dos o tres armaduras clásicas) elegibles de una lista | Cargar un ejemplo pisa lo que el usuario tenía. Necesita confirmación o deshacer — y eso depende de N1. Dato útil: la semilla actual **es el caso del test de regresión**, así que los números en pantalla ya se pueden cotejar contra valores validados | chico |
| **N3** | **Vincular tabla ↔ diagrama**: pasar el mouse por una fila resalta el nudo o la barra en el esquema, y al revés | Dónde vive el estado de "resaltado": átomo por sistema o contexto local. Es transversal a los cuatro sistemas y a los dos módulos de diagrama, así que conviene definirlo una vez | mediano |
| **N4** | **Vincular matriz ↔ modelo**: pasar el mouse por una celda de K resalta los dos grados de libertad involucrados y las barras que aportan ahí | Ver abajo — es la mejor de la lista | mediano |
| **N5** | **Verificación de equilibrio** (ΣF = 0 por nudo y global) como cierre de los resultados | ¿Sección propia del acordeón, o un cartel de "resultado verificado" arriba? Los scripts de regresión ya hacen esta verificación **fuera del repo**; traerla a la UI cierra el recorrido pedagógico | chico |
| **N6** | **Contenido teórico enlazado desde cada sección** de resultados. El original tenía `/thesis/explanation/armor2d` | Es la **Fase 8** del roadmap, no una decisión suelta. Lo único que conviene adelantar es si el link va por sección del acordeón o si es una página aparte — porque eso condiciona S2 | — |

### N1 · Tres cosas distintas con el mismo nombre

"Guardar" son tres casos de uso que no se resuelven igual:

| Caso | Mecanismo | Qué resuelve |
|---|---|---|
| No perder todo al recargar | `localStorage` | La frustración más común y más barata de evitar |
| Entregar el ejercicio | Descargar/subir un JSON | El caso académico real |
| Mostrárselo al profesor | El modelo serializado en la URL | Compartir sin archivos |

**Recomendación: `localStorage` primero.** Es lo que más molesta hoy y lo más barato.

Todo esto es barato por una decisión ya tomada: los átomos guardan **datos planos, nunca instancias del motor** — está en [`docs/state-pattern.md`](./state-pattern.md). O sea que el estado ya es serializable por diseño, y no hay que inventar un formato: es lo que ya está en los átomos. Lo único a definir es el **versionado** del formato, para que un archivo guardado hoy no explote cuando una tabla gane una columna.

### N4 · La vinculación matriz ↔ modelo es la de mejor retorno

De toda la lista, esta es la que más enseña por unidad de trabajo, y **casi toda la información necesaria ya está calculada**:

- Las etiquetas nudo+eje (`v1x`, `v1z`, …) ya existen en todas las matrices.
- `assembly.steps` ya sabe qué barra tocó qué celdas — es lo que alimenta el resaltado de "celdas que cambiaron en este paso".
- El plan P0 agrega `cellClass` a `MatrixTable`, que es el gancho de estilo que esto necesita.

O sea que hoy esto es sobre todo cablear un `onMouseEnter`. Y lo que responde —*¿por qué aparece un número en esta celda y no en la de al lado?*— es exactamente lo que no se entiende del método matricial.

> **El P0 ya se hizo** (2026-08-12), así que `cellClass` existe y las tres piezas están puestas. **N4 es, de toda esta lista, lo que está más cerca de poder empezarse.**

---

## Cuándo volver a este documento

- **Durante el cierre de `/armaduras-2d`**: los grupos **U** y **N** están todos ahí adentro, así que este documento es el que tiene *por qué* de cada uno. El orden y el estado están en [`armaduras-2d-cierre.md`](./armaduras-2d-cierre.md).
- **Antes de arrancar la Fase 8** (contenido educativo): **S2** y **N6** se condicionan mutuamente, y la navbar de hoy es provisional justamente para no adelantar esa decisión.
- **Al cerrar el Tren C** (`frame2d-seismic`), cuando los cinco sistemas base estén completos: es el momento natural para el **grupo M**, que alcanza a todos y toca motor y stores.
