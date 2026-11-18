/** Pratos da balança da viatura: a app diz como carregar o prato (≤ 15 kg) e soma as partes por saco.
 *
 * A balança KERN IXC 10K-3M pesa na faixa 6/15 kg (branch `research/hardware-viatura`); um saco que passa
 * desse limite pesa-se em partes e a app soma — o mesmo peso medido que entra em `PUT /lots/{code}/units/{id}`.
 */

/** Limite de um prato, em gramas: a faixa da balança da viatura (hardware, não dado da Vitrus). */
export const PLATE_MAX_G = 15_000;

/** Teto sanidade de um saco: o mesmo do contrato (`weight_g ≤ 30000`; dois pratos cheios). */
export const UNIT_MAX_G = 30_000;

/** Uma leitura acima do prato sobrecarrega a balança: o saco tem de se pesar em partes. */
export function isOverload(readingG: number, maxG: number = PLATE_MAX_G): boolean {
  return readingG > maxG;
}

/** Peso do saco = soma das leituras dos pratos em que foi pesado ([] = ainda sem peso). */
export function unitWeightFromPlates(partsG: number[]): number {
  return partsG.reduce((total, part) => total + part, 0);
}

/** Como carregar o prato para um saco de peso conhecido (ou estimado): 46 800 g → 3 pratos cheios + 1 800 g.
 *
 * Peso desconhecido ou impossível não sugere nada ([]) — o operador pesa e a app acumula.
 */
export function suggestPlateParts(weightG: number, maxG: number = PLATE_MAX_G): number[] {
  if (weightG <= 0) return [];
  if (weightG <= maxG) return [weightG];
  const parts: number[] = [];
  let remaining = weightG;
  while (remaining > maxG) {
    parts.push(maxG);
    remaining -= maxG;
  }
  return [...parts, remaining];
}

/** Total medido do lote: a soma dos sacos que já passaram pela balança (o que «Partir» leva à API). */
export function totalUnitsWeightG(units: Array<{ weightG: number | null }>): number {
  return units.reduce((total, unit) => total + (unit.weightG ?? 0), 0);
}
