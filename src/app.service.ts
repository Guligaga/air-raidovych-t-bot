import { Injectable, OnModuleInit } from '@nestjs/common';
import { Hears, Help, On, Start, Update, Command } from 'nestjs-telegraf';
import EventSource from 'eventsource';
import { Context } from 'telegraf';
import {
  interval,
  map,
  Observable,
  switchMap,
  timer,
  Unsubscribable,
} from 'rxjs';
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

  private alertEventSource!: EventSource;
  private alertSubscription!: Unsubscribable;

  private states: State[] = [];

  constructor(private readonly httpService: HttpService) {}

  getData(): { message: string } {
    return { message: 'Welcome to server!' };
  }

  onModuleInit() {
    console.log(`Initialization... telegram`);

    this.watchState(25);

    // this.getAllStates().subscribe((resp) => {
    //   this.states = resp.states;
    // });
    this.alertSubscription = timer(0, 10000)
      .pipe(switchMap(() => this.getAllStates()))
      .subscribe((resp) => {
        this.states.forEach((oldState) => {
          const newState = resp.states.find((s) => s.id === oldState.id);
          // console.table({ OLD: oldState, NEW: newState });

          if (this.states.length && oldState.alert !== newState.alert) {
            // console.log(
            //   `${newState.name}: ${
            //     newState.alert
            //       ? 'ПОВІТРЯНА ТРИВОГА!'
            //       : 'ВІДБІЙ ПОВІТРЯНОЇ ТРИВОГИ!'
            //   }`,
            // );
            console.table(newState);
          }
        });

        this.states = resp.states;
      });
  }

  @Start()
  async startCommand(ctx: Context) {
    this.alertSubscription = timer(0, 5000)
      .pipe(switchMap(() => this.getAllStates()))
      .subscribe((resp) => {
        this.states.forEach((oldState) => {
          const newState = resp.states.find((s) => s.id === oldState.id);
          console.table({ OLD: oldState, NEW: newState });

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

  @Command('stop')
  async stopCommand() {
    this.alertSubscription.unsubscribe();
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
      'https://alerts.com.ua/api/states/live',
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
