import type { ReactNode } from "react";

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
 * Es genérico porque la regla vale para los cuatro sistemas; lo que cambia es
 * el ejemplo, porque cada uno tiene datos distintos (un resorte no tiene área
 * ni coordenadas, y su `k` va en fuerza/longitud). Por eso el ejemplo y el
 * error típico entran por props, con los de armaduras como valor por defecto.
 * `/frame2d` va a querer sumarle una línea cuando se propague: sus momentos van
 * en fuerza × longitud y sus giros en radianes.
 */
export function UnitsNote({
  example = ARMADURAS_EXAMPLE,
  mixing = ARMADURAS_MIXING,
}: {
  /** Un sistema coherente aplicado a los datos de este módulo. */
  example?: ReactNode;
  /** El error típico de mezclar, con los datos de este módulo. */
  mixing?: ReactNode;
}) {
  return (
    <div className="max-w-3xl rounded-md border border-dashed p-3 text-sm text-muted-foreground">
      <p className="mb-2">
        <span className="font-medium text-foreground">El programa no tiene unidades, y es a propósito.</span> En
        estructuras se trabaja en muchos sistemas —tonf/cm², kgf/cm², kN/m²— y ninguno es el correcto. Lo que el
        método necesita no es un sistema en particular sino <span className="font-medium">coherencia</span>: elegí
        una unidad de fuerza y una de longitud, usalas en todos los datos, y los resultados salen en esas mismas
        unidades.
      </p>
      <p className="mb-2">{example}</p>
      <p>{mixing}</p>
    </div>
  );
}

const strong = (text: string) => <span className="font-medium text-foreground">{text}</span>;

const ARMADURAS_EXAMPLE = (
  <>
    Si trabajás en {strong("tonf")} y {strong("cm")}: el módulo <span className="italic">E</span> va en tonf/cm², las
    coordenadas en cm, el área en cm² y las cargas en tonf — y obtenés {strong("desplazamientos en cm")} y{" "}
    {strong("reacciones y fuerzas internas en tonf")}.
  </>
);

const ARMADURAS_MIXING = (
  <>
    El error más común no es equivocarse de sistema: es <span className="font-medium">mezclar</span> —{" "}
    <span className="italic">E</span> en kgf/cm² con las coordenadas en metros, por ejemplo. Eso da resultados errados
    por un factor de 10⁴ y {strong("el programa no puede detectarlo")}, porque para él son números válidos.
  </>
);
