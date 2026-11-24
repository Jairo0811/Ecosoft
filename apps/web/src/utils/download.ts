/**
 * Saves a Blob with the given file name. The anchor is attached to the document (Firefox
 * ignores clicks on detached anchors) and the object URL is revoked only after the browser
 * has picked up the download: revoking it synchronously after `click()` can make Chromium
 * lose the suggested name or cancel the download.
 */
export const saveBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};
