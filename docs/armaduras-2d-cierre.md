# `/armaduras-2d`: la lista de cierre (terminada)

> **Estado: terminada el 2026-08-14.** No queda ningún punto: `/armaduras-2d` está cerrada y **se destraba el hilo C** —propagar a los otros tres sistemas—, que arranca preguntándole al usuario. La lista se **replanificó** el 2026-08-13: eran 8, y el barrido del proyecto v1 sumó tres (**E2**, **M1a**, **M1b**) que cambian el orden de todo lo demás. El porqué del orden está en «Pendiente, en orden».
>
> Hechos y commiteados, en orden: S1, S3, el entorno DOM para tests de componentes, D6 + U4, D10, las matrices que crecen, y —ya en la tanda pedagógica del 2026-08-13— el desplazamiento unitario, D1 (el mecanismo diagnosticado y dibujado), la reciprocidad `k_ij = k_ji`, la animación de la deformada, el modo práctica, la sección de estabilidad, U3, U1, U2, E2, M1a, M1b, U5, N4, N3, N5, N1 y N2. Cada uno tiene su entrada abajo con lo que se decidió y lo que apareció al mirarlo.

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
- **Unidades y su conversión.** La app **no lleva unidades a propósito** (decisión del usuario, 2026-08-13): el método es dimensionalmente homogéneo y un rótulo fijo sería falso para quien trabaje en otro sistema. Lo único que se hizo fue **decir la regla** — ver U5 en «Hecho».

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

### ✅ U1 · Encabezados agrupados en la tabla de nudos

Nueve columnas planas (`Nombre`, `X`, `Z`, `Fuerza X`, `Fuerza Z`, `Desplaz. X`, `Desplaz. Z`, `Restr. X`, `Restr. Z`) pasaron a un encabezado de **dos niveles**: la magnitud arriba con `colSpan={2}` y el eje abajo. Las dos columnas de acciones y la de nombre lo cruzan con `rowSpan={2}`.

**La premisa del punto se confirmó midiendo**, y el resultado fue más grande de lo que decía: a 760 px de ancho, **antes** la tabla se desbordaba —las dos columnas de restricción quedaban directamente fuera de vista y los valores de coordenadas salían cortados a la mitad— y **después entra completa**. La causa es la que se sospechaba: el rótulo largo de cada columna (`Desplaz. X`) le fijaba el piso al ancho, no el dato. Al no repetir la magnitud en cada eje, el piso lo pasa a fijar el número.

Tres cosas que conviene saber antes de tocarlo:

1. **El renglón de grupos no lleva borde inferior** (`border-b-0`): cortaría por la mitad las celdas que lo cruzan con `rowSpan`. El que cierra el encabezado es el renglón de ejes.
2. **El `border-l` de la primera columna de cada grupo baja por todo el cuerpo.** Sin eso la agrupación existe solo en el encabezado y se pierde tres filas más abajo, que es donde hace falta.
3. **Las casillas de restricción ganaron `aria-label`.** Al pasar de "Restr. X" a "X" se quedaban sin nombre accesible: un lector de pantalla leía "X". Ahora dicen `Restringir v3 en x`, y de paso es el asidero que usan los tests.

**Acá es donde entra el grupo `Grado de libertad` de M1b**, con la misma forma, y donde van los rótulos de unidad de **U5** — una vez por magnitud y no una por eje, que es la otra razón para haber agrupado primero.

Tests: `node-table.test.tsx`, la primera cobertura que tiene esta tabla (los tests de tabla que había eran los de barras). Fija la agrupación, el nombre accesible de las casillas y que insertar una fila en el medio caiga donde debe. **158 en total.**

### ✅ U2 · Combobox buscable en Desde/Hacia

El `Select` plano pasó a un combobox donde se escribe para filtrar. Con los 4 nudos de la semilla el desplegable alcanzaba; el problema aparece a los 15, que es cuando encontrar `v12` en una lista es más trabajo que escribirlo.

**Ojo con la dependencia, que este documento tenía mal**: el `ui/combobox.tsx` instalado **no usa `cmdk`**, usa **Base UI 1.7** (`@base-ui/react`), igual que `NumberInput`. `cmdk` está en las dependencias por `ui/command.tsx`, que es otro componente. La API es `items` + `value`/`onValueChange`, y si los items tienen la forma `{ value, label }` **no hace falta pasarle `itemToStringLabel`**: usa `label` para mostrar y filtrar solo. La lista de opciones se arma una sola vez para toda la tabla (`useMemo`) y de ahí sale el valor seleccionado de cada fila, así que la comparación por identidad funciona sin `isItemEqualToValue`.

**El rechazo de «Desde = Hacia» se previene, no se reporta**: el nudo del otro extremo va `disabled` en la lista. El motor lo sigue detectando —tira longitud cero— pero recién cuando el modelo ya quedó roto. Una diferencia que conviene tener presente: una barra entre **dos nudos distintos que están en las mismas coordenadas** produce ese mismo error del motor y **no** es este caso; ese sigue llegando por el panel de errores.

