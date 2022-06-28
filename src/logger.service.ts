import { Log, Logging } from '@google-cloud/logging';
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
  log(message: any, ...optionalParams: any[]) {
    this.logger.info(message);
  }

  /**
   * Write an 'error' level log.
   */
  error(message: any, ...optionalParams: any[]) {
    this.logger.error(message);
  }

  /**
   * Write a 'warn' level log.
   */
  warn(message: any, ...optionalParams: any[]) {
    this.logger.warning(message);
  }

  /**
   * Write a 'debug' level log.
   */
  debug?(message: any, ...optionalParams: any[]) {
    this.logger.debug(message);
  }

  /**
   * Write a 'verbose' level log.
   */
  verbose?(message: any, ...optionalParams: any[]) {
    console.log('verbose');
  }
}
