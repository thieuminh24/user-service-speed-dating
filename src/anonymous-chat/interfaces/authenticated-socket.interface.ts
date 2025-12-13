// src/anonymous-chat/interfaces/authenticated-socket.interface.ts
import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
  currentRoomId?: string; // Track user's current anonymous room
}
