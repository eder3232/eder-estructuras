# Plan: cerrar `/armaduras-2d` antes de propagar

> **Estado: en curso desde el 2026-08-12; última sesión el 2026-08-13.** Quedan **8 puntos**, ordenados abajo, y el siguiente es **U1**.
>
> Hechos y commiteados, en orden: S1, S3, el entorno DOM para tests de componentes, D6 + U4, D10, las matrices que crecen, y —ya en la tanda pedagógica del 2026-08-13— el desplazamiento unitario, D1 (el mecanismo diagnosticado y dibujado), la reciprocidad `k_ij = k_ji`, la animación de la deformada, el modo práctica, la sección de estabilidad y U3. Cada uno tiene su entrada abajo con lo que se decidió y lo que apareció al mirarlo.

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

### ✅ D10 · La cadena `K = A·k·Aᵀ` no entraba en pantalla

**Se resolvió ensanchando la página, no achicando el contenido**, y la decisión salió de medir: la cadena de una barra son cuatro matrices en fila —16 columnas contando las de etiquetas— y pide unos **1220 px**. En los **976 útiles** de `max-w-5xl` no entra **a ninguna precisión que sirva**:

| Intento | Ancho que sigue pidiendo |
| --- | --- |
| Como estaba (4 decimales) | ~1220 px |
| 2 decimales | ~1190 px |
| Fuente `text-xs` | ~1076 px |
| Las dos cosas juntas | ~1010 px |

O sea que **la salida "bajar los decimales por defecto de esa sección" que estaba anotada no alcanzaba sola**, y bajar de 2 no es una opción: los cosenos directores de `A` viven entre 0 y 1 y con 1 decimal dejan de decir nada. La otra salida anotada —colapsar los operandos y mostrar solo `K`— deshacía lo que la sesión de la narrativa pedagógica había decidido a propósito doce días antes: mostrar el paso entero y no solo el resultado.

`/armaduras-2d` pasó entonces a `max-w-[84rem]`, contra el `max-w-5xl` de los otros tres. Tres cosas que conviene saber:

- **Se ensancha la página y no el bloque de la ecuación.** `AccordionContent` lleva `overflow-hidden` —lo necesita para animar la altura, y es de `ui/`, o sea intocable—, así que todo lo que se salga de su ancho queda recortado: el acordeón tiene que *nacer* ancho.
- **El primer intento fue ensanchar solo los resultados, y la captura lo descartó**: la página quedaba con dos bordes izquierdos distintos, uno para las tablas de entrada y otro para los resultados. Se lee peor que el scroll que se quería sacar.
- **La prosa no se ensanchó con la página.** El panel de resultados le pone techo a sus párrafos de una sola vez (`[&_p]:max-w-3xl`) y las dos tablas de texto (`DofOrderTable` e `InternalForcesTable`, que son `w-full`) conservan el ancho que tenían. Ancho para los datos, medida de lectura para el texto.

**Lo que sigue scrolleando**, y se acepta: las dos cadenas de **cinco** operandos de la partición (`Uf = Kff⁻¹·(Ff − Kfr·Ur)` y `Rr = Krf·Uf + Krr·Ur`). Entran mucho más que antes —queda afuera un ~15%, el último operando— pero no completas. La deuda D10 nombraba la cadena de la transformación, que ahora sí entra entera.

Efecto lateral que **no** se propagó: `/frame2d` tiene el mismo problema y peor (su `A` es de 6×6), pero sigue en `max-w-5xl`. Eso es hilo C, y hay que preguntar antes.

### ✅ Matrices que crecen: notación compacta y etiquetas fijas

**No estaba en esta lista**: salió de una pregunta del usuario después de D10 — *las ecuaciones largas van a crecer mucho más con más nudos y en pórticos/3D, ¿cómo hacemos una UI decente para eso?*, seguida de *¿y el scroll horizontal de la versión anterior no era viable?*.

