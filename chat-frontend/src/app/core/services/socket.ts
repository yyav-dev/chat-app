import { Injectable } from '@angular/core';
import { io, Socket as IOSocket } from 'socket.io-client';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Room } from '../models/room.model';

export interface SocketMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName?: string;
  message: string;
  createdAt: string;
}

export interface RoomHistory {
  roomId: string;
  messages: SocketMessage[];
}

export interface PresenceUpdate {
  userId: string;
  status: 'online' | 'offline';
}

export interface PresenceResponse {
  id: string;
  online: boolean;
}

export interface TypingUpdate {
  roomId: string;
  typingUsers: { userId: string; userName: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class Socket {
  private socket: IOSocket | null = null;
  private readonly socketUrl = environment.socketUrl;
  private currentJoinedRoomId: string | null = null;

  private readonly connectedSubject = new Subject<{
    socketId: string;
    userId: string;
    userName?: string;
    status: string;
  }>();
  readonly connected$: Observable<{
    socketId: string;
    userId: string;
    userName?: string;
    status: string;
  }> = this.connectedSubject.asObservable();

  private readonly messageReceivedSubject = new Subject<SocketMessage>();
  readonly messageReceived$: Observable<SocketMessage> =
    this.messageReceivedSubject.asObservable();

  private readonly roomHistorySubject = new Subject<RoomHistory>();
  readonly roomHistory$: Observable<RoomHistory> =
    this.roomHistorySubject.asObservable();

  private readonly presenceUpdateSubject = new Subject<PresenceUpdate>();
  readonly presenceUpdate$: Observable<PresenceUpdate> =
    this.presenceUpdateSubject.asObservable();

  private readonly presenceResponseSubject = new Subject<PresenceResponse[]>();
  readonly presenceResponse$: Observable<PresenceResponse[]> =
    this.presenceResponseSubject.asObservable();

  private readonly typingUpdateSubject = new Subject<TypingUpdate>();
  readonly typingUpdate$: Observable<TypingUpdate> =
    this.typingUpdateSubject.asObservable();

  private readonly roomCreatedSubject = new Subject<Room>();
  readonly roomCreated$: Observable<Room> =
    this.roomCreatedSubject.asObservable();

  private readonly roomUpdatedSubject = new Subject<Room>();
  readonly roomUpdated$: Observable<Room> =
    this.roomUpdatedSubject.asObservable();

  private readonly roomDeletedSubject = new Subject<{ roomId: string }>();
  readonly roomDeleted$: Observable<{ roomId: string }> =
    this.roomDeletedSubject.asObservable();

  private readonly roomsListSubject = new Subject<Room[]>();
  readonly roomsList$: Observable<Room[]> =
    this.roomsListSubject.asObservable();

  connect(userId: string, userName?: string): void {
    if (this.socket?.connected) {
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(this.socketUrl, {
      transports: ['websocket', 'polling'],
      auth: {
        userId,
        userName
      }
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      if (this.currentJoinedRoomId) {
        this.socket?.emit('join:room', this.currentJoinedRoomId);
      }
    });

    this.socket.on('connected', (data: { socketId: string; userId: string; userName?: string; status: string }) => {
      this.connectedSubject.next(data);
      if (this.currentJoinedRoomId) {
        this.socket?.emit('join:room', this.currentJoinedRoomId);
      }
    });

    this.socket.on('message:received', (message: SocketMessage) => {
      this.messageReceivedSubject.next(message);
    });

    this.socket.on('room:history', (history: RoomHistory) => {
      this.roomHistorySubject.next(history);
    });

    this.socket.on('presence:update', (presence: PresenceUpdate) => {
      this.presenceUpdateSubject.next(presence);
    });

    this.socket.on('presence:response', (users: PresenceResponse[]) => {
      this.presenceResponseSubject.next(users);
    });

    this.socket.on('typing:update', (typingData: TypingUpdate) => {
      this.typingUpdateSubject.next(typingData);
    });

    this.socket.on('room:created', (room: Room) => {
      this.roomCreatedSubject.next(room);
    });

    this.socket.on('room:updated', (room: Room) => {
      this.roomUpdatedSubject.next(room);
    });

    this.socket.on('room:deleted', (data: { roomId: string }) => {
      this.roomDeletedSubject.next(data);
    });

    this.socket.on('rooms:list', (rooms: Room[]) => {
      this.roomsListSubject.next(rooms);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
  }

  disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.socket.disconnect();
    this.socket = null;
    this.currentJoinedRoomId = null;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  joinRoom(roomId: string): void {
    this.currentJoinedRoomId = roomId;
    if (!this.socket || !this.socket.connected) {
      return;
    }

    this.socket.emit('join:room', roomId);
  }

  leaveRoom(roomId: string): void {
    if (this.currentJoinedRoomId === roomId) {
      this.currentJoinedRoomId = null;
    }

    if (!this.socket || !this.socket.connected) {
      return;
    }

    this.socket.emit('leave:room', roomId);
  }

  sendMessage(
    roomId: string,
    message: string,
    senderId: string,
    senderName?: string,
    id?: string
  ): void {
    if (!this.socket) {
      return;
    }

    this.socket.emit('message:send', {
      id,
      roomId,
      message,
      senderId,
      senderName
    });
  }

  sendTyping(roomId: string, isTyping: boolean): void {
    if (!this.socket || !roomId) {
      return;
    }

    if (isTyping) {
      this.socket.emit('typing:start', { roomId });
    } else {
      this.socket.emit('typing:stop', { roomId });
    }
  }

  sendHeartbeat(): void {
    if (this.socket?.connected) {
      this.socket.emit('presence:heartbeat');
    }
  }

  createRoom(name: string, description?: string): void {
    if (!this.socket || !name) {
      return;
    }

    this.socket.emit('room:create', {
      name,
      description
    });
  }

  updateRoom(roomId: string, name: string, description?: string): void {
    if (!this.socket || !roomId || !name) {
      return;
    }

    this.socket.emit('room:update', {
      roomId,
      name,
      description
    });
  }

  deleteRoom(roomId: string): void {
    if (!this.socket || !roomId) {
      return;
    }

    this.socket.emit('room:delete', { roomId });
  }

  requestRoomsList(): void {
    if (this.socket?.connected) {
      this.socket.emit('rooms:list');
    }
  }

  requestPresence(userIds: string[]): void {
    if (!this.socket || !userIds || userIds.length === 0) {
      return;
    }

    this.socket.emit('presence:request', userIds);
  }

  removeAllListeners(event: string): void {
    this.socket?.off(event);
  }
}