import { secureStore } from '../secureStore';
import { PathGuard } from '../services/PathGuard';
import { checkArgs } from '../../src/helpers/invariant';
import { WorkspaceWatcherService } from '../services/WorkspaceWatcherService';

export function registerSettingsHandlers(ipcMain: Electron.IpcMain) {
    ipcMain.handle('get-api-key', () => secureStore.getApiKey('openai'));
    ipcMain.handle('set-api-key', (_event, key: string) => {
        if (!key) {
            secureStore.deleteApiKey('openai');
            return true;
        }
        if (!key.startsWith('sk-')) throw new Error('Invalid API Key format');
        secureStore.setApiKey('openai', key);
        return true;
    });

    ipcMain.handle('get-github-token', () => secureStore.getGitHubToken());
    ipcMain.handle('set-github-token', (_event, token: string) => {
        if (!token) {
            secureStore.deleteGitHubToken();
            return true;
        }
        if (!token.startsWith('ghp_') && !token.startsWith('gho_') && !token.startsWith('ghu_') && !token.startsWith('ghs_') && !token.startsWith('ghr_') && !token.startsWith('github_pat_')) {
            throw new Error('Invalid GitHub token format. Must be a valid Personal Access Token.');
        }
        secureStore.setGitHubToken(token);
        return true;
    });

    ipcMain.handle('get-huggingface-token', () => secureStore.getHuggingFaceToken());
    ipcMain.handle('set-huggingface-token', (_event, token: string) => {
        if (!token) {
            secureStore.deleteHuggingFaceToken();
            return true;
        }
        if (!token.startsWith('hf_')) {
            throw new Error('Invalid Hugging Face token format. Must start with hf_.');
        }
        secureStore.setHuggingFaceToken(token);
        return true;
    });

    ipcMain.handle('get-general-settings', () => {
        return {
            theme: secureStore.getTheme(),
            fontSize: secureStore.getFontSize(),
            activeProvider: secureStore.getActiveProvider(),
            selectedModel: secureStore.getSelectedModel(),
            allowFileRead: secureStore.getAllowFileRead(),
            autoApproveCommands: secureStore.getAutoApproveCommands(),
            systemPromptOverride: secureStore.getSystemPromptOverride(),

            enableLiteLLMProxy: secureStore.getEnableLiteLLMProxy(),
            liteLLMConfigPath: secureStore.getLiteLLMConfigPath(),
            liteLLMModel: secureStore.getLiteLLMModel(),
            liteLLMPort: secureStore.getLiteLLMPort(),

            awsRegion: secureStore.getAwsRegion(),
            vertexProject: secureStore.getVertexProject(),
            vertexLocation: secureStore.getVertexLocation(),
            azureApiBase: secureStore.getAzureApiBase(),
            azureApiVersion: secureStore.getAzureApiVersion(),
            activeWorkspacePath: secureStore.getActiveWorkspacePath()
        };
    });

    ipcMain.handle('save-general-settings', (_, settings) => {
        checkArgs(settings !== null && typeof settings === 'object', 'Settings must be an object');
        if (settings.theme) secureStore.setTheme(settings.theme);
        if (typeof settings.fontSize === 'number') secureStore.setFontSize(settings.fontSize);
        if (settings.activeProvider) secureStore.setActiveProvider(settings.activeProvider);
        if (settings.selectedModel) secureStore.setSelectedModel(settings.selectedModel);
        if (typeof settings.allowFileRead === 'boolean') secureStore.setAllowFileRead(settings.allowFileRead);
        if (typeof settings.autoApproveCommands === 'boolean') secureStore.setAutoApproveCommands(settings.autoApproveCommands);
        if (typeof settings.systemPromptOverride === 'string') secureStore.setSystemPromptOverride(settings.systemPromptOverride);

        if (typeof settings.enableLiteLLMProxy === 'boolean') secureStore.setEnableLiteLLMProxy(settings.enableLiteLLMProxy);
        if (typeof settings.liteLLMConfigPath === 'string') secureStore.setLiteLLMConfigPath(settings.liteLLMConfigPath);
        if (typeof settings.liteLLMModel === 'string') secureStore.setLiteLLMModel(settings.liteLLMModel);
        if (typeof settings.liteLLMPort === 'number') secureStore.setLiteLLMPort(settings.liteLLMPort);

        if (typeof settings.awsRegion === 'string') secureStore.setAwsRegion(settings.awsRegion);
        if (typeof settings.vertexProject === 'string') secureStore.setVertexProject(settings.vertexProject);
        if (typeof settings.vertexLocation === 'string') secureStore.setVertexLocation(settings.vertexLocation);
        if (typeof settings.azureApiBase === 'string') secureStore.setAzureApiBase(settings.azureApiBase);
        if (typeof settings.azureApiVersion === 'string') secureStore.setAzureApiVersion(settings.azureApiVersion);
        if (typeof settings.activeWorkspacePath === 'string') {
            secureStore.setActiveWorkspacePath(settings.activeWorkspacePath);
            if (settings.activeWorkspacePath.trim().length > 0) {
                PathGuard.setWorkspacePath(settings.activeWorkspacePath);
            }
            WorkspaceWatcherService.getInstance().watch(settings.activeWorkspacePath);
        }

        return true;
    });
}
