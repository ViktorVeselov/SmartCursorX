export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: (s) => s,
  decryptString: (s) => s,
};
export const app = {
  getPath: (name) => '.'
};
export default {
  safeStorage,
  app
};
