import fs from 'fs';
import path from 'path';

const logDir = 'logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, 'app.log');

function formatLog(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    if (data) {
        logMessage += ` ${JSON.stringify(data)}`;
    }
    return logMessage;
}

function fileLog(message: string) {
    try {
        fs.appendFileSync(logFile, message + '\n');
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
}

export const logger = {
    info: (message: string, data?: any) => {
        const log = formatLog('INFO', message, data);
        console.log(log);
        fileLog(log);
    },

    error: (message: string | Error, data?: any) => {
        const msg = message instanceof Error ? message.message : message;
        const log = formatLog('ERROR', msg, data);
        console.error(log);
        fileLog(log);
    },

    warn: (message: string, data?: any) => {
        const log = formatLog('WARN', message, data);
        console.warn(log);
        fileLog(log);
    },

    debug: (message: string, data?: any) => {
        const log = formatLog('DEBUG', message, data);
        if (process.env.DEBUG === 'true') {
            console.log(log);
        }
        fileLog(log);
    },
};
