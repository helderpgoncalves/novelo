import { useVideoConfig } from 'remotion';

/** Formato atual: o mesmo filme em 16:9 e 9:16; as cenas reorganizam-se, os números não mudam. */
export function useLayout() {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  // unidade de tipo: 1 = 1 px em 1920×1080; no vertical o texto cresce um pouco para ler no telemóvel
  const u = portrait ? 1.0 : 1.0;
  return { width, height, portrait, u, pad: portrait ? 84 : 120 };
}
