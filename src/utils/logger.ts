import pino, { Logger } from 'pino';
import { existsSync, mkdirSync } from 'fs';
import config from './config.js';
import { Writable } from 'stream';
import * as rfs from "rotating-file-stream";
import path from "path";

const directoryName = config.path.logPath;
const isProduction = process.env.NODE_ENV !== "development";
let logPath = path.normalize(path.resolve(directoryName));
if (isProduction) {  
  logPath = path.normalize(path.join(__dirname, directoryName)); 
}

if (!existsSync(logPath)) {
  mkdirSync(logPath, { recursive: true });
}

if (!existsSync(logPath)) {
  console.log(`🚨 Log path does not exist: ${logPath}`);  

} else {
  console.log(`✅ Log path: ${logPath}`);
}


class UnicodeSafeStream extends Writable {
  _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    if (process.stdout.isTTY) {
      const str = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      process.stdout.write(str, callback);
    } else {
      process.stdout.write(chunk, callback);
    }
  }
}


const createRotatingStream = (type: 'app' | 'error') => {
  return rfs.createStream(`${type}.log`, {
    path: logPath,
    interval: '30d',                   
    size: '20MB' as any,               
    compress: 'gzip',                  
    maxFiles: 3,                      
    immutable: true,                   
    initialRotation: true,            
    intervalBoundary: true,            
    teeToStdout: false,              
    encoding: 'utf8',                 
    mode: 0o644                       
  });
};

const createLogger = (): Logger => {
  const isProduction = process.env.NODE_ENV !== 'development';
  if (isProduction) {
    return pino({
      level: process.env.LOG_LEVEL || 'info',
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
    },
      pino.multistream([
        { stream: createRotatingStream('app'), level: 'info' },
        { stream: createRotatingStream('error'), level: 'error' },
      ])
    );
  } else {
    return pino({
      level: process.env.LOG_LEVEL || 'info',
      base: null, 
      timestamp: () => `,"time":"${new Date().toLocaleString()}"`,
    }, new UnicodeSafeStream());
  }
};

export const logger = createLogger();