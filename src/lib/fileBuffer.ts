/**
 * Read a picked file fully into memory immediately. Android revokes the
 * temporary content URI behind a `File` after any `await` gap — while a dialog
 * is open, or between two sequential uploads — which makes the upload fail.
 * Materialising the bytes right away, before any other await, keeps the file
 * readable. Call `arr.map(bufferFile)` synchronously on selection (no await
 * before the map) so every read starts while the URIs are still valid.
 */
export async function bufferFile(file: File): Promise<File> {
  const buf = await file.arrayBuffer();
  return new File([buf], file.name, { type: file.type, lastModified: file.lastModified });
}