**Y un test encontró un problema de verdad**, haciendo exactamente lo que haría el usuario: **Base UI no selecciona el texto del input al enfocarlo**. Como el input muestra el nudo elegido, hacer click y escribir `v3` dejaba `v2v3` adentro y la lista vacía — el control parecía roto. Se arregla con `onFocus={(e) => e.currentTarget.select()}`, y **hay que acordarse de ponerlo en cada combobox que se agregue**.

Lo que sí funciona solo, y quedó fijado en un test porque es la lección de la v1: escribir cualquier cosa y salir **no deja el input diciendo algo que el modelo no dice** — Base UI lo devuelve al valor seleccionado. Ese es exactamente el bug de `EderInput` que el "debouncer" del original tapaba (ver [`errores.md`](./errores.md)).

**162 tests.**

### ✅ E2 · Canal de advertencias

Hasta acá, todo lo que entraba al panel **bloqueaba**. Ahora hay dos severidades que no se mezclan, y la regla que las separa es la que el proyecto original violaba: **una advertencia nunca puede impedir que se muestre un resultado**. El contrato completo está en [`errores.md`](./errores.md); acá va lo de esta sesión.

**Un error se tira, una advertencia se devuelve.** No es estilo: es lo que hace *imposible* que un aviso corte el cálculo. `SolveResult` gana `warnings`, y viven en `src/lib/engine/warnings.ts`, puras y testeadas aparte. Hoy hay dos:

- **Nudo sin ninguna barra conectada.** Si está libre no llega hasta acá —sus grados de libertad no tienen rigidez, así que el diagnóstico de mecanismo lo rechaza antes y con un mensaje mucho mejor—. Lo que sí llega es el nudo suelto **y restringido**: no rompe nada, pero ocupa dos filas de todas las matrices para no decir nada.
- **Matriz mal condicionada pero resoluble.** El número de condición ya se calculaba para el control de mecanismo, así que esto es gratis: entre 10⁸ (`CONDITION_WARNING`) y 10¹² (`CONDITION_LIMIT`) el cálculo sale pero con la mitad de los dígitos perdidos.

**El motor no nombra la fila en el mensaje**, a propósito: solo conoce ids, y `seed-v5` en pantalla no le dice nada a nadie. La advertencia viaja con `refId` y el adaptador resuelve el nombre. (El mensaje de mecanismo, que es anterior, **sí** mete ids en el texto: es deuda, no ejemplo.)

**Alcanza al motor de los cuatro sistemas** —`System.solve()` las calcula siempre— pero **solo `/armaduras-2d` las muestra**: los otros tres descartan `solved.warnings`. Eso es hilo C.

**Y apareció algo que corrige el método de verificación de este repo.** La variante `warning` del `Alert` existía desde el fork y **nunca la había usado nadie**; al estrenarla, el token `--warning` resultó ilegible en tema claro:

- **Distancia RGB** contra el fondo: **275**, del mismo orden que la del rojo de error (355). Por ese criterio, bien.
- **Razón de contraste WCAG**, que es la métrica que corresponde a *texto*: **2.28:1**, la mitad del 4.5 que pide AA.

La distancia RGB responde *"¿esta zona se distingue de aquella?"* —la pregunta de los bloques de la partición— y no *"¿se puede leer esto?"*. `--warning` pasó a `oklch(0.56 0.15 75)` en claro, que da **4.77**, el mismo contraste que `--destructive`. **Alcanza también a las flechas de reacción** de los tres sistemas con diagrama, que en tema claro estaban a 2.3:1 y ahora están a 4.7:1 — verificado por captura con la sección de la deformada abierta.

**169 tests.**

### ✅ M1a · ¿Los grados de libertad restringidos van arriba?

El primero de los dos checkboxes que tenía el original. **Existe porque cada profesor ensambla a su manera**: unos ponen los restringidos arriba de la matriz global y otros abajo. Matemáticamente da lo mismo, pero al que recién aprende una matriz que no se parece a la del pizarrón lo desorienta, y termina buscando un error que no existe.

**El motor gana la capacidad; la UI va solo acá.** `solve()` acepta `{ restrainedFirst }` con `false` por defecto, así que los otros tres sistemas no cambian ni ven la feature — el mismo criterio con que se hizo D1.

**Salió tan barato como se había medido**, y la razón es de arquitectura: `buildDOFOrder()` es *una sola decisión* de la que cuelga todo lo demás. El ensamblaje usa `byNode`, la partición junta por lista de índices (`gather(k, free, free)`) y la UI se etiqueta con `dofOrder`. Nada supone un orden, así que **el ensamblaje, los pasos, la partición, las ecuaciones de despeje, el diagnóstico de mecanismo, el desplazamiento unitario y el modo práctica no se tocaron**. El original cortaba la matriz por posición, y por eso el mismo cambio le costó duplicar `splitGlobal()` en dos ramas de 30 líneas.

Los dos únicos lugares que sí hubo que tocar, que son los que el análisis ya había anticipado:

