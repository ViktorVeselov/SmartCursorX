export const binaryExtensions = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib',
  '.woff', '.woff2', '.eot', '.ttf', '.mp4', '.mp3', '.wav', '.ogg'
]);

export const isBinaryFile = (filePath: string): boolean => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext ? binaryExtensions.has(`.${ext}`) : false;
};
