import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import console from 'console';

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const LOG_FILE = 'audit.log';

class AuditLogger {
    private logPath = '';

    private ensurePath(): string {
        if (!this.logPath) {
            const logDir = path.join(app.getPath('userData'), 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            this.logPath = path.join(logDir, LOG_FILE);
        }
        return this.logPath;
    }

    private rotateIfNeeded(): void {
        const logPath = this.ensurePath();
        try {
            if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_LOG_SIZE) {
                const rotated = logPath + '.1';
                if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
                fs.renameSync(logPath, rotated);
            }
        } catch (e) {
            console.error('[AuditLogger] Rotation failed:', e);
        }
    }

    log(channel: string, args: unknown[]): void {
        try {
            this.rotateIfNeeded();
            const timestamp = new Date().toISOString();
            const safeArgs = args.map(a => {
                if (typeof a === 'string' && a.length > 100) return a.substring(0, 100) + '...';
                return a;
            });
            const line = `[${timestamp}] ${channel} ${JSON.stringify(safeArgs)}\n`;
            const logPath = this.ensurePath();
            fs.appendFileSync(logPath, line, 'utf-8');
        } catch (e) {
            console.error('[AuditLogger] Write failed:', e);
        }
    }
}

export const auditLogger = new AuditLogger();
