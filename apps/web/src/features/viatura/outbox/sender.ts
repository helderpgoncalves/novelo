/** O lado da API da fila: a porta `OutboxSender` cumprida com o cliente gerado (nunca `fetch` à mão).
 *
 * Erros classificados para o despejo (`flush.ts`): 409 no saco = já lá está (conflict → reconcilia pelo código);
 * rede abaixo / 5xx = retryable (a fila fica intacta); resto 4xx = definitivo (o operador vê o motivo).
 */

import type { LotDetail, LotUnitOut } from '@/client';
import {
  addLotUnit,
  closeStopLot,
  deleteLotUnit,
  getLot,
  openStopLot,
  setLotUnitWeight,
} from '@/client';
import { type OutboxSender, SenderError } from './flush';

function fail(response: Response | undefined, context: string): SenderError {
  const status = response?.status ?? 0;
  if (status === 409) return new SenderError(context, { conflict: true });
  if (status >= 500 || status === 0) {
    return new SenderError('Sem resposta da API', { retryable: true });
  }
  return new SenderError(context, { retryable: false });
}

async function unitIdByCode(lotCode: string, code: string): Promise<string | null> {
  const { data, error } = await getLot({ path: { code: lotCode }, throwOnError: false });
  if (error || !data) return null;
  const detail = data as LotDetail;
  const found = (detail.unit_list ?? []).find((unit: LotUnitOut) => unit.code === code);
  return found?.id ?? null;
}

export const apiSender: OutboxSender = {
  async openStop({ localityId, parishCode }) {
    const { data, error, response } = await openStopLot({
      body: { locality_id: localityId, parish_code: parishCode ?? undefined },
      throwOnError: false,
    });
    if (error || !data) throw fail(response, 'A API recusou abrir a paragem');
    return { lotCode: data.code };
  },

  async addUnit({ lotCode, code, source }) {
    const body = source === 'bag' ? { bag_code: code } : { label_code: code };
    const { data, error, response } = await addLotUnit({
      path: { code: lotCode },
      body,
      throwOnError: false,
    });
    if (error || !data) throw fail(response, 'A API recusou o saco');
    return { unitId: data.id };
  },

  async setWeight({ lotCode, unitId, weightG }) {
    const { error, response } = await setLotUnitWeight({
      path: { code: lotCode, unit_id: unitId },
      body: { weight_g: weightG },
      throwOnError: false,
    });
    if (error) throw fail(response, 'A API recusou o peso');
  },

  async removeUnit({ lotCode, unitId }) {
    const { error, response } = await deleteLotUnit({
      path: { code: lotCode, unit_id: unitId },
      throwOnError: false,
    });
    if (error) throw fail(response, 'A API recusou retirar o saco');
  },

  async departure({ lotCode }) {
    const { error, response } = await closeStopLot({
      path: { code: lotCode },
      throwOnError: false,
    });
    if (error) throw fail(response, 'A API recusou o «Partir»');
  },

  findUnitId: (lotCode, code) => unitIdByCode(lotCode, code),
};
