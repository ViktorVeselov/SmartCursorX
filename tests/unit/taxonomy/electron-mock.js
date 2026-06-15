export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: (s) => s,
  decryptString: (s) => s,
};
export const app = {
  getPath: (name) => '.'
};
export class BrowserWindow {
  static getAllWindows() { return []; }
  get webContents() { return { send: () => {} }; }
}
export default {
  safeStorage,
  app,
  BrowserWindow,
};