1. **`dofOrder` se emite ordenado por `globalIndex`.** Se arma recorriendo los nudos, así que sin un `sort` sale en orden de inserción y **las etiquetas de todas las matrices quedan corridas sin que nada falle**. Hay un test que fija la invariante `dofOrder[i].globalIndex === i` en los dos órdenes.
2. **`results/partition-and-solution.tsx`**, el único lugar de la UI con un orden fijo a mano: los cuatro bloques se acomodan al revés, y con ellos la prosa y la ecuación en KaTeX (`[F_r; F_f] = [K_rr K_rf; K_fr K_ff]·[U_r; U_f]`). Los **nombres** de los bloques no cambian: `Kff` es `Kff` esté donde esté.

**El invariante que hace confiable el cambio** está fijado en `engine/dof-order.test.ts`: con los restringidos arriba, desplazamientos, reacciones y fuerzas internas dan **exactamente lo mismo**. Si cambiaran, no sería un cambio de presentación sino un bug de física — y silencioso, porque los números seguirían pareciendo plausibles.

**Ojo al escribir tests de esto**: en el modelo semilla los dos nudos restringidos ya son los primeros, así que **el toggle no cambia nada visible**. Para verlo hace falta un modelo con los grupos intercalados; los tests arman uno (v4 pasa a restringido, después de sacarle la carga).

El átomo vive en `store/dof-order.ts` y no al lado de `atomDecimals`, por la decisión 2: es parte del modelo, no una preferencia de la app.

**177 tests.**

### ✅ M1b · Numeración del alumno

El segundo checkbox del original. **Existe porque el profesor a veces numera los grados de libertad de una forma rara a propósito**, para ver si el alumno entendió el método — y el alumno quiere cotejar sus matrices contra las de la pantalla término a término.

**Y acá el plan cambió al implementarlo, para mejor.** El plan decía que el número era una *sugerencia*: que la app la respetara solo si los restringidos y los libres quedaban agrupados, y si no la usara como desempate dentro de cada grupo, avisando. Eso era la semántica de v1 — **y es una limitación de v1, no del método**. El original cortaba la matriz **por posición**, así que necesitaba los dos grupos contiguos sí o sí. Acá la partición **junta por lista de índices**, así que no los necesita: el paso de "reordenar para partir" ya existe y se muestra aparte.

Entonces: **si el alumno numeró, el alumno manda.** Se respeta tal cual, aunque mezcle restringidos con libres. Es más fiel al método que lo que hacía v1 —el estudiante ve su matriz global tal como la escribió, y después ve cómo la partición la reordena— y hace desaparecer el caso de "no se pudo respetar".

**El aviso pasó a ser otro, y sigue siendo útil**: cuando la numeración no es una permutación de 1..n (repetidos o saltos). No bloquea —con repetidos igual sale un orden, desempatado por la tabla— pero conviene decirlo, porque el caso de uso es cotejar contra un ejercicio y una numeración mal copiada da matrices que no coinciden por una razón que no se ve.

**Cuatro cosas de implementación:**

1. **Al encender la numeración se siembra con el orden actual** (1, 2, 3…), no con ceros. Con ceros el alumno tendría que tipear los ocho números antes de que la tabla vuelva a tener sentido, y mientras tanto el orden salta en cada tecla.
2. **Las columnas entran en el grupo `Grado de libertad`** que U1 había dejado reservado en el encabezado de dos niveles. Esa era la dependencia `U1 → M1b` del plan, y funcionó: fue agregar un grupo, no rehacer la cabecera.
3. **`atomNodesBase` se exporta** —solo para `dof-order.ts`— porque encender la numeración tiene que poder sembrarla.
4. **Los dos controles interactúan**, y el que se ve tiene que decirlo: con la numeración encendida, «los restringidos van arriba» **deja de decidir el ensamblaje** (manda la numeración) pero sigue eligiendo qué bloque queda arriba al partir. El texto del control cambia para explicarlo, en vez de deshabilitarlo — que sería el clásico "toco esto y no pasa nada".

Tests: el orden que sale es exactamente el pedido **aunque intercale los grupos**, los resultados no cambian al numerar, y el aviso aparece sin bloquear. **182 tests.**

### ✅ U5 · No hay unidades, y es una decisión

**El punto estaba mal planteado y el usuario lo corrigió.** Decía "rotular con un sistema fijo y documentado (kN, m, kN/m²)". Ese alcance **asume que la app debería elegir un sistema**, y contradice el diseño: en estructuras se trabaja en muchos —tonf/cm², kgf/cm², kN/m²— y ninguno es el correcto. El método es dimensionalmente homogéneo, así que la app no necesita saber en cuál está el alumno.

Y un rótulo fijo sería **activamente falso**: un encabezado que dice "kN/m²" sobre un dato cargado en kgf/cm² es una afirmación equivocada, y un rótulo se lee como una afirmación. Peor que no decir nada. La conversión, peor todavía.

**Lo que sí faltaba era decir la regla**, que hasta acá era implícita. `custom/units-note.tsx`, arriba de la página: la coherencia, la correspondencia entrada→salida (la unidad de longitud sale en los desplazamientos; la de fuerza, en reacciones y esfuerzos) y el error que el alumno **sí** comete — no elegir mal el sistema, sino **mezclar**, que da resultados errados por 10⁴ y que el programa no puede detectar.

Es genérico porque la regla vale para los cuatro sistemas, pero se cableó solo acá. **`/frame2d` va a querer sumarle una línea al propagarlo**: sus momentos van en fuerza × longitud y sus giros en radianes, que no siguen la misma correspondencia.

