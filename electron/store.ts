import Store from 'electron-store';

interface StoreSchema {
  openaiApiKey?: string;
  githubToken?: string; // Securely stored GitHub PAT
  theme?: 'light' | 'dark';
  windowBounds?: {
    width: number;
    height: number;
  };
}

export const store = new Store<StoreSchema>({
  defaults: {
    theme: 'dark'
  },
  // In a real app, use a proper encryption key derived from OS keychain
  encryptionKey: 'cursor-replacer-secure-key'
});
