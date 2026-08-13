# Plan: cerrar `/armaduras-2d` antes de propagar

> **Estado: en curso desde el 2026-08-12.** Hechos y commiteados: S1, S3, el entorno DOM para tests de componentes y D6 + U4. Quedan **11 puntos**, pendientes y ordenados abajo.

Este documento existe porque el **2026-08-12** el usuario tomó una decisión de orden que cambia el plan que venía en el [roadmap](./refactor-roadmap.md):

> **Terminar `/armaduras-2d` por completo, y recién entonces saltar a los otros sistemas.**

Todo lo que faltaba de ese sistema estaba repartido entre tres lugares —las deudas del roadmap, el grupo U y el grupo N de [`pendientes-comparacion.md`](./pendientes-comparacion.md)—, así que acá se junta y se ordena. **Es la lista de trabajo activa.** El *porqué* de cada punto sigue estando en su documento de origen; este no lo repite, lo referencia.

## Por qué este orden y qué cuesta

`/armaduras-2d` es la referencia de UI de los cuatro sistemas: lo que se hace ahí primero se mira, se corrige, y recién después se replica. Eso ya se venía haciendo de hecho (por eso el sistema está más adelante que los otros tres), pero hasta ahora sin decirlo. Ahora es explícito.

**El costo hay que tenerlo presente**: cada cosa que se agrega acá **agranda el hilo C** del roadmap, que es propagar a `/springs`, `/frame2d` y `/armaduras-3d`. Ese hilo ya había crecido de dos funciones a cinco tras la sesión del P0. Al terminar esta lista va a ser bastante más grande. Es el intercambio elegido a conciencia: **se propaga una sola vez, contra una referencia terminada**, en vez de propagar cinco veces a medida que cada cosa aparece.

## Lo que quedó explícitamente afuera

Para no volver a discutirlo:

- **D9** (el stepper que salta de renglón al rewrapear el `flex-wrap`). Cualquiera de sus dos salidas cambia el layout responsive de **todo** el panel de resultados, y eso es un riesgo desproporcionado para el problema. Sigue como deuda en el roadmap.
- **Grupo M** (M1 numeración de DOF por el usuario, M2 nombres duplicados). Alcanzan a los cuatro sistemas y tocan motor/store, no la UI de uno. Se deciden al cerrar el Tren C, como ya decía `pendientes-comparacion.md`.
- **S2**, la navegación definitiva. Hoy hay una navbar **provisional** (ver abajo). La decisión de fondo —si los sistemas y el contenido educativo comparten layout— se toma antes de la Fase 8.
- **N6**, contenido teórico enlazado: es la Fase 8.
- **Conversión de unidades**. U5 entra solo como rótulo (ver su punto).

## Hecho

### ✅ S1 · Nombre, idioma y metadata (commit `b1ee999`)

La app se llama **Eder Estructuras** (lo eligió el usuario). `lang="es"`, y nombre y descripción centralizados en `src/lib/site-config.ts` —que también exporta `systemLinks`, la lista de los cuatro sistemas— porque aparecen en la metadata, la home y la navbar. El título usa `title.template`, así que si una página exporta el suyo resuelve como `Armaduras 2D | Eder Estructuras`.

### ✅ S3 · Modo oscuro montado y verificado (commit `b9468e0`)

`next-themes` estaba instalado desde el principio y **nunca se había montado**: los tokens `.dark` eran código muerto. Ahora va en `layout.tsx` con `attribute="class"`, que es lo que corresponde al `@custom-variant dark (&:is(.dark *))` de `globals.css`.

Tres cosas que conviene saber antes de tocar esto:

1. **La navbar (`custom/site-navbar.tsx`) es provisional.** Existe porque el toggle necesitaba vivir en algún lado y no había ninguna navegación. No tiene estado de link activo a propósito: pedirlo obliga a `usePathname` y a volver cliente toda la barra, y esa es una decisión del diseño definitivo (S2), no de este.
2. **El toggle no usa el patrón `useState` + `useEffect` de "mounted"**, que es lo habitual para evitar el desajuste de hidratación. Esa es exactamente la regla `react-hooks/set-state-in-effect` de los 2 errores de lint preexistentes en `ui/`, y un tercero rompería el criterio de "si aparece un tercer error, ese sí es nuevo". En su lugar dibuja los dos iconos y deja que `dark:` decida cuál se ve: markup idéntico en servidor y cliente, sin parpadeo y sin estado.
3. **`suppressHydrationWarning` en `<html>` es requisito**, no adorno: el script inline de `next-themes` escribe la clase antes de que React hidrate.

