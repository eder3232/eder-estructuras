/**
 * Por qué el programa no muestra unidades en ningún lado.
 *
 * **No es un olvido: es una decisión, y este bloque existe para que se lea como
 * tal.** El método matricial es dimensionalmente homogéneo, así que la app no
 * necesita saber en qué unidades está trabajando el alumno — y ponerle un
 * sistema fijo sería peor que no decir nada: un encabezado que dice "kN/m²"
 * sobre un dato cargado en kgf/cm² es una afirmación **falsa**, y un rótulo se
 * lee como una afirmación.
 *
 * Lo que sí faltaba era decir la regla, porque hasta acá era implícita. Y de
 * paso enseña lo que el alumno realmente hace mal: el error común no es
 * elegir mal el sistema, es **mezclar**.
 *
 * Es genérico porque la regla vale para los cuatro sistemas. `/frame2d` va a
 * querer sumarle una línea cuando se propague: sus momentos van en fuerza ×
 * longitud y sus giros en radianes, que no siguen la misma correspondencia.
 */
export function UnitsNote() {
  return (
    <div className="max-w-3xl rounded-md border border-dashed p-3 text-sm text-muted-foreground">
      <p className="mb-2">
        <span className="font-medium text-foreground">El programa no tiene unidades, y es a propósito.</span> En
        estructuras se trabaja en muchos sistemas —tonf/cm², kgf/cm², kN/m²— y ninguno es el correcto. Lo que el
        método necesita no es un sistema en particular sino <span className="font-medium">coherencia</span>: elegí
        una unidad de fuerza y una de longitud, usalas en todos los datos, y los resultados salen en esas mismas
        unidades.
      </p>
      <p className="mb-2">
        Si trabajás en <span className="font-medium text-foreground">tonf</span> y{" "}
        <span className="font-medium text-foreground">cm</span>: el módulo <span className="italic">E</span> va en
        tonf/cm², las coordenadas en cm, el área en cm² y las cargas en tonf — y obtenés{" "}
        <span className="font-medium text-foreground">desplazamientos en cm</span> y{" "}
        <span className="font-medium text-foreground">reacciones y fuerzas internas en tonf</span>.
      </p>
      <p>
        El error más común no es equivocarse de sistema: es <span className="font-medium">mezclar</span> —{" "}
        <span className="italic">E</span> en kgf/cm² con las coordenadas en metros, por ejemplo. Eso da resultados
        errados por un factor de 10⁴ y <span className="font-medium text-foreground">el programa no puede
        detectarlo</span>, porque para él son números válidos.
      </p>
    </div>
  );
}
