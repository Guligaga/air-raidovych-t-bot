import { Injectable } from '@nestjs/common';
import EventSource from 'eventsource';
import { Subscription, Unsubscribable } from 'rxjs';

export interface State {
  id: number;
  name: string;
  name_en: string;
  alert: boolean;
  changed: string;
}

interface ChatStream {
  chatId: number;
  stream?: Subscription | EventSource;
}

const CHATS_STREAMS = new Map<number, ChatStream>();
const STATES = new Set<State>([]);

@Injectable()
export class AppRepository {
  getAllChats() {
    return [...CHATS_STREAMS.values()];
  }

  getChat(chatId: number): ChatStream | null {
    return CHATS_STREAMS.get(chatId) ?? null;
  }

  saveChat(chatStream: ChatStream) {
    const { chatId } = chatStream;
    return CHATS_STREAMS.set(chatId, chatStream).get(chatId);
  }

  deleteChat(chatId: number) {
    CHATS_STREAMS.delete(chatId);
  }

  setChatStream(
    chatId: number,
    stream: Subscription | EventSource,
  ): ChatStream {
    const chat = this.getChat(chatId) || { chatId };
    return this.saveChat({ ...chat, stream });
  }

  unsetChatStream(chatId: number) {
    const chat = this.getChat(chatId);
    if (!chat) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { stream, ...rest } = chat;
    return this.saveChat(rest);
  }

  // STATES

  getStates() {
    return [...STATES];
  }

  setStates(states: State[]) {
    STATES.clear();
    states.forEach((state) => {
      STATES.add(state);
    });
  }

  getOneState(stateId: number) {
    return this.getStates().find((s) => s.id === stateId);
  }

  setOneState(newState: State) {
    const statesUpd = this.getStates().map((state) =>
      state.id === newState.id ? newState : state,
    );
    this.setStates(statesUpd);
  }
}