La segunda pregunta corrigió el diagnóstico, y conviene dejarlo escrito: **el scroll horizontal no es una alternativa a lo que hay, es lo que hay**. El original envolvía cada matriz en `overflow-x-auto` y este repo también. Entonces el problema nunca fue "falta scroll" sino dos cosas que el scroll no arregla: que scrollear te deja **sin las etiquetas** de fila y columna, y que hay **demasiado que scrollear**.

Se hicieron las dos capas que atacan eso, las dos dentro de `MatrixTable`, o sea que **alcanzan a los cuatro sistemas**:

1. **Notación compacta** (`number-scale.ts`): un `×10³` por matriz en vez de repetir la magnitud en cada celda. La celda baja de ~92 a ~58 px. Encendida por defecto y **con interruptor** (`<CompactNumbersControl />`, al lado del de decimales) porque el usuario pidió poder apagarla: el caso es cotejar contra un ejercicio resuelto a mano.
2. **Etiquetas fijas** al scrollear, opt-in por matriz (ver el porqué en [`state-pattern.md`](./state-pattern.md)).

Y un bug que apareció buscando dónde ponerlas: **los pasos de ensamblaje y los bloques de la partición no tenían contenedor de scroll**. Con el modelo semilla de 4 nudos no se nota; con uno más grande no se desbordan, **se recortan**, porque `AccordionContent` lleva `overflow-hidden`.

**Cómo se verificó**, que es la parte que costó:

- Se sembró temporalmente una armadura de **8 nudos y 13 barras** (global de 16×16) para ver el problema real en vez del semilla.
- Headless no scrollea, así que para ver una matriz *scrolleada* hubo que forzarla: el `#fragmento` no movió nada (las dos capturas salieron idénticas), y lo que sí funcionó fue **`dir="rtl"` en el contenedor de scroll**, que lo hace arrancar en el extremo derecho. Con eso se vio la columna de etiquetas efectivamente fijada — y de paso que el contenido pasa por debajo con el signo menos cortado, que es por lo que la columna lleva sombra.
- **Una predicción salió mal y la medición la desmintió**: se anticipó que con la notación compacta la cadena `K = A·k·Aᵀ` volvería a entrar en `max-w-5xl` y se podría revertir el ensanche de D10. Midiendo, la cadena bajó de ~1220 a **1115 px** —los operandos `A` y `Aᵀ` no encogen, porque sus valores ya son 0 y 1— contra 976 disponibles. **El ensanche sigue haciendo falta.**
- La global de 16×16, en cambio, **entra entera** con la página ancha y la notación compacta, donde antes scrolleaba.

**Lo que se decidió no hacer** y quedó anotado como deudas **D12**, **D13** y **D14** en el roadmap: el layout escalonado de la ecuación (que es también la respuesta responsive), la vista de mapa para matrices muy grandes, y el techo en los pasos de ensamblaje.

### ✅ Qué significa cada columna de K (desplazamiento unitario)

Primera de las cinco ideas pedagógicas que el usuario aprobó el 2026-08-12 (plan completo: las cinco están en el mensaje de esa sesión y en el roadmap).

`k_ij` es la fuerza que aparece en el grado de libertad *i* cuando se impone un desplazamiento unitario en el *j* y todos los demás quedan en cero. O sea que **una columna de `K` no es una lista de números: es un experimento físico completo**, y era lo único del método que la app calculaba sin mostrar. Ahora, debajo de la matriz global, se elige un grado de libertad y se ve la estructura con 1 ahí, las fuerzas que hacen falta para sostenerla —que *son* esa columna— y las barras que se estiran, que son las que ponen los números.

No hay cálculo nuevo: `unitDisplacementState()` (`src/lib/engine/unit-displacement.ts`) solo reordena lo que el motor ya sabe.

**Tres cosas que aparecieron al hacerlo:**

