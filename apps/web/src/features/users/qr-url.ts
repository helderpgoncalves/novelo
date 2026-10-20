/** Domínio sem protocolo nem caminho: o que se lê em voz alta junto ao QR. */
export const shortHost = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
