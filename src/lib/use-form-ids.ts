import { useId } from "react";

/**
 * Gera ids únicos para os campos de um formulário.
 *
 * O Next mantém as páginas visitadas montadas (escondidas) para preservar o estado. Com ids fixos
 * ("price", "name"...), duas páginas teriam o mesmo id ao mesmo tempo, e o rótulo da tela visível
 * apontaria para o campo da escondida. Com `useId`, cada formulário montado tem os seus.
 *
 * Uso: const id = useFormIds();  →  <Input id={id("price")} />  e  aria-describedby={`${id("price")}-msg`}
 */
export function useFormIds() {
  const base = useId();
  return (name: string) => `${base}${name}`;
}
