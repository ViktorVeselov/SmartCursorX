import { secureStore } from '../secureStore';
import { PathGuard } from '../services/PathGuard';
import { checkArgs } from '../../src/helpers/invariant';
import { WorkspaceWatcherService } from '../services/WorkspaceWatcherService';
import { pipelineService } from '../services/PipelineService';
import { pipelineEngine } from '../services/PipelineEngineService';
import { dbService } from '../db/index';
import path from 'node:path';
import type { IpcHandlerContext } from './index';

export function registerSettingsHandlers(ipcMain: Electron.IpcMain, context: IpcHandlerContext) {
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
            activeWorkspacePath: secureStore.getActiveWorkspacePath(),

            embeddingProvider: secureStore.getEmbeddingProvider(),
            embeddingModel: secureStore.getEmbeddingModel(),
            embeddingBaseUrl: secureStore.getEmbeddingBaseUrl(),
            embeddingDimension: secureStore.getEmbeddingDimension(),

            pipelineEnabled: secureStore.getPipelineEnabled()
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

        if (typeof settings.embeddingProvider === 'string') secureStore.setEmbeddingProvider(settings.embeddingProvider);
        if (typeof settings.embeddingModel === 'string') secureStore.setEmbeddingModel(settings.embeddingModel);
        if (typeof settings.embeddingBaseUrl === 'string') secureStore.setEmbeddingBaseUrl(settings.embeddingBaseUrl);
        if (typeof settings.embeddingDimension === 'number') secureStore.setEmbeddingDimension(settings.embeddingDimension);
        if (typeof settings.pipelineEnabled === 'boolean') secureStore.setPipelineEnabled(settings.pipelineEnabled);

        return true;
    });

    ipcMain.handle('embedding:get-config', () => secureStore.getEmbeddingConfig());

    ipcMain.handle('pipeline:get-enabled', () => pipelineService.isEnabled());

    ipcMain.handle('pipeline:set-enabled', (_event, enabled: boolean) => {
        checkArgs(typeof enabled === 'boolean', 'Pipeline enabled must be a boolean');
        pipelineService.setEnabled(enabled);
        return true;
    });

    ipcMain.handle('pipeline:get-config', () => pipelineService.getConfig());

    ipcMain.handle('pipeline:set-config', (_event, config) => {
        checkArgs(config !== null && typeof config === 'object', 'Pipeline config must be an object');
        pipelineService.setConfig(config);
        return true;
    });

    ipcMain.handle('embedding:set-config', (_event, config: { provider: string; model: string; baseUrl?: string }) => {
        checkArgs(config !== null && typeof config === 'object', 'Embedding config must be an object');
        if (typeof config.provider === 'string') secureStore.setEmbeddingProvider(config.provider);
        if (typeof config.model === 'string') secureStore.setEmbeddingModel(config.model);
        if (typeof config.baseUrl === 'string') secureStore.setEmbeddingBaseUrl(config.baseUrl);
        return true;
    });

    ipcMain.handle('pipeline:get-presets', () => {
        return dbService.getPipelinePresets();
    });

    ipcMain.handle('pipeline:save-preset', (_event, name: string, config: object) => {
        checkArgs(typeof name === 'string' && name.length > 0, 'Preset name must be a non-empty string');
        checkArgs(config !== null && typeof config === 'object', 'Config must be an object');
        return dbService.addPipelinePreset(name, config);
    });

    ipcMain.handle('pipeline:load-preset', (_event, id: number) => {
        checkArgs(typeof id === 'number', 'Preset ID must be a number');
        const preset = dbService.getPipelinePreset(id);
        if (!preset) throw new Error(`Pipeline preset ${id} not found`);
        return { ...preset, config: JSON.parse(preset.config) };
    });

    ipcMain.handle('pipeline:delete-preset', (_event, id: number) => {
        checkArgs(typeof id === 'number', 'Preset ID must be a number');
        dbService.deletePipelinePreset(id);
        return true;
    });

    ipcMain.handle('pipeline:engine-steps', () => pipelineEngine.resolveSteps());

    ipcMain.handle('set-workspace-path', (_event, workspacePath: string) => {
        const resolved = path.resolve(workspacePath);
        PathGuard.setWorkspacePath(resolved);
        secureStore.setActiveWorkspacePath(resolved);
        context.workspacePath = resolved;
        WorkspaceWatcherService.getInstance().watch(resolved);
        return true;
    });
}