- **Un test falló por física, no por bug**: en un nudo donde solo llega una barra vertical, el término diagonal horizontal de `K` es **cero**, porque una barra de armadura solo tiene rigidez sobre su propio eje. Se dejó como caso documentado en `unit-displacement.test.ts`: ese cero es exactamente el mecanismo que diagnostica la etapa siguiente.
- **El dibujo y la matriz decían el mismo número de dos formas distintas** (`8106.6667` en la flecha, `8.1067 ×10³` en la tabla). Con la afirmación "las flechas *son* la columna", eso obliga a creer en vez de ver. Se agregó `diagram-2d/scale-context.tsx`: un factor común para todos los números de un diagrama, con el mismo criterio que las matrices, anunciado una vez en la leyenda.
- **Los ceros tapaban lo que importa**: bajo un desplazamiento unitario la mayoría de las barras da cero, y una docena de `0.0000` superpuestos escondía las dos que no. `DeformedDiagram` ganó `showZeroAxialLabels` (en la deformada real siguen: una barra de fuerza cero es un concepto con nombre propio).

`DeformedDiagram` ganó además `scale` y `legend`, porque el default de 50 sirve para desplazamientos de 10⁻³ y acá el desplazamiento **es 1**. Los tres props son aditivos, así que los otros tres sistemas no cambian.

### ✅ D1 ampliado · El error de matriz singular, convertido en lección

Reemplaza al punto que decía "traducir el mensaje de mathjs". Que `Kff` no se pueda invertir **no es un problema numérico**: significa que la estructura es un mecanismo, o sea que puede moverse sin deformarse — y ese es el error más común del principiante. Ahora la app lo dice en castellano, **nombra el nudo y el eje** que quedaron sueltos, y **dibuja el movimiento**: la estructura desplazada sobre la original, sin que ninguna barra cambie de longitud.

**Y apareció un bug de fondo que no tenía nada que ver con el mensaje.** Se armó una armadura sin ningún apoyo horizontal —un mecanismo de manual— y la página **la resolvió igual, sin avisar**: `inv` de mathjs solo tira error si el determinante da exactamente cero, y por redondeo daba 10⁻¹⁰. O sea que devolvía una "inversa" con números enormes y todo el panel de resultados mostraba valores sin sentido, en silencio. Eso estaba pasando en `main` desde siempre.

El diagnóstico terminó con tres controles, y el orden importa:

1. **Filas nulas de `Kff`** — exacto y barato. Es el caso más común: un nudo agregado y no conectado, o uno al que solo llegan barras paralelas.
2. **Número de condición** (`‖K‖·‖K⁻¹‖`) contra un límite de 10¹². Una armadura sana anda en 10²–10⁵; un mecanismo se dispara a 10¹⁶. Es el control que atrapa lo que `inv` deja pasar.
3. El error de `inv`, que sigue ahí para el caso exacto.

**Una idea que parecía obvia y no sirve**, anotada para que nadie la reintente: comprobar que `Kff · Uf` reproduce el término independiente. El error de esa solución vive en la dirección del modo nulo, donde `Kff · u = 0` por definición, así que la ecuación se cumple igual de bien. Se implementó, se probó y no detectaba nada.

El modo de movimiento sale del autovector del autovalor nulo (`eigs` de mathjs, que ya era dependencia), normalizado por su mayor componente para poder dibujarlo tal cual. Si no converge, el diagnóstico sigue con el texto y sin el dibujo.

**Alcanza a los cuatro sistemas**, que era el argumento original de D1: vive en `System.solve()`.

### ✅ Reciprocidad: `k_ij = k_ji`

Tercera idea pedagógica, y la más barata de las cinco. Pasar el mouse por una celda de una matriz simétrica resalta **también su simétrica**: la fuerza que aparece en *i* cuando *j* se desplaza una unidad es la misma que aparece en *j* cuando se desplaza *i*. Es la propiedad que siempre se enuncia y nunca se muestra, y encaja justo debajo del desplazamiento unitario, que es lo que le da sentido.

Está en la matriz global (sección 2) y en `Kff`/`Krr` de la partición. En `Kfr` y `Krf` no: no son cuadradas, así que la celda espejada no existe.

**El estado del resaltado es local al componente, a propósito.** Dónde vive el resaltado transversal —tabla ↔ diagrama, matriz ↔ modelo— es una decisión abierta de N3/N4, y esto no la necesita: meterlo en un átomo ahora sería tomarla de costado.