**Lo que la verificación en oscuro encontró** (primera vez que se mira, deuda D5):

- Los **cuatro colores de zona de la partición** (`sky`/`emerald`/`amber`/`violet` al 20%), que hasta hoy se afirmaban *por construcción y no por captura*, **funcionan**: se distinguen del fondo y entre sí. Distancias RGB medidas contra el fondo: sky 80, emerald 61, amber 80, violet 90.
- **Ojo con esto**: a simple vista parecía que `Kff` (sky) se perdía contra el fondo, y **medir lo desmintió**. Es la misma lección que ya estaba escrita en el roadmap para el caso del `mb-4`: sobre una captura hay que *medir*, no razonar. El recorte y la moda de color por zona están en el método de abajo.

**Lo que NO se verificó ese día**: que el click del toggle cambie el tema. Headless no interactúa; lo que se comprobó fue que la página rinde bien en ambos temas forzando `forcedTheme`, que es otra cosa. Quedó cubierto enseguida, en el punto siguiente: fue el primer click que se ejercitó en el repo.

### ✅ Entorno DOM para tests de componentes

Era el habilitador del resto de la lista: casi todo lo que sigue (U2, U3, N2, N3, N4) es interacción pura, y hasta acá **ningún click se había ejercitado nunca** en todo el repo. Ahora hay 13 tests de componente y **el primer click del repo pasó**: el toggle de tema efectivamente escribe y saca la clase `dark` de `<html>`, que era lo único que la verificación headless no podía comprobar.

Un dato que este documento tenía mal: **`vitest.config.mts` ya existía** desde el commit del motor, con el alias `@` → `src` puesto. Lo único que le faltaba era el plugin de React.

Las cuatro decisiones, para no rediscutirlas al escribir el próximo test:

1. **El entorno se pide por archivo**, con el docblock `// @vitest-environment happy-dom`. El default sigue siendo `node`, que es donde corren los tests de motor y stores. `environmentMatchGlobs` no existe más en Vitest 4 y `test.projects` obliga a mantener dos configuraciones para ganar lo mismo.
2. **No hay `setupFiles`**, por la misma razón: un archivo de setup corre para *todos* los tests, así que importar ahí `@testing-library/react` metería DOM en los que corren en `node`. Cada test de componente hace su propio `afterEach(cleanup)` — y el del toggle además limpia `<html>` y `localStorage`, que quedan fuera de lo que `cleanup` desmonta.
3. **Sin `@testing-library/jest-dom`.** Da matchers más lindos (`toBeDisabled`) a cambio de una dependencia más y un import por archivo; `getByRole` ya falla sola si el elemento no está, y lo demás sale con aserciones planas.
4. **Cada `render` va dentro de un `<Provider>` de Jotai.** Los átomos son de módulo: sin store propio, el override de decimales de un test se filtra al siguiente. Y donde el DOM no alcanza para afirmar lo que importa —el orden de las filas— el test monta una sonda que espeja el átomo, en vez de pedirle nombres accesibles al markup solo para poder consultarlo.

Cubierto: el toggle de tema (los dos clicks y que los dos iconos sigan en el DOM, que es la decisión que evita el tercer error de lint), el stepper de decimales entero (topes 0/8, que una tabla no arrastre a la de al lado, herencia de la sección, el ↺ y el «Restablecer» en cascada), y las tres acciones de la tabla de barras (agregar al final, **insertar en el medio** —la función que el port había perdido—, eliminar, y «Aplicar a las N barras» pasando por mathjs).

Los 51 tests que había siguen verdes: **64 en total**, `tsc` limpio, build OK y lint con los 2 errores preexistentes de `ui/`, sin un tercero.

### ✅ D6 + U4 · Etiquetas de las flechas, y el valor de N sobre cada barra

Iban juntas porque U4 agravaba exactamente el problema de D6: sumar una etiqueta por barra sobre unas etiquetas que ya se pisaban entre sí. **El detalle de las reglas está en [`diagram-pattern.md`](./diagram-pattern.md), "Dónde van los números"**; acá va lo que conviene saber de la sesión.

D6 estaba mal diagnosticada, y la captura lo mostró en el primer intento: el problema no era la distancia a la punta sino que la etiqueta iba **centrada** en ese punto, así que la mitad del número volvía sobre su propia cabeza de flecha. Se ve en la captura de antes: `4.8000` con la punta clavada entre el `4` y el `8`.

