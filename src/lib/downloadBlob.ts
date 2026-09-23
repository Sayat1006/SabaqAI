export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Бірден босатсақ, кейбір браузерлер файл атын жоғалтады немесе жүктеуді үзеді.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