Se descartó, y queda anotado: un campo libre donde el alumno declare sus unidades y la app las repita. Compra un eco y se desactualiza sola — vuelve a ser un rótulo que puede mentir.

### ✅ N4 · Vincular matriz ↔ modelo

Pasar el mouse por una celda de `K` y ver **de dónde sale ese número**: qué barras aportan ahí y cuánto, con el modelo dibujado al lado. Responde *¿por qué aparece un número en esta celda y no en la de al lado?*, que es lo que no se entiende del método matricial.

**La respuesta es topológica, y esa es la parte que enseña**: una barra aporta a `K[i][j]` **si toca los dos nudos**, el de la fila y el de la columna. Por eso los ceros de la matriz global son pares de nudos que ninguna barra conecta — se ve en el dibujo antes que en la cuenta. El cálculo es puro y vive en `engine/cell-contributions.ts`: la topología decide *quién* aporta, y la diferencia entre dos pasos consecutivos del ensamblaje dice *cuánto*.

**Una barra que toca los dos nudos y aporta `0` se muestra igual**, con el cero y una aclaración. Es el caso que más enseña: una barra horizontal no tiene ninguna rigidez en el eje vertical de sus nudos, que es exactamente el mecanismo que el motor diagnostica cuando ya es tarde.

#### La decisión abierta: contexto, no átomo

`custom/highlight.tsx`, y el razonamiento vale para N3 que lo reusa:

El resaltado es **estado efímero de vista** —nace y muere con el mouse—, no del modelo. La regla del repo es que los átomos guardan datos planos del modelo, que es lo que va a permitir que **N1** los serialice sin inventar nada; meter ahí algo que cambia sesenta veces por segundo ensucia esa regla justo antes de que N1 la necesite intacta. Y hay precedente para las dos formas, sin contradicción: la cascada de decimales vive en un átomo **porque el usuario la configura y espera que dure** (y el acordeón desmonta las tablas al cerrarse), mientras que la escala de los diagramas y el resaltado de la celda simétrica son contexto y estado local, porque son de presentación.

El valor por defecto del contexto es inerte, así que un componente que lo lea sin proveedor —los otros tres sistemas, o un test— funciona igual sin resaltar nada. El proveedor envuelve **la página entera** y no solo los resultados, porque N3 va a querer encender el esquema desde las tablas de entrada.

#### Dos cosas que aparecieron al hacerlo

1. **El dibujo va al lado de la matriz, no se reusa el de arriba.** Cuando el mouse está en una celda de la sección 2, el esquema del encabezado quedó a mil píxeles de scroll: un resaltado que no se mira no existe. `SchemaDiagram` ganó `className` y `highlight`.
2. **La captura encontró un bug que el markup no deja ver, otra vez la misma familia.** El primer intento resaltaba con `[&_*]:stroke-primary`, y los nudos salieron como **círculos enormes**: un `stroke` sobre el `circle` se dibuja en unidades del modelo, no en píxeles, porque los nudos nunca tuvieron trazo y no llevan `vector-effect`. Es la tercera vez que esta trampa aparece en el repo (los apoyos, y antes el grosor de las barras). El engrosado va **solo a las `line`**.

Y una duplicación que salió de un test que fallaba por la razón correcta: el párrafo de la reciprocidad **también** empezaba con "Pasá el mouse por una celda de K", así que quedaban dos textos seguidos diciendo lo mismo. La instrucción se dice una sola vez.

**191 tests.**

### ✅ N3 · Vincular tabla ↔ diagrama

La otra mitad de N4, y la que faltaba para que **la tabla y el dibujo dejen de ser dos cosas**: pasar el mouse por una fila enciende su nudo o su barra en el esquema, y pasarlo por el esquema enciende la fila. Una barra prende además **los dos nudos que toca**, que es lo que hace falta para leer una fila que dice «desde v1 hacia v3».

**Salió barato como estaba previsto**, porque N4 ya había tomado la decisión de fondo: el resaltado vive en `custom/highlight.tsx`, un contexto cuyo proveedor envuelve la página entera. Lo que se agregó es `useHighlightRows()`, que **devuelve una fábrica y no los props** — las filas salen de un `.map()`, así que un hook por fila sería un hook dentro de un bucle— y el prop `onHighlight` del diagrama genérico, opcional, así que los otros tres sistemas no cambian.

**La invariante que lo hace legible, y que fijan los tests**: una fila se enciende *exactamente* cuando se enciende su dibujo. Por eso la pertenencia se mira contra la identidad propia de la fila y no contra todo lo que la fila enciende — si no, un nudo prendería en la tabla las barras que lo tocan y en el dibujo no.

**Tres cosas que aparecieron al hacerlo**, dos de ellas en la captura y **séptima sesión seguida** en que la primera captura encuentra algo con los tests, `tsc` y el build ya en verde:

