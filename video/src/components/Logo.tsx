import { Img, staticFile } from 'remotion';

export function Logo({ height, dark = false, stacked = false }: { height: number; dark?: boolean; stacked?: boolean }) {
  const file = `brand/novelo-logotipo-${stacked ? 'empilhado-' : ''}${dark ? 'negativo' : 'positivo'}.svg`;
  return <Img src={staticFile(file)} style={{ height, width: 'auto', display: 'block' }} />;
}

export function Symbol({ size, dark = false }: { size: number; dark?: boolean }) {
  return <Img src={staticFile(`brand/novelo-simbolo-${dark ? 'negativo' : 'positivo'}.svg`)} style={{ height: size, width: 'auto', display: 'block' }} />;
}
