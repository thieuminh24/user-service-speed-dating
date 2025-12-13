// src/anonymous-chat/interfaces/matchmaking.interface.ts

export interface QueuedUser {
  userId: string;
  socketId: string;
  queuedAt: number; // timestamp
  preferences?: any;
}

export interface MatchResult {
  roomId: string;
  user1: {
    userId: string;
    socketId: string;
    anonymousName: string;
  };
  user2: {
    userId: string;
    socketId: string;
    anonymousName: string;
  };
}

// src/anonymous-chat/interfaces/room-event.interface.ts

export interface RoomJoinedEvent {
  roomId: string;
  yourAnonymousName: string;
  partnerAnonymousName: string;
}

export interface MessageReceivedEvent {
  roomId: string;
  messageId: string;
  senderAnonymousName: string;
  content: string;
  createdAt: Date;
  isMine: boolean;
}

export interface PartnerLeftEvent {
  roomId: string;
  message: string;
  reason: string;
}

export interface TypingEvent {
  roomId: string;
  isTyping: boolean;
}

export interface RoomClosedEvent {
  roomId: string;
  reason: string;
  message: string;
}

// src/anonymous-chat/interfaces/authenticated-socket.interface.ts
import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
  currentRoomId?: string; // Track user's current anonymous room
}
