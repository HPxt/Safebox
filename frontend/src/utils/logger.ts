// Logger seguro que só funciona em desenvolvimento
const isDevelopment = process.env.NODE_ENV === 'development';

class SecureLogger {
  private shouldLog: boolean;

  constructor() {
    this.shouldLog = isDevelopment;
  }

  log(...args: any[]): void {
    if (this.shouldLog) {
      console.log(...args);
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog) {
      console.error(...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog) {
      console.warn(...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog) {
      console.info(...args);
    }
  }

  debug(...args: any[]): void {
    if (this.shouldLog) {
      console.debug(...args);
    }
  }

  // Método especial para logs críticos que SEMPRE devem aparecer
  critical(message: string, error?: any): void {
    console.error(`[CRITICAL] ${message}`, error || '');
  }
}

export const logger = new SecureLogger();

// Para facilitar a migração
export default logger; 