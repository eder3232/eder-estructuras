/** Un número para una fórmula: con `decimals` decimales y sin «−0». */
export function num(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  return Number(fixed) === 0 ? (0).toFixed(decimals) : fixed;
}