1. **Los apoyos y las flechas no se apagaban con su nudo.** Con la figura al 20% y las flechas azules a plena intensidad, lo más fuerte de la pantalla pasaba a ser justo lo que **no** se estaba señalando. Ahora cada apoyo y cada fuerza se atenúan con el nudo del que son.
2. **El tinte de la fila necesita una opacidad por tema, y lo dijo la medición.** La misma mezcla mide **105** de distancia RGB en claro y **29** en oscuro: el primario está lejos del blanco y a un paso del fondo oscuro. Con `/20` y `/50` quedan **70 y 46**, los dos del orden de los colores de zona de la partición (61 a 90). Es la primera vez en el repo que un color necesita valores distintos por tema para decir lo mismo.
3. **El área sensible de una barra es una línea invisible aparte**, de ~14 px y con `non-scaling-stroke` —una barra mide 1,5 px y es imposible de cazar con el mouse—, y va **fuera** del grupo de la barra: las clases de resaltado bajan a todo `line` descendiente y le pintarían también el área de captura. Los nudos van después, para ganar el mouse en los encuentros.

**Cómo se verificó lo que el mouse no puede mostrar en headless**: sembrando el estado inicial del `HighlightProvider` con un resaltado fijo (`e3` con sus dos nudos), capturando en los dos temas y revirtiendo — la misma técnica de sembrar un modelo distinto que ya se venía usando. Los tests cubren lo otro: las dos direcciones y que el mouse encima de una fila de nudo no encienda ninguna barra. **195 tests.**

### ✅ N5 · Verificación de equilibrio

**La decisión abierta la tomó el usuario**: sección propia del acordeón (la **6**) **y** el veredicto en el título, no una cosa o la otra. El sello contesta *¿puedo confiar en esto?* sin desplegar nada; la tabla —que es lo que enseña— queda adentro.

Las cinco secciones anteriores muestran **cómo se llega** al resultado y ninguna muestra que el resultado **esté bien**. Ahora la última hace la comprobación del pizarrón: nudo por nudo, las barras que llegan tiran, la carga empuja, el apoyo sostiene, y los tres suman cero.

**El cálculo es genérico y vive en el motor** (`engine/equilibrium.ts`, en `SolveResult.equilibrium`): pide `stiffness()` y los desplazamientos, que es lo que declara la interfaz `Element`, así que **el día que se propague no hay motor que tocar**. Un test lo corre con un sistema de 1 DOF por nudo para fijarlo. Es el mismo criterio de D1, E2 y M1a: la capacidad va al motor con el comportamiento de hoy, la UI va solo acá.

**Por qué no es una tautología**, que es la objeción obvia —`K·U = F` es la ecuación que se resolvió—: el camino de vuelta es otro. Se rearman las fuerzas desde la rigidez de **cada barra**, sin pasar por la matriz global ni por la partición, así que atrapa un error de ensamblaje, de mapeo de grados de libertad o de signo al partir. Lo que **no** puede ver es un error adentro de `stiffness()`: esa misma rigidez se usa de los dos lados.

**Tres decisiones de presentación:**

1. **La celda del residuo dice `≈ 0`, no `0.0000`.** Con 4 decimales las diez celdas mostrarían un cero que no se distingue de un cero de verdad ni de un error tapado por el redondeo. El número honesto —el mayor residuo, en exponencial, contra la escala de las fuerzas— se dice **una vez**, abajo: `2.7e-15` contra fuerzas del orden de 12.4.
2. **El residuo se juzga relativo**, no contra un umbral fijo: 10⁻⁶ es ruido en una estructura cargada con toneladas y un error grosero en una cargada con gramos.
3. **La fila del total no tiene columna de barras**, y esa ausencia es la lección: cada barra tira de sus dos nudos con fuerzas iguales y opuestas, así que en la suma de toda la estructura se cancelan de a pares y queda lo que entra y sale del sistema.

**Y si no cerrara, el texto lo dice: no es un problema del modelo del usuario, es un bug de la app.** Por eso no entra por el canal de errores ni por el de advertencias de E2, que son de dominio.

**Lo que encontró la captura** (octava sesión seguida):

- **El sello medía 2.78:1 en oscuro.** `text-primary` sobre el fondo oscuro es la misma trampa que el token `--warning` en E2: distancia RGB decente, contraste de texto por la mitad de lo que pide WCAG. Pasó a sello **relleno** (`bg-primary` + `text-primary-foreground`), que mide **6.8:1 en oscuro y 4.7:1 en claro**; la variante de error, **6.9 y 4.8**.
- **La raya que separa el total no se dibujaba.** `TableBody` lleva `[&_tr:last-child]:border-0`, que es un descendiente y le gana por especificidad a cualquier `border-t-2` puesto en el `tr`: la raya va **en las celdas**. Y es una raya y no un fondo porque `bg-muted/30` medía **5/255** contra el blanco — en esta paleta `--muted` está pegado al fondo. Con la raya, 72 de distancia contra el borde normal, igual en los dos temas.

Tests: cinco de motor (que cierra, que las barras se cancelan de a pares, que el nudo cargado recibe la carga cambiada de signo, que un desplazamiento falseado **rompe** el control —si no, no estaría comprobando nada— y que sirve para 1 DOF por nudo) y cuatro de UI. **204 tests.**

### ✅ N1 · Persistencia en `localStorage`

Recargar la página ya no pierde nada. Salió barato por una decisión vieja: los átomos guardan **datos planos, nunca instancias del motor**, así que el estado ya era serializable por diseño.

