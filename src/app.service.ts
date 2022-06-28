import {
  Injectable,
  OnModuleInit,
  Logger,
  OnModuleDestroy,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Start, Update, Command, Hears } from 'nestjs-telegraf';
import EventSource from 'eventsource';
import { Context } from 'telegraf';
import {
  map,
  Observable,
  Subscription,
  switchMap,
  timer,
  Unsubscribable,
} from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AppRepository } from './app.repository';

interface State {
  id: number;
  name: string;
  name_en: string;
  alert: boolean;
  changed: string;
}

interface AllStatesResponse {
  states: State[];
  last_update: string;
}

interface OneStateResponse {
  state: State;
  last_update: string;
}

@Update()
@Injectable()
export class AppService
  implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown
{
  private readonly logger = new Logger();
  private readonly alertApiURL = process.env.ALERT_API_URL;
  private readonly alertApiKey = process.env.ALERT_API_KEY;
  private readonly airRaidStartStickerId =
    'CAACAgIAAxkBAANuYq5j1eOl-Nsn-XJ1cDZ8RSzBgOcAAlwXAAKuUiBLzCG_Qptp0MAkBA';
  private readonly airRaidEndStickerId =
    'CAACAgIAAxkBAANwYq5j2ZMUb7jTLECvsCwkbEHXaJcAAgsUAAKQvSFLy0QB7jdRUmMkBA';
  private readonly kyivId = 25;

  // private alertEventSource!: EventSource;
  // private alertSubscription!: Unsubscribable;

  // private kyivEventSource2!: EventSource;

  // private states: State[] = [];
  // private kyivState!: State;

  private counter = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly repository: AppRepository,
  ) {}

  getData(): { message: string } {
    return { message: 'Welcome to server!' };
  }

  onModuleInit() {
    this.logger.log(`Initialization... telegram`);

    this.getAllStates().subscribe((resp) => {
      this.repository.setStates(resp.states);
    });
  }

  onModuleDestroy() {
    this.logger.warn('Module destroyed');
  }

  onApplicationShutdown(signal: string) {
    this.logger.warn(signal); // e.g. "SIGINT"
  }

  @Start()
  async startKyivCommand(ctx: Context) {
    this.stopCommand(ctx);

    const alertSubscription = timer(0, 5000)
      .pipe(switchMap(() => this.getState(this.kyivId)))
      .subscribe((resp) => {
        const kyivState = this.repository.getOneState(this.kyivId);
        if (kyivState?.alert === resp.state.alert) return;
        const stickerId: string = resp.state.alert
          ? this.airRaidStartStickerId
          : this.airRaidEndStickerId;

        ctx.replyWithSticker(stickerId);
        this.repository.setOneState(resp.state);
        this.repository.setChatStream(ctx.chat.id, alertSubscription);
      });
  }

  @Command('startall')
  async startAllCommand(ctx: Context) {
    this.stopCommand(ctx);

    const alertSubscription = timer(0, 5000)
      .pipe(switchMap(() => this.getAllStates()))
      .subscribe((resp) => {
        this.repository.getStates().forEach((oldState, _, oldStates) => {
          const newState = resp.states.find((s) => s.id === oldState.id);

          if (oldStates.length && oldState.alert !== newState.alert) {
            ctx.reply(
              `${newState.name}: ${
                newState.alert
                  ? 'ПОВІТРЯНА ТРИВОГА! \n 🚨🚨🚨'
                  : 'ВІДБІЙ ПОВІТРЯНОЇ ТРИВОГИ! \n ✅✅✅'
              }`,
            );
          }
        });

        this.repository.setStates(resp.states);
      });

    this.repository.setChatStream(ctx.chat.id, alertSubscription);
  }

  @Command('start2')
  async startKyivCommand2(ctx: Context) {
    this.stopCommand(ctx);

    const kyivEventSource = new EventSource(
      `https://alerts.com.ua/api/states/live/${this.kyivId}`,
      {
        headers: { 'X-API-Key': this.alertApiKey },
        withCredentials: true,
      },
    );

    this.repository.setChatStream(ctx.chat.id, kyivEventSource);

    kyivEventSource.onopen = (mes) => {
      ctx.reply(`35 boyevyh vyhodov`);
    };

    kyivEventSource.addEventListener(
      'update',
      (mes?: MessageEvent<OneStateResponse>) => {
        if (mes?.data?.state) {
          try {
            const stickerId = mes.data.state.alert
              ? this.airRaidStartStickerId
              : this.airRaidEndStickerId;

            ctx.replyWithSticker(stickerId);
          } catch (error) {
            console.error(error);
          }
        }
      },
    );

    kyivEventSource.onerror = (err) => {
      ctx.reply(JSON.stringify(err));
      kyivEventSource.close();
    };
  }

  @Command('stop')
  async stopCommand(ctx: Context) {
    this.counter = 0;
    const { stream } = this.repository.getChat(ctx.chat.id);
    if (stream instanceof Subscription) {
      stream.unsubscribe();
    }
    if (stream instanceof EventSource) {
      stream.close();
    }
    this.repository.unsetChatStream(ctx.chat.id);
  }

  // @Command('stop2')
  // async stopCommand2(ctx: Context) {
  //   ctx.reply(`lgbt`);
  //   this.kyivEventSource2.close();
  // }

  @Hears('AirRaidovych | hello')
  async hello(ctx: Context) {
    ctx.reply(
      `Hello, ${ctx.message.from.first_name} ${ctx.message.from.last_name}`,
    );
  }

  @Hears('AirRaidovych | please run infinite')
  async infinite(ctx: Context) {
    try {
      this.stopCommand(ctx);
      const infiniteSubscription = timer(0, 60 * 1000).subscribe(() => {
        // this.logger.log(`Calls *${++this.counter}* times.`);

        ctx.reply(`Calls *${++this.counter}* times.`, {
          parse_mode: 'Markdown',
        });
      });
      this.repository.setChatStream(ctx.chat.id, infiniteSubscription);
    } catch (error) {
      this.logger.error(error);
    }
  }

  @Hears('AirRaidovych | get states')
  public getCurrentStates(ctx?: Context) {
    const statesResp = JSON.stringify(this.repository.getStates(), null, 2);
    if (ctx) {
      ctx.reply(statesResp);
    }
    return `<pre>${statesResp}</pre>`;
  }

  private getAllStates(): Observable<AllStatesResponse> {
    return this.httpService
      .get<AllStatesResponse>(this.alertApiURL + '/states', {
        headers: { 'X-API-Key': this.alertApiKey },
        withCredentials: true,
      })
      .pipe(map((resp) => resp.data));
  }

  private getState(id: number): Observable<OneStateResponse> {
    return this.httpService
      .get<OneStateResponse>(`${this.alertApiURL}/states/${id}`, {
        headers: { 'X-API-Key': this.alertApiKey },
        withCredentials: true,
      })
      .pipe(map((resp) => resp.data));
  }
}