**El color salió mal la primera vez y lo dijo la medición**, no el ojo: `bg-primary/40` encima del color de zona de la partición quedaba a **8/255** del verde de `Kfr` sin resaltar. Con relleno sólido (`bg-primary` + `text-primary-foreground`) la distancia pasa a 58, del mismo orden que las que separan las cuatro zonas del fondo.

### ✅ Animar la deformada

Cuarta idea. Un botón ▷ al lado del slider lleva la deformación de 0 al valor actual en ~0,9 s. Una deformada quieta se lee como una figura; animada se lee como un movimiento, que es lo que en realidad es. Sirve para la forma deformada y también para el desplazamiento unitario.

Tres cosas de la implementación:

- **El bucle va con `requestAnimationFrame` desde el handler del click**, nunca con `setState` dentro de un `useEffect`: eso es la regla `react-hooks/set-state-in-effect`, y el repo usa "2 errores de lint preexistentes" como referencia de que no hay ninguno nuevo. El único efecto que hay solo cancela el cuadro pendiente al desmontar.
- **Respeta `prefers-reduced-motion`**: quien pidió menos movimiento no quiere una animación, así que salta al valor final.
- **Es lo único de las cinco que no se puede verificar mirando**: headless saca cuadros quietos. El test toma el control de `requestAnimationFrame` en vez de esperar a que corra solo — si no, pasaría igual sin animar, porque la animación empieza y termina en el mismo número.

Y rompió un test ajeno, que vale como aviso: el del desplazamiento unitario buscaba el `svg` del diagrama recorriendo el DOM, y el botón nuevo trae **su propio `svg`** (el icono de lucide). Ahora lo busca por el `viewBox`, que en un diagrama es calculado y en un icono es siempre `0 0 24 24`.

### ✅ Modo práctica («resolvelo vos»)

Quinta y última de las ideas pedagógicas. Un interruptor en la sección 1 convierte dos pasos del método en ejercicios corregidos:

1. **«¿Dónde aporta esta barra?»** — sobre la matriz global vacía, se marcan con clicks las 16 posiciones donde la barra suma algo. Va primero porque es el paso donde más se confunden y porque es de clicks: se puede practicar rápido, que es como conviene ensayar algo que después hay que hacer doce veces seguidas. La corrección **separa faltantes de sobrantes** en vez de dar un puntaje: son dos errores distintos y se corrigen distinto (marcar de menos suele ser olvidarse de los cruces entre los dos nudos; marcar de más, haber tomado filas enteras).
2. **«Completá la matriz de la barra»** — los 16 valores de su `K` en ejes globales. Acepta **expresiones** (`2e7*0.001/3`), que es como el alumno tiene el número mientras lo calcula en vez de copiarlo, y tolera el redondeo con un margen **relativo** del 0,5%: en una matriz donde conviven 6666.6667 y 0 un margen fijo o deja pasar cualquier cosa en las grandes o rechaza redondeos legítimos en las chicas.

**Arranca apagado a propósito**: la página es material de estudio, no un examen. Quien entra a mirar cómo se resuelve una armadura no quiere que le escondan los números.

Los dos ejercicios corrigen contra **lo que calcula el motor** —las posiciones salen del `dofOrder` real y los valores de `TrussElement2D.stiffness()`—, así que no pueden desincronizarse: si cambia la fórmula del motor, cambia el ejercicio.

`MatrixQuiz` es un componente aparte de `MatrixTable` a propósito: esa renderiza texto y ya carga la cascada de decimales, la notación compacta y las etiquetas fijas, y su resaltado por celda ya significa otra cosa (las zonas de la partición).

### ✅ Estabilidad: la sección de teoría y su enganche

Sale de la conversación posterior al diagnóstico del mecanismo: el usuario señaló que **nada de esto se enseña en la cursada** ni estaba en el proyecto original, y pidió una sección que lo explique con un método confiable. El detalle está en la página `/estabilidad`; acá va lo que toca a este sistema.

**Decisión que acotó el alcance**: el usuario eligió **no cambiar el solver del motor**. `System.solve()` sigue invirtiendo `Kff` y comprobando con el número de condición; la factorización `LDLᵀ` vive aparte y solo la usan la página y el bloque nuevo. El costo es que la sección explica un método que la app no usa para resolver, y se paga diciéndolo: la página lo aclara en un recuadro al final. Los 149 tests no se movieron.