**Las decisiones del usuario**, que son las que no se deducen del código:

1. **El reset vuelve al ejemplo inicial, no vacía.** Una página en blanco no le enseña nada a nadie, y borrar las filas a mano ya se puede.
2. **Con «Deshacer», no con un diálogo de confirmación.** Un diálogo frena al que sabe lo que quiere y no salva más que el undo, que salva también al que se dio cuenta tres segundos después. El estado anterior viaja en el cierre del toast — y es **el mismo mecanismo que va a necesitar N2** para cargar un ejemplo encima de lo que el usuario tenía.
3. **Se espera a leer lo guardado antes de dibujar** (la decisión que se ve). El modelo vive en `localStorage`, que en el servidor no existe, así que el HTML prerrenderizado no puede tenerlo: si las tablas se dibujaran igual, el alumno vería el ejemplo inicial un instante y después el suyo, que se lee como *se perdió mi trabajo*. Se reserva el espacio con alturas **medidas sobre el modelo semilla**.
4. **Chrome únicamente.** No hay `try/catch` defensivo alrededor del almacenamiento: el único escenario real ahí es que el usuario bloquee los datos del sitio.

**El versionado, que era la decisión abierta**: la versión va **adentro del payload** (`{ v: 1, data }`) y no en la clave. Con la versión en la clave, un modelo viejo queda huérfano y nadie se entera; adentro hay que mirarlo y decidir. Ante versión desconocida —vieja **o más nueva que este código**, que pasa con otra pestaña abierta—, JSON roto o forma inválida: se descarta, se arranca con el ejemplo inicial y **se avisa**. La guarda de forma se escribió a mano: son dos arrays de campos planos y una dependencia de validación no se paga sola. **Un solo campo mal descarta el modelo entero**, a propósito: un modelo a medio validar produce matrices con `NaN` que el alumno no puede corregir porque no las causó él.

**Tres cosas de implementación que conviene saber antes de propagarlo:**

1. **Lo guardado se lee al evaluarse el módulo**, no en un efecto, y de ahí salen los valores iniciales de los átomos. Leerlo en un efecto obligaría a *setear* estado después del primer render — la regla `react-hooks/set-state-in-effect`, que el repo usa como señal de regresión.
2. **`useHydrated()` va con `useSyncExternalStore`** (`src/hooks/use-hydrated.ts`) y no con el `useState` + `useEffect` de "mounted", por lo mismo. React hace el segundo render solo, sin estado de por medio, y el lint sigue en 2.
3. **Escribir sí es un efecto, y está bien**: sincronizar con un sistema externo es para lo que existen. Se observa un átomo derivado con el modelo entero en vez de agregarle un `saveModel()` a cada una de la docena de acciones del store — esa es una lista que alguien iba a olvidar de actualizar. **Sin debounce**: son un par de kB, `localStorage` es síncrono, y el "debouncer" de v1 ya enseñó lo suyo (ver [`errores.md`](./errores.md)).

**Lo que quedó afuera a propósito**: los decimales, la notación compacta y el modo práctica. Son preferencias, valen para los cuatro sistemas a la vez y por lo tanto son **otra clave con su propio versionado**; un test fija que no se cuelen en la del modelo. Descargar/subir JSON y la URL compartible siguen para después.

**Lo que encontró la captura, y es otra vez el mismo tipo de hallazgo**: el `Toaster` **nunca se había usado en este repo** —igual que la variante `warning` del `Alert` en E2— y al estrenarlo aparecieron dos cosas. El toast salía en **sans-serif** mientras toda la app es monoespaciada (`sonner` trae su propia familia en el CSS que inyecta; se alinea desde `layout.tsx`, sin tocar `ui/`), y con la tipografía ya en mono **la descripción chocaba con el botón «Deshacer»** — se sacó la descripción de ese toast: el título ya lo dice y el botón dice el resto.

**Y una corrección al método de verificación del repo**, que vale más que el hallazgo: **`forcedTheme` no sirve para capturar nada que involucre al `Toaster`**. `ui/sonner.tsx` le pasa a `sonner` el `theme` de next-themes —la *preferencia*, no el tema resuelto—, así que con `forcedTheme="light"` la app queda clara y el toast se pinta oscuro: la descripción medía **1.23:1**. Con el tema elegido como lo hace un usuario (`defaultTheme="light"`, sin `enableSystem`) la misma descripción mide **10.53:1**, y en oscuro **14.63:1**. El número alarmante era del método, no de la app.

**Cómo se probó el viaje de ida y vuelta en Chrome de verdad**, que headless no puede tipear: `--user-data-dir` **persiste el `localStorage` entre corridas**. Se carga la página una vez con un perfil nuevo (que guarda), se **cambia la semilla en el código**, y se vuelve a cargar con el mismo perfil: sale `v1` —lo guardado— y no la semilla nueva, mientras que un perfil limpio sí muestra la semilla nueva. Es la técnica para verificar persistencia sin poder interactuar.

Tests: seis del sobre genérico (`lib/persistence.test.ts`), nueve del modelo —la guarda, el reset con su vuelta atrás, y que **los átomos arrancan con lo guardado**, que se prueba recargando el módulo con `vi.resetModules()`— y cuatro de UI, incluido el «Deshacer» pasando por el toast de verdad. **223 tests.**

