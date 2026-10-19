import { getDataQualityQueryKey } from '@/client/@tanstack/react-query.gen';

// Chave da query de qualidade dos dados (gerada pelo hey-api), para invalidar após editar um alerta.
export const listDataQualityKey = () => getDataQualityQueryKey();
