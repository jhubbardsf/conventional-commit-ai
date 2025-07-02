import pc from 'picocolors';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4,
}

export class Logger {
  private level: LogLevel;
  private jsonMode: boolean;

  constructor(level: LogLevel = LogLevel.INFO, jsonMode = false) {
    this.level = level;
    this.jsonMode = jsonMode;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setJsonMode(enabled: boolean): void {
    this.jsonMode = enabled;
  }

  private log(
    level: LogLevel,
    type: string,
    message: string,
    data?: string | object
  ): void {
    if (this.level < level) {
      return;
    }

    if (this.jsonMode) {
      console.log(
        JSON.stringify({
          level: LogLevel[level].toLowerCase(),
          type,
          message,
          timestamp: new Date().toISOString(),
          ...(data && { data }),
        })
      );
      return;
    }

    const timestamp = new Date().toLocaleTimeString();
    const prefix = pc.gray(`[${timestamp}]`);

    switch (type) {
      case 'error':
        console.error(
          `${prefix} ${pc.red('❌')} ${pc.red(message)}`,
          data ? data : ''
        );
        break;
      case 'warn':
        console.warn(
          `${prefix} ${pc.yellow('⚠️')} ${pc.yellow(message)}`,
          data ? data : ''
        );
        break;
      case 'info':
        console.log(`${prefix} ${pc.blue('ℹ️')} ${message}`, data ? data : '');
        break;
      case 'success':
        console.log(
          `${prefix} ${pc.green('✅')} ${pc.green(message)}`,
          data ? data : ''
        );
        break;
      case 'debug':
        console.log(
          `${prefix} ${pc.magenta('🐛')} ${pc.dim(message)}`,
          data ? data : ''
        );
        break;
      case 'verbose':
        console.log(
          `${prefix} ${pc.cyan('📝')} ${pc.dim(message)}`,
          data ? data : ''
        );
        break;
    }
  }

  error(message: string, data?: string | object): void {
    this.log(LogLevel.ERROR, 'error', message, data);
  }

  warn(message: string, data?: string | object): void {
    this.log(LogLevel.WARN, 'warn', message, data);
  }

  info(message: string, data?: string | object): void {
    this.log(LogLevel.INFO, 'info', message, data);
  }

  success(message: string, data?: string | object): void {
    this.log(LogLevel.INFO, 'success', message, data);
  }

  debug(message: string, data?: string | object): void {
    this.log(LogLevel.DEBUG, 'debug', message, data);
  }

  verbose(message: string, data?: string | object): void {
    this.log(LogLevel.VERBOSE, 'verbose', message, data);
  }

  // Utility method for progress indication
  progress(message: string): void {
    if (this.level >= LogLevel.INFO && !this.jsonMode) {
      process.stdout.write(`${pc.blue('⏳')} ${message}...`);
    }
  }

  progressDone(message?: string): void {
    if (this.level >= LogLevel.INFO && !this.jsonMode) {
      process.stdout.write(`\r${pc.green('✅')} ${message || 'Done'}\n`);
    }
  }

  progressFailed(message?: string): void {
    if (this.level >= LogLevel.INFO && !this.jsonMode) {
      process.stdout.write(`\r${pc.red('❌')} ${message || 'Failed'}\n`);
    }
  }
}

// Export a default logger instance
export const logger = new Logger();