### ✅ N2 · Ejemplos precargados

Tres armaduras elegibles de un menú, y **ninguna está por ser otra armadura**: cada una existe para mostrar algo que las demás no muestran. Una lista de estructuras cualesquiera no enseñaría nada que el ejemplo inicial no enseñe ya.

| Ejemplo | Para qué está |
|---|---|
| **Triángulo isostático** (3 barras) | Los esfuerzos salen del equilibrio y **no dependen del área ni del material** — un test lo fija multiplicando los dos por 3 y por 7 y comprobando que los axiales no se mueven. El ejemplo inicial, hiperestático, no puede mostrarlo. |
| **Cercha con los apoyos en el medio** (7 barras) | Los nudos restringidos caen en el **medio de la tabla**, así que ahí se ve qué hace el interruptor de M1a. Con el ejemplo inicial no se nota nada, porque sus apoyos ya son las dos primeras filas. |
| **Apoyo del medio que cede 5 mm** | El único que usa el **desplazamiento prescrito** (`Ur ≠ 0`), la rama que el motor resuelve desde el Tren 1 y que ninguna pantalla ejercitaba. Sin una sola carga aplicada, la estructura queda tensionada. |

**El mecanismo ya estaba**: cargar un ejemplo pisa lo que había, y eso es exactamente lo que resolvió N1. `atomReplaceModel` devuelve lo anterior y el aviso lleva el «Deshacer» adentro — la misma función para el reset y para los ejemplos, escrita una vez. **Es un menú y no un `Select`** porque un desplegable de selección afirma "el valor actual es este", y acá no hay valor actual: apenas se carga, el alumno lo edita y deja de serlo.

**Dos cosas que aparecieron al armar los ejemplos, y las dos cambian lo que uno creía:**

1. **La primera versión del asentamiento daba cero en las seis barras.** Era el cuadro arriostrado del ejemplo inicial con el apoyo derecho descendido: ese descenso resulta **compatible con un campo de desplazamientos que no alarga ninguna barra**, así que la estructura acompaña sin tensionarse. O sea que *hiperestática + asentamiento* **no** implica esfuerzos — hace falta que el descenso sea incompatible con todo movimiento sin deformación, y eso lo consigue el apoyo del medio de un tramo continuo. La geometría final es la clásica, y ahora es la única que este repo tiene probada.
2. **Un ejemplo que no resuelve es peor que no tenerlo**, así que los tres pasan por el motor en los tests: resuelven, **cierran en equilibrio** (se reusa N5 como control, en vez de escribir a mano los valores esperados de cada uno) y no arrastran advertencias.

**Lo que encontró la captura** (novena sesión seguida), y esta vez fueron tres:

- **El menú salía todo en MAYÚSCULAS.** `DropdownMenuItem` aplica `uppercase`, que está bien para el nombre y hace ilegible una oración de dos renglones. **Tercera vez** que un `uppercase` de `ui/` aparece donde no corresponde (antes: `EmptyTitle` y los símbolos de KaTeX).
- **Y salía angosto**: `DropdownMenuContent` fija el ancho **al del disparador** (`w-(--radix-dropdown-menu-trigger-width)`), así que cada descripción se partía en cinco renglones. Un `max-w-*` no alcanza — hay que pisar el `w-`.
- **En la cercha, el nombre de la diagonal se escribía encima del valor de la carga.** Y ahí apareció que **el esquema seguía colocando los nombres de barra con la regla que D6 descartó** —corrimiento fijo hacia arriba— mientras la forma deformada ya usaba `axialLabelPoint` (al 25% y hacia afuera de la figura). Ahora el esquema usa la misma función: alcanza a los cuatro sistemas, y se verificó el ejemplo inicial y `/frame2d`. Aun así **las etiquetas de nudo y de barra no se conocen entre sí** —el halo las hace legibles, no las separa—, así que en la cercha la carga se colgó del cordón inferior, donde no hay con qué chocar.

Tests: siete de los ejemplos y dos de UI (cargar uno lo trae entero y se puede deshacer; y **cargarlo dos veces da lo mismo**, que es lo que fija que el store no quede apuntando a los objetos del módulo). **232 tests.**

## Pendiente: nada

**La lista está terminada** (2026-08-14). Quedaron afuera, con su porqué, los puntos de «Lo que quedó explícitamente afuera» de más arriba: **D9**, el resto del **grupo M**, **S2** y **N6**.

Las dependencias que ordenaron el trabajo, por si sirven de molde para el próximo sistema:

- `E2 → M1b` — sin canal de advertencias, M1b queda muda justo en el caso que más enseña.
- `M1a → M1b` — los dos son entradas de la misma función de orden.
- `U1 → M1b` — entrar a una cabecera ya agrupada es sumar un grupo; entrar a once columnas planas es rehacerla.
- `{U1, M1b} → U5` — rotular recién cuando ninguna columna se vaya a mover más.
- `M1b → N1` — la más importante: M1b cambió la forma de `NodeRow`, y escribir el formato persistido antes obligaba a migrarlo enseguida.
- `N4 → N3` — N4 decidió dónde vive el estado de resaltado; N3 lo reusó.
- `N1 → N2` — cargar un ejemplo pisa lo que el usuario tenía, y el «Deshacer» salió de N1.

