import { app } from 'electron';
import path from 'path';
import os from 'os';

// Force userData path BEFORE importing database or services
app.setPath('userData', path.join(os.homedir(), 'AppData', 'Roaming', 'smart-cursor-x'));

// Override fetch to log all outgoing requests
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(url, options) {
    console.log('\n>>> FETCH CALL >>>');
    console.log('URL:', url);
    console.log('Method:', options?.method);
    console.log('Headers:', options?.headers ? { ...options.headers, Authorization: options.headers.Authorization ? 'Bearer ' + options.headers.Authorization.substring(0, 15) + '...' : undefined } : null);
    if (options?.body) {
        console.log('Body:', typeof options.body === 'string' ? options.body.substring(0, 1000) : '[Non-string body]');
    }
    console.log('<<< FETCH CALL <<<\n');
    return originalFetch.call(this, url, options);
};

// Now import the rest
import { dbService } from '../electron/db/index';
import { aiService } from '../electron/services/AIService';
import { secureStore } from '../electron/secureStore';

async function run() {
    console.log('App path:', app.getPath('userData'));
    
    // Initialize DB
    await dbService.init();
    
    // Initialize AI Service
    aiService.initializeFromStore();
    
    const selectedModel = secureStore.getSelectedModel();
    const activeProvider = secureStore.getActiveProvider();
    console.log(`Active Provider: ${activeProvider}, Selected Model: ${selectedModel}`);
    
    try {
        console.log('Calling aiService.chat...');
        const response = await aiService.chat([
            { role: 'user', content: 'Say hello and tell me your model name.' }
        ], { model: selectedModel });
        
        console.log('\n--- RESPONSE ---');
        console.log(JSON.stringify(response, null, 2));
    } catch (err) {
        console.error('Error during chat call:', err);
    }
    
    app.quit();
}

app.whenReady().then(run);
