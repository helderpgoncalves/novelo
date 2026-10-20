/**
 * Copia um texto que ainda está a chegar (ex.: o link devolvido pela API) para a área de transferência.
 * O Safari só deixa copiar durante o gesto do utilizador, por isso o `ClipboardItem` recebe a promessa em vez do
 * texto. Sem essa API cai para `writeText` depois de esperar. Devolve `false` se o browser recusar: quem chama
 * mostra o texto para copiar à mão.
 */
export async function copyFromPromise(text: Promise<string>): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const blob = text.then((value) => new Blob([value], { type: 'text/plain' }));
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
      return true;
    }
  } catch {
    // plano B abaixo
  }
  try {
    const value = await text;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
