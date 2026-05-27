import http from 'http';
import crypto from 'crypto';
import console from 'console';
import { dbService } from '../db';

export interface AdminModelPayload {
    providerId: string;
    modelName: string;
    hasThinking?: boolean;
}

export interface AdminProviderPayload {
    id: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
}

export class AdminApiService {
    private static instance: AdminApiService;
    private server: http.Server | null = null;
    private static adminToken: string | null = null;
    private static readonly PORT = 3003;

    private constructor() {}

    static getInstance(): AdminApiService {
        if (!AdminApiService.instance) {
            AdminApiService.instance = new AdminApiService();
        }
        return AdminApiService.instance;
    }

    static getAdminToken(): string {
        if (!this.adminToken) {
            const envToken = process.env.ADMIN_API_TOKEN;
            if (envToken && envToken.trim().length > 0) {
                this.adminToken = envToken.trim();
            } else {
                this.adminToken = crypto.randomBytes(16).toString('hex');
                console.log(`\n==================================================`);
                console.log(`[AdminApiService] SECURE ADMIN TOKEN GENERATED: ${this.adminToken}`);
                console.log(`[AdminApiService] Provide this token in header: Authorization: Bearer ${this.adminToken}`);
                console.log(`==================================================\n`);
            }
        }
        return this.adminToken;
    }

    start(): void {
        if (this.server) {
            console.log('[AdminApiService] Server is already running');
            return;
        }

        const token = AdminApiService.getAdminToken();
        console.assert(typeof token === 'string' && token.length > 0, 'Admin token must be present');

        this.server = http.createServer((req, res) => {
            // Set CORS Headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            // Authentication filter
            const authHeader = req.headers['authorization'];
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unauthorized: Missing or invalid token' }));
                return;
            }

            const clientToken = authHeader.substring(7).trim();
            if (clientToken !== token) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Forbidden: Invalid token' }));
                return;
            }

            const url = req.url || '';

            // Routing
            if (req.method === 'GET' && url === '/api/admin/models') {
                try {
                    const models = dbService.getCustomModels();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(models));
                } catch (e: any) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            } 
            else if (req.method === 'POST' && url === '/api/admin/models') {
                this.parseJsonBody<AdminModelPayload>(req, res, (body) => {
                    console.assert(typeof body.providerId === 'string' && body.providerId.trim().length > 0, 'providerId must be a valid string');
                    console.assert(typeof body.modelName === 'string' && body.modelName.trim().length > 0, 'modelName must be a valid string');
                    
                    try {
                        dbService.addCustomModel(body.providerId.trim(), body.modelName.trim(), body.hasThinking ? 1 : 0);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: `Model ${body.modelName} registered successfully` }));
                    } catch (e: any) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: e.message }));
                    }
                });
            } 
            else if (req.method === 'DELETE' && url === '/api/admin/models') {
                this.parseJsonBody<{ providerId: string; modelName: string }>(req, res, (body) => {
                    console.assert(typeof body.providerId === 'string', 'providerId must be a string');
                    console.assert(typeof body.modelName === 'string', 'modelName must be a string');
                    
                    try {
                        dbService.deleteCustomModel(body.providerId.trim(), body.modelName.trim());
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: `Model ${body.modelName} removed successfully` }));
                    } catch (e: any) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: e.message }));
                    }
                });
            } 
            else if (req.method === 'GET' && url === '/api/admin/providers') {
                try {
                    const providers = dbService.getCustomProviders();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(providers));
                } catch (e: any) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                }
            } 
            else if (req.method === 'POST' && url === '/api/admin/providers') {
                this.parseJsonBody<AdminProviderPayload>(req, res, (body) => {
                    console.assert(typeof body.id === 'string' && body.id.trim().length > 0, 'id must be a valid string');
                    console.assert(typeof body.name === 'string' && body.name.trim().length > 0, 'name must be a valid string');
                    console.assert(typeof body.baseUrl === 'string' && body.baseUrl.trim().length > 0, 'baseUrl must be a valid string');
                    
                    try {
                        dbService.addCustomProvider(body.id.trim(), body.name.trim(), body.baseUrl.trim(), body.apiKey || '');
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: `Provider ${body.name} registered successfully` }));
                    } catch (e: any) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: e.message }));
                    }
                });
            } 
            else if (req.method === 'DELETE' && url === '/api/admin/providers') {
                this.parseJsonBody<{ id: string }>(req, res, (body) => {
                    console.assert(typeof body.id === 'string', 'id must be a string');
                    
                    try {
                        dbService.deleteCustomProvider(body.id.trim());
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: `Provider ${body.id} removed successfully` }));
                    } catch (e: any) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: e.message }));
                    }
                });
            } 
            else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Endpoint not found' }));
            }
        });

        this.server.listen(AdminApiService.PORT, () => {
            console.log(`[AdminApiService] Listening on http://localhost:${AdminApiService.PORT}`);
        });
    }

    stop(): void {
        if (this.server) {
            console.log('[AdminApiService] Stopping Admin HTTP server...');
            this.server.close();
            this.server = null;
        }
    }

    private parseJsonBody<T>(req: http.IncomingMessage, res: http.ServerResponse, callback: (body: T) => void): void {
        let bodyStr = '';
        req.on('data', chunk => {
            bodyStr += chunk;
        });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(bodyStr) as T;
                callback(parsed);
            } catch (err: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
    }
}

export const adminApiService = AdminApiService.getInstance();