Se aplicaron **las dos** salidas anotadas y una tercera que apareció mirando:

1. Correr las etiquetas (ancla `start`/`end`, medio renglón abajo en las horizontales, al costado en las verticales, arriba a la izquierda en el arco de momento).
2. Halo del color del fondo en **todo** el texto de los diagramas, vía el componente nuevo `DiagramLabel` — también los nombres de nudo y de barra, que se cruzaban con las barras y no estaban en la deuda.
3. **Margen del `viewBox` del 15% al 28%**, porque las etiquetas se cortaban contra el borde del lienzo. Es una desigualdad que se muerde la cola (el margen agranda la unidad y con ella el texto); `viewbox.test.ts` la fija.

**Tres cosas aparecieron solo por mirar**, con los tests y el build en verde — la cuarta sesión seguida:

- La etiqueta de una barra casi vertical **cambiaba de lado por un desplazamiento de milésimas**. La primera regla de corrimiento ("siempre hacia arriba en pantalla") no significa nada cuando la perpendicular es casi horizontal: ahí el signo lo decide el ruido. Se cambió por "hacia afuera de la figura", medido contra el centro.
- El corrimiento perpendicular **no alcanzaba sin cambiar el ancla**: el texto mide varias veces lo que se corre, así que centrado volvía a cruzar su barra.
- La **forma deformada de `/frame2d`** —que nunca se había mirado, era la primera deuda de la lista de "sin mirar" del roadmap— tenía el número de la reacción horizontal cortado por el borde y el del momento encima del de la reacción vertical, en los dos apoyos.

**Alcanza también a `/frame2d`**, porque el módulo de diagramas es compartido: sus barras muestran ahora la fuerza axial y sus etiquetas se corrieron igual. Es el mismo caso que el arreglo de los apoyos del 2026-08-10, no una propagación del hilo C — pero conviene saberlo, porque cambia cómo se ve una ruta que no era el objetivo de la tarea.

Tests: `axial-label.test.ts` y `viewbox.test.ts` (geometría pura, en `node`) y `force-arrow.test.tsx` (DOM), que fija que la etiqueta arranque después de la punta y crezca hacia afuera. 81 tests en total.

## Pendiente, en orden

### 1 · D10 · La cadena `K = A·k·Aᵀ` no entra en pantalla ⬅️ **acá se retoma**

Con 4 decimales y `EA/L` del orden de 10⁴ no entra en 1500 px y el último operando queda fuera hasta scrollear. `MatrixEquation` **nunca envuelve a propósito** (una ecuación partida en dos renglones deja de leerse como ecuación), y por eso `K` va primero. Salidas: una forma compacta que colapse los operandos, o bajar los decimales por defecto de esa sección.

### 2 · D1 · El error de matriz singular, en inglés

`System.solve()` deja pasar *"Cannot calculate inverse, determinant is zero"* de mathjs cuando `Kff` no tiene inversa — que es el caso **normal** de agregar un nudo antes de conectarlo. Un solo lugar (`src/lib/engine/system.ts`) y alcanza a los cuatro sistemas gratis.

### 3 · U3 · Estado vacío del panel de resultados

`ResultsPanel` devuelve `null` si hay error, y queda el título "Resultados" con el selector de decimales al lado y nada debajo. **Decisión abierta**: mensaje en el lugar de los resultados, o esconder la sección entera (más limpio, pero hace saltar el layout). Dato útil: `ui/empty.tsx` ya está instalado.

### 4 · U1 · Encabezados agrupados en la tabla de nudos

Hoy son nueve columnas planas (`node-table.tsx`): "Fuerza X", "Desplaz. X"… El original agrupaba `Coordenadas` / `Fuerza` / `Desplazamiento` / `Restringido` en dos niveles con `colSpan`. Al agrupar la tabla se angosta bastante: revisar en la misma pasada si las dos columnas de restricción siguen como checkbox suelto o se compactan.

### 5 · U2 · Combobox buscable en Desde/Hacia

Hoy es un `Select` plano. `cmdk` ya está en dependencias y `ui/combobox.tsx` y `ui/command.tsx` ya están instalados, así que es directo. Sumar el rechazo de **"Desde = Hacia"**, que hoy solo detecta el motor como longitud cero. Con 4 nudos el `Select` está bien; el problema aparece a los 15.

### 6 · U5 · Unidades rotuladas

