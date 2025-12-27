import { LogCategory } from "@/lib/services/logger.types";

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface ClientLogMetadata {
  category?: LogCategory;
  action?: string;
  [key: string]: any;
}

class ClientLogger {
  private async log(level: LogLevel, message: string, metadata?: ClientLogMetadata) {
    // Always log to console in development
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, metadata);
    
    try {
      // Send to server logger
      await fetch('/api/log/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          message,
          metadata,
          category: metadata?.category || LogCategory.CLIENT
        })
      });
    } catch (error) {
      // Silently fail - we don't want logging errors to break the app
      console.error('Failed to send log to server:', error);
    }
  }
  
  debug(message: string, metadata?: ClientLogMetadata) {
    this.log('debug', message, metadata);
  }
  
  info(message: string, metadata?: ClientLogMetadata) {
    this.log('info', message, metadata);
  }
  
  warn(message: string, metadata?: ClientLogMetadata) {
    this.log('warn', message, metadata);
  }
  
  error(message: string, error?: Error | unknown, metadata?: ClientLogMetadata) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    this.log('error', message, {
      ...metadata,
      error: errorMessage,
      stack: errorStack
    });
  }
}

export const clientLogger = new ClientLogger();