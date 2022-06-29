import { Entry, Log, Logging } from '@google-cloud/logging';
import { LoggerService } from '@nestjs/common';

export class MyLogger implements LoggerService {
  private logger!: Log;
  constructor() {
    const logging = new Logging({ projectId: 'air-raidovich-t-bot' });
    this.logger = logging.log('log');
  }
  /**
   * Write a 'log' level log.
   */

  private getEntry(message: any): Entry {
    const entry = this.logger.entry({}, message);
    return entry;
  }

  log(message: any, ...optionalParams: any[]) {
    this.logger.info(this.getEntry(message));
  }

  /**
   * Write an 'error' level log.
   */
  error(message: any, ...optionalParams: any[]) {
    this.logger.error(this.getEntry(message));
  }

  /**
   * Write a 'warn' level log.
   */
  warn(message: any, ...optionalParams: any[]) {
    this.logger.warning(this.getEntry(message));
  }

  /**
   * Write a 'debug' level log.
   */
  debug?(message: any, ...optionalParams: any[]) {
    this.logger.debug(this.getEntry(message));
  }

  /**
   * Write a 'verbose' level log.
   */
  verbose?(message: any, ...optionalParams: any[]) {
    console.log('verbose');
  }
}