**En `/armaduras-2d` quedaron dos enganches**, los dos aditivos:

- **Control de estabilidad en la sección 3**, justo antes de despejar: los pivotes de la `Kff` cargada, con el veredicto ("los 4 son positivos, así que tiene inversa") y el enlace. Va ahí porque es la pregunta que corresponde hacerse **antes** de invertir.
- **Veredicto de Fredholm en el mensaje de mecanismo**: hasta ahora decía que la estructura se puede mover, pero no qué pasa con *esta* carga. Ahora distingue los dos casos, que son muy distintos — si la carga empuja en la dirección del movimiento libre **no hay ningún equilibrio posible** (acelera, y eso ya no es estática); si es ortogonal hay equilibrio en infinitas posiciones y **los esfuerzos igual quedan determinados**. Las dos ramas se verificaron en la app sembrando la armadura sin apoyos horizontales, con carga horizontal y sin ella.

### ✅ U3 · Estado vacío del panel de resultados

**La decisión abierta la tomó el usuario**: mensaje en el lugar de los resultados, no esconder la sección. *"No es adecuado que se muestren unos resultados vacíos, hay que dar feedback adecuado de por qué no se pudo calcular."*

Al abrir el código aparecieron **cuatro estados donde este documento contaba uno**, y dos se veían mal:

| Estado | Cómo se llega | Cómo se veía |
|---|---|---|
| Sin nudos / sin barras | borrar todas las filas de una tabla | `solve()` **no falla**: devolvía un resultado degenerado y se dibujaban las 5 secciones del acordeón con matrices de 0×0 |
| Error de datos | borrar un nudo que una barra referencia | alerta roja arriba, nada debajo de «Resultados» |
| Mecanismo | sacar los apoyos horizontales | explicación completa y dibujo **arriba**, nada debajo de «Resultados» |

**Dónde vive el "por qué", que era la parte a decidir.** El `ErrorsPanel` mezclaba dos cosas de naturaleza distinta y se partió en dos:

- Las **alertas de datos** se atribuyen a una fila, así que se quedan arriba, pegadas a las tablas que hay que corregir.
- El **diagnóstico de mecanismo bajó al panel de resultados** (`results/mechanism-explanation.tsx`): no es un dato mal cargado, es lo que produjo el cálculo — una salida con forma de lección. Y se **filtra** de las alertas (`errors.filter((e) => !e.mechanism)`), donde salía como "Error en un elemento" atribuido a un `refId: "-"` que no existe. Así el motivo se dice **una sola vez**, y en el lugar donde el usuario fue a buscar el número.

**Tres cosas más que conviene saber:**

1. **El estado vacío se decide en el store, no en el componente** (`status: "empty"`, con `reason`), y **antes** de armar el `System`. El orden cambia una respuesta para mejor: un modelo con nudos y sin barras llegaba a `solve()`, la `Kff` salía toda de ceros y el motor lo reportaba —con razón— como **mecanismo**. Es cierto y es rebuscado: ahora dice que faltan las barras.
2. **El título de la sección se mudó de `page.tsx` al panel.** Los controles de decimales y notación compacta **dependen del estado** (formatear números no significa nada sin números) y el título no: la sección nunca desaparece, porque irse entera haría saltar el layout justo mientras el usuario corrige el modelo.
3. **El bloque es genérico** (`custom/no-results.tsx`), como el `ErrorsPanel`: los otros tres sistemas tienen el mismo `return null`. **Solo se cableó `/armaduras-2d`** — propagar es hilo C y hay que preguntar.

**Lo que apareció mirando la captura, quinta sesión seguida**: la sección **«Esquema» tenía exactamente el mismo agujero** un bloque más arriba —el diagrama genérico devuelve `null` sin nudos y quedaba el título solo—. Se tapó con el mismo componente.

**Dos trampas de `ui/empty.tsx`**, que es intocable y hasta hoy no lo usaba nadie:

