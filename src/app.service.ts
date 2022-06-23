import { Injectable, OnModuleInit } from '@nestjs/common';
import { Start, Update, Command, Hears } from 'nestjs-telegraf';
import EventSource from 'eventsource';
import { Context } from 'telegraf';
import { map, Observable, switchMap, timer, Unsubscribable } from 'rxjs';
import { HttpService } from '@nestjs/axios';

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
export class AppService implements OnModuleInit {
  private readonly alertApiURL = process.env.ALERT_API_URL;
  private readonly alertApiKey = process.env.ALERT_API_KEY;
  private readonly airRaidStartStickerId =
    'CAACAgIAAxkBAANuYq5j1eOl-Nsn-XJ1cDZ8RSzBgOcAAlwXAAKuUiBLzCG_Qptp0MAkBA';
  private readonly airRaidEndStickerId =
    'CAACAgIAAxkBAANwYq5j2ZMUb7jTLECvsCwkbEHXaJcAAgsUAAKQvSFLy0QB7jdRUmMkBA';
  private readonly kyivId = 25;

  private alertEventSource!: EventSource;
  private alertSubscription!: Unsubscribable;

  private states: State[] = [];
  private kyivState!: State;

  private counter = 0;

  constructor(private readonly httpService: HttpService) {}

  getData(): { message: string } {
    return { message: 'Welcome to server!' };
  }

  onModuleInit() {
    console.log(`Initialization... telegram`);

    this.getAllStates().subscribe((resp) => {
      this.states = resp.states;
    });
  }

  @Start()
  async startKyivCommand(ctx: Context) {
    this.stopCommand();

    this.alertSubscription = timer(0, 5000)
      .pipe(switchMap(() => this.getState(this.kyivId)))
      .subscribe((resp) => {
        if (!this.kyivState) {
          this.kyivState = resp.state;
        }
        if (this.kyivState?.alert === resp.state.alert) return;
        const stickerId: string = resp.state.alert
          ? this.airRaidStartStickerId
          : this.airRaidEndStickerId;

        ctx.replyWithSticker(stickerId);
        this.kyivState = resp.state;
      });
  }

  @Command('startall')
  async startAllCommand(ctx: Context) {
    this.stopCommand();

    this.alertSubscription = timer(0, 5000)
      .pipe(switchMap(() => this.getAllStates()))
      .subscribe((resp) => {
        this.states.forEach((oldState) => {
          const newState = resp.states.find((s) => s.id === oldState.id);

          if (this.states.length && oldState.alert !== newState.alert) {
            ctx.reply(
              `${newState.name}: ${
                newState.alert
                  ? 'ПОВІТРЯНА ТРИВОГА!'
                  : 'ВІДБІЙ ПОВІТРЯНОЇ ТРИВОГИ!'
              }`,
            );
          }
        });

        this.states = resp.states;
      });
  }

  @Hears('AirRaidovych | please run infinite')
  async infinite(ctx: Context) {
    this.stopCommand();
    this.alertSubscription = timer(0, 60 * 1000).subscribe(() => {
      ctx.reply(`Calls **${++this.counter}** times.`);
    });
  }

  @Hears('AirRaidovych | hello')
  async hello(ctx: Context) {
    ctx.reply(
      `Hello, ${ctx.message.from.first_name} ${ctx.message.from.last_name}`,
    );
  }

  @Command('stop')
  async stopCommand() {
    this.counter = 0;
    this.alertSubscription?.unsubscribe();
  }

  public getCurrentStates() {
    return `<pre>${JSON.stringify(this.states, null, 2)}</pre>`;
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

  private watchState(id: number) {
    this.alertEventSource = new EventSource(
      'https://alerts.com.ua/api/states/live/' + id,
      {
        headers: { 'X-API-Key': this.alertApiKey },
        withCredentials: true,
      },
    );

    this.alertEventSource.onopen = (mes) => {
      console.log(mes);
    };

    this.alertEventSource.onmessage = (mes) => {
      console.log(mes);
    };
  }
}
