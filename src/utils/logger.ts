import fs from 'fs';
import path from 'path';

const logDir = 'logs';
fs.mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, 'app.log');

function formatLog(level: string, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    if (data !== undefined) {
        logMessage += ` ${JSON.stringify(data)}`;
    }
    return logMessage;
}

function fileLog(message: string) {
    fs.promises.appendFile(logFile, message + '\n').catch((error) => {
        console.error('Failed to write to log file:', error);
    });
}

export const logger = {
    info: (message: string, data?: unknown) => {
        const log = formatLog('INFO', message, data);
        console.log(log);
        fileLog(log);
    },

    error: (message: string | Error, data?: unknown) => {
        const msg = message instanceof Error ? message.message : message;
        const log = formatLog('ERROR', msg, data);
        console.error(log);
        fileLog(log);
    },

    warn: (message: string, data?: unknown) => {
        const log = formatLog('WARN', message, data);
        console.warn(log);
        fileLog(log);
    },

    debug: (message: string, data?: unknown) => {
        const log = formatLog('DEBUG', message, data);
        if (process.env.DEBUG === 'true') {
            console.log(log);
        }
        fileLog(log);
    },
};