Que una app de análisis estructural no diga si un `20000000` es kN/m² o kgf/cm² es lo que un profesor marca. **Alcance decidido: rotular con un sistema fijo y documentado (kN, m, kN/m²)** en encabezados y resultados. Sin estado nuevo. La conversión entre sistemas queda para cuando alguien la pida.

### 7 · N4 · Vincular matriz ↔ modelo

**El de mejor retorno de toda la lista**, y ya tiene sus tres piezas puestas: las etiquetas nudo+eje existen en todas las matrices, `MatrixTable` tiene `cellClass` (lo agregó el P0) y `assembly.steps` ya sabe qué barra tocó qué celdas. Pasar el mouse por una celda de `K` resalta los dos grados de libertad y las barras que aportan ahí. Responde *¿por qué aparece un número en esta celda y no en la de al lado?*, que es lo que no se entiende del método matricial.

### 8 · N5 · Verificación de equilibrio

ΣF = 0 por nudo y global, como cierre de los resultados. Los scripts de regresión ya hacen esta verificación **fuera del repo**; traerla a la UI cierra el recorrido pedagógico. **Decisión abierta**: sección propia del acordeón o cartel de "resultado verificado" arriba.

### 9 · N3 · Vincular tabla ↔ diagrama

Pasar el mouse por una fila resalta el nudo o la barra en el esquema, y al revés. **Decisión abierta**: dónde vive el estado de resaltado (átomo por sistema o contexto local). Es transversal a los cuatro sistemas y a los dos módulos de diagrama, así que conviene definirlo una vez y bien — y N4 va antes justamente para que ese mecanismo ya esté decidido cuando llegue acá.

### 10 · N1 · Persistencia en `localStorage`

Hoy recargar la página pierde todo: es la frustración más común y la más barata de evitar. Es barato por una decisión ya tomada: los átomos guardan **datos planos, nunca instancias del motor**, así que el estado ya es serializable por diseño y no hay que inventar formato. **Lo único a definir es el versionado**, para que un archivo guardado hoy no explote cuando una tabla gane una columna. Descargar/subir JSON y la URL compartible quedan para después.

### 11 · N2 · Ejemplos precargados

Dos o tres armaduras clásicas elegibles de una lista. **Depende de N1**: cargar un ejemplo pisa lo que el usuario tenía, así que necesita confirmación o deshacer. Dato útil: la semilla actual **es el caso del test de regresión**, así que los números en pantalla ya se cotejan contra valores validados.

## Cómo verificar

Las reglas generales están en la [sección 5 del roadmap](./refactor-roadmap.md#5-estado-de-verificación-lo-que-está-probado-y-lo-que-no). Lo específico de esta tanda:

- `pnpm test` · `npx tsc --noEmit` · `pnpm build`. **`pnpm lint` da 2 errores preexistentes en `ui/`**; un tercero sí es nuevo.
- **Mirar la app no es opcional.** Van cuatro sesiones seguidas en que la primera captura encontró algo con los tests, `tsc` y el build ya en verde.
- **El dev server puede estar ya levantado** en el 3000 sirviendo este mismo repo: usalo, no lo mates.

**Para capturar una sección del acordeón que arranca cerrada**, tocar `defaultValue` del `<Accordion>` en `results-panel.tsx` (hoy `["dof"]`), capturar y **revertir**. Conviene abrir *solo* la sección de interés: así queda arriba y se recorta sin buscarla en una captura de 16000 px.

**Para capturar un tema concreto**, agregarle `forcedTheme="light"` o `"dark"` al `<ThemeProvider>` de `layout.tsx`, capturar y revertir. Sin eso, headless resuelve `prefers-color-scheme` por su cuenta.

**Para juzgar un color, medirlo.** El ojo se equivoca sobre una captura —ya pasó con `Kff`—. La moda de color de una zona contra el fondo, con PIL:

```python
from collections import Counter
from PIL import Image
px = Image.open('captura.png').convert('RGB').load()
c = Counter(px[x, y] for y in range(y0, y1, 2) for x in range(x0, x1, 2))
color = c.most_common(1)[0][0]   # comparar contra la moda del fondo
```

## Al terminar esta lista

Se destraba el **hilo C** del roadmap: propagar a `/springs`, `/frame2d` y `/armaduras-3d`. Va a ser grande. Y sigue en pie la condición que el usuario puso desde el principio: **preguntarle antes de propagar**, porque nunca dio el visto bueno al conjunto de la UI, solo a los arreglos puntuales que fue encontrando.
