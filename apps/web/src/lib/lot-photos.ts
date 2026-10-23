import type { GarmentType, LotState } from '@/client';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { garmentLabel } from '@/lib/lots';
import { m } from '@/paraglide/messages';

/** Limite do crédito (igual ao da API: `Form(max_length=240)`). */
export const CREDIT_MAX = 240;

/** O que o operador escolheu sobre a fotografia da peça. Desmarcado por omissão: guardar é sempre opcional. */
export interface PhotoChoice {
  save: boolean;
  confirmed: boolean;
  credit: string;
}

export const NO_PHOTO_CHOICE: PhotoChoice = { save: false, confirmed: false, credit: '' };

/** Texto simples numa só linha: espaços repetidos colapsam (a API faz o mesmo) e vazio é «sem crédito». */
export const normaliseCredit = (raw: string): string | null => {
  const text = raw.split(/\s+/).filter(Boolean).join(' ');
  return text === '' ? null : text;
};

export type CreditProblem = 'html' | 'too_long';

/** O que impediria a API de aceitar o crédito (validamos antes para o erro aparecer junto ao campo). */
export const creditProblem = (raw: string): CreditProblem | null => {
  const text = normaliseCredit(raw);
  if (text === null) return null;
  if (/[<>]/.test(text)) return 'html';
  return text.length > CREDIT_MAX ? 'too_long' : null;
};

/** Pode confirmar a peça? Se pediu a fotografia, tem de ter dado o consentimento e o crédito tem de ser válido. */
export const photoChoiceReady = (choice: PhotoChoice): boolean =>
  !choice.save || (choice.confirmed && creditProblem(choice.credit) === null);

export interface PhotoRequest {
  file: File;
  credit: string | null;
}

/** O pedido de gravação, ou `null` quando não há nada a guardar (não escolheu, sem consentimento ou sem ficheiro). */
export const photoRequestFrom = (choice: PhotoChoice, file: File | null): PhotoRequest | null =>
  choice.save && choice.confirmed && file && photoChoiceReady(choice)
    ? { file, credit: normaliseCredit(choice.credit) }
    : null;

/** Acrescentar/substituir só enquanto o lote não foi entregue; apagar é sempre permitido (direito ao apagamento). */
export const canChangePhotos = (state: LotState): boolean => state !== 'delivered';

export const photoActionFor = (hasPhoto: boolean, state: LotState): 'add' | 'replace' | null =>
  canChangePhotos(state) ? (hasPhoto ? 'replace' : 'add') : null;

/** Texto alternativo da miniatura: tipo de peça e, quando há, a marca. */
export const photoAlt = (garment: GarmentType, brand: string | null): string =>
  brand
    ? m.lotphoto_alt_brand({ garment: garmentLabel[garment](), brand })
    : m.lotphoto_alt({ garment: garmentLabel[garment]() });

/** Legenda do crédito, ou `null` quando a foto é própria (sem atribuição). */
export const formatPhotoCredit = (credit: string | null | undefined): string | null => {
  const text = normaliseCredit(credit ?? '');
  return text === null ? null : m.lotphoto_credit_caption({ credit: text });
};

/** Mensagem para um erro ao guardar/apagar a fotografia: o 409 é «lote entregue»; o resto segue o mapa geral. */
export const photoErrorMessage = (error: unknown): string =>
  getErrorCode(error) === 'conflict' ? m.lotphoto_error_delivered() : getErrorMessage(error);
