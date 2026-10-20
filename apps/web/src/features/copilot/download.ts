/** Descarrega texto ou um Blob como ficheiro, sem sair da página. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadText = (
  filename: string,
  text: string,
  mime = 'text/markdown;charset=utf-8',
) => downloadBlob(filename, new Blob([text], { type: mime }));