- **`EmptyTitle` aplica `uppercase`**, la misma familia de trampa que ya costó una vez con KaTeX: nombres de nudo, ejes y símbolos van en la descripción, nunca en el título.
- **`Empty` trae `border-dashed` pero no `border`**: sin agregarlo, el recuadro punteado no se dibuja.

**Medido, no mirado**, en los dos temas: el título rojo queda a 354 (claro) y 277 (oscuro) de distancia RGB del fondo, y la descripción a 242 y 261 — del mismo orden que los colores de zona de la partición, que andan entre 61 y 90. El borde punteado da 42 en oscuro contra los 52 del borde de la caja del esquema: es el mismo token, la diferencia es el antialias de la línea cortada.

Tests: `results-panel.test.tsx`, seis casos que siembran cada estado con **las acciones del store** —`atomNodes` y `atomElements` son derivados de solo lectura, así que el camino que se ejercita es el del usuario—. **155 en total.**

## Pendiente, en orden

### 1 · U1 · Encabezados agrupados en la tabla de nudos ⬅️ **acá se retoma**

Hoy son nueve columnas planas (`node-table.tsx`): "Fuerza X", "Desplaz. X"… El original agrupaba `Coordenadas` / `Fuerza` / `Desplazamiento` / `Restringido` en dos niveles con `colSpan`. Al agrupar la tabla se angosta bastante: revisar en la misma pasada si las dos columnas de restricción siguen como checkbox suelto o se compactan.

### 2 · U2 · Combobox buscable en Desde/Hacia

Hoy es un `Select` plano. `cmdk` ya está en dependencias y `ui/combobox.tsx` y `ui/command.tsx` ya están instalados, así que es directo. Sumar el rechazo de **"Desde = Hacia"**, que hoy solo detecta el motor como longitud cero. Con 4 nudos el `Select` está bien; el problema aparece a los 15.

### 3 · U5 · Unidades rotuladas

Que una app de análisis estructural no diga si un `20000000` es kN/m² o kgf/cm² es lo que un profesor marca. **Alcance decidido: rotular con un sistema fijo y documentado (kN, m, kN/m²)** en encabezados y resultados. Sin estado nuevo. La conversión entre sistemas queda para cuando alguien la pida.

### 4 · N4 · Vincular matriz ↔ modelo

**El de mejor retorno de toda la lista**, y ya tiene sus tres piezas puestas: las etiquetas nudo+eje existen en todas las matrices, `MatrixTable` tiene `cellClass` (lo agregó el P0) y `assembly.steps` ya sabe qué barra tocó qué celdas. Pasar el mouse por una celda de `K` resalta los dos grados de libertad y las barras que aportan ahí. Responde *¿por qué aparece un número en esta celda y no en la de al lado?*, que es lo que no se entiende del método matricial.

### 5 · N5 · Verificación de equilibrio

ΣF = 0 por nudo y global, como cierre de los resultados. Los scripts de regresión ya hacen esta verificación **fuera del repo**; traerla a la UI cierra el recorrido pedagógico. **Decisión abierta**: sección propia del acordeón o cartel de "resultado verificado" arriba.

### 6 · N3 · Vincular tabla ↔ diagrama

Pasar el mouse por una fila resalta el nudo o la barra en el esquema, y al revés. **Decisión abierta**: dónde vive el estado de resaltado (átomo por sistema o contexto local). Es transversal a los cuatro sistemas y a los dos módulos de diagrama, así que conviene definirlo una vez y bien — y N4 va antes justamente para que ese mecanismo ya esté decidido cuando llegue acá.

### 7 · N1 · Persistencia en `localStorage`

Hoy recargar la página pierde todo: es la frustración más común y la más barata de evitar. Es barato por una decisión ya tomada: los átomos guardan **datos planos, nunca instancias del motor**, así que el estado ya es serializable por diseño y no hay que inventar formato. **Lo único a definir es el versionado**, para que un archivo guardado hoy no explote cuando una tabla gane una columna. Descargar/subir JSON y la URL compartible quedan para después.

### 8 · N2 · Ejemplos precargados

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
