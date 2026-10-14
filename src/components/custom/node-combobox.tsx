"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

/**
 * La forma `{ value, label }` es la que el combobox de Base UI reconoce sola:
 * usa `label` para mostrar y filtrar, y `value` para el formulario, sin tener
 * que pasarle `itemToStringLabel`.
 */
export interface NodeOption {
  value: string;
  label: string;
}

/**
 * Elegir un nudo escribiendo, en vez de buscarlo en una lista.
 *
 * Con los 4 nudos de la semilla un desplegable alcanzaba; el problema aparece a
 * los 15, que es cuando encontrar `v12` en una lista es más trabajo que
 * escribirlo.
 *
 * **El nudo del otro extremo va deshabilitado**, que es el rechazo de
 * "Desde = Hacia". Se previene en vez de reportarse: el motor igual lo detecta
 * —tira longitud cero— pero recién después de que el modelo quedó roto, y su
 * mensaje nombra los ids y no los nudos. Ojo con la diferencia: una barra entre
 * **dos** nudos distintos que están en las mismas coordenadas produce el mismo
 * error del motor y **no** es este caso; ese sigue llegando por el panel.
 */
export function NodeCombobox({
  options,
  value,
  excluded,
  label,
  onChange,
}: {
  options: NodeOption[];
  value: string;
  /** El nudo del otro extremo de este mismo elemento. */
  excluded: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(option) => {
        if (option) onChange(option.value);
      }}
    >
      {/*
        `select()` al enfocar, y no es un adorno: el input muestra el nudo
        elegido, y Base UI **no** selecciona ese texto al recibir el foco. Sin
        esto, hacer click y escribir `v3` deja `v2v3` en el input y la lista
        vacía — parece que el control estuviera roto. Lo encontró un test que
        hacía exactamente lo que haría el usuario.
      */}
      <ComboboxInput
        aria-label={label}
        placeholder="Nudo..."
        className="w-32"
        onFocus={(event) => event.currentTarget.select()}
      />
      <ComboboxContent>
        <ComboboxEmpty>Ningún nudo con ese nombre.</ComboboxEmpty>
        <ComboboxList>
          {(option: NodeOption) => (
            <ComboboxItem key={option.value} value={option} disabled={option.value === excluded}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
