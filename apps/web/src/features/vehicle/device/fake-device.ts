/** O falso da porta do dispositivo: pesos programados e etiquetas «impressas» registadas.
 *
 * É o dobro do falso do OSRM/RoadRouter nos testes da API: o ecrã da paragem testa-se contra ele
 * (pesos programados, etiquetas registadas) e o Web Bluetooth prova-se à mão em Android + Chrome.
 * Em dev é também a balança de demonstração; os pesos do dia entram por `programG`.
 */
import type { LabelJob, VehicleDevice } from './port';

export interface FakeDevice extends VehicleDevice {
  /** Etiquetas «impressas», pela ordem — as afirmações dos testes passam por aqui. */
  readonly printed: LabelJob[];
  /** Pesos que a balança ainda vai ler (FIFO; esgotado, lê `null`). */
  readonly program: readonly number[];
}

export function createFakeDevice(programG: number[] = []): FakeDevice {
  const program = [...programG];
  const printed: LabelJob[] = [];
  return {
    fingerprint: 'demo (falso)',
    program,
    printed,
    async weigh() {
      const grams = program.shift();
      return grams === undefined ? null : grams;
    },
    async printLabel(label: LabelJob) {
      printed.push(label);
      return true;
    },
    async release() {
      program.length = 0;
    },
  };
}