## Cómo verificar

Las reglas generales están en la [sección 5 del roadmap](./refactor-roadmap.md#5-estado-de-verificación-lo-que-está-probado-y-lo-que-no). Lo específico de esta tanda:

- `pnpm test` · `npx tsc --noEmit` · `pnpm build`. **`pnpm lint` da 2 errores preexistentes en `ui/`**; un tercero sí es nuevo.
- **Mirar la app no es opcional.** Van **diez** sesiones seguidas en que la primera captura encontró algo con los tests, `tsc` y el build ya en verde.
- **Para verificar algo que solo existe con el mouse encima** —N4, N3— hay que sembrar el estado: darle al `useState` del `HighlightProvider` un valor inicial fijo, capturar y **revertir**. Es la misma técnica de sembrar un modelo distinto, aplicada al estado de vista.
- **Y los tests tampoco.** En esta última tanda un test encontró lo que la captura no podía —que Base UI no selecciona el texto del input al enfocarlo, y headless no puede tipear— igual que la captura encontró lo que el test no podía. Las dos verificaciones son complementarias.
- **Para juzgar un texto, la métrica es la razón de contraste WCAG (4.5 para texto normal), no la distancia RGB.** La distancia sirve para "¿esta zona se distingue de aquella?", que es la pregunta de los bloques de la partición. El token `--warning` medía 275 de distancia —parecía bien— y 2.28:1 de contraste, que es la mitad de lo que hace falta.
- **El dev server puede estar ya levantado** en el 3000 sirviendo este mismo repo: usalo, no lo mates.

**Para capturar una sección del acordeón que arranca cerrada**, tocar `defaultValue` del `<Accordion>` en `results-panel.tsx` (hoy `["dof"]`), capturar y **revertir**. Conviene abrir *solo* la sección de interés: así queda arriba y se recorta sin buscarla en una captura de 16000 px.

**Para capturar un tema concreto**, agregarle `forcedTheme="light"` o `"dark"` al `<ThemeProvider>` de `layout.tsx`, capturar y revertir. Sin eso, headless resuelve `prefers-color-scheme` por su cuenta.

> **Excepción, encontrada en N1: `forcedTheme` no sirve si en la captura hay un toast.** `ui/sonner.tsx` le pasa a `sonner` el `theme` de next-themes —la *preferencia*, no el tema resuelto—, así que la app queda clara y el toast se pinta oscuro. Para eso hay que forzarlo como lo haría un usuario: `defaultTheme="light"` **sin** `enableSystem`.

**Para verificar persistencia sin poder interactuar**: `--user-data-dir` **guarda el `localStorage` entre corridas**. Se carga una vez con un perfil nuevo, se cambia la semilla en el código, y se vuelve a cargar con el mismo perfil — si sale lo guardado y no la semilla nueva, el camino funciona de punta a punta.

**Para juzgar un color, medirlo.** El ojo se equivoca sobre una captura —ya pasó con `Kff`—. La moda de color de una zona contra el fondo, con PIL:

```python
from collections import Counter
from PIL import Image
px = Image.open('captura.png').convert('RGB').load()
c = Counter(px[x, y] for y in range(y0, y1, 2) for x in range(x0, x1, 2))
color = c.most_common(1)[0][0]   # comparar contra la moda del fondo
```

## Terminada: qué se destraba, y con qué cuidado

Se destraba el **hilo C** del roadmap: propagar a `/springs`, `/frame2d` y `/armaduras-3d`. Va a ser grande. Y sigue en pie la condición que el usuario puso desde el principio: **preguntarle antes de propagar**, porque nunca dio el visto bueno al conjunto de la UI, solo a los arreglos puntuales que fue encontrando.

**Qué hay para propagar**, que es lo que esta lista fue acumulando: insertar una fila en el medio, la cascada de decimales, la narrativa pedagógica entera (D7 + D8 + D11), el estado vacío (U3), los encabezados agrupados (U1), el combobox buscable (U2), las advertencias (E2), los dos interruptores de orden de grados de libertad (M1a/M1b), la nota de unidades (U5), el vínculo matriz ↔ modelo y tabla ↔ dibujo (N4/N3), la verificación de equilibrio (N5), la persistencia con reset y «Deshacer» (N1) y los ejemplos precargados (N2).

**La buena noticia es que casi nada de eso pide tocar el motor.** La política fue la misma en todos: la capacidad va al motor con el comportamiento de hoy por defecto, la UI va solo en `/armaduras-2d`. Así que `restrainedFirst`, `useDofNumbers`, `warnings` y `equilibrium` ya están disponibles para los cuatro sistemas y apagados; propagar es cablear UI.

**Y tres cosas ya llegaron solas** a los otros sistemas, porque viven en módulos compartidos: el diagnóstico de mecanismo (`System.solve()`), los arreglos de etiquetas de los diagramas —incluido el de esta última sesión, que puso los nombres de barra donde D6 mandaba— y el token `--warning` corregido.
