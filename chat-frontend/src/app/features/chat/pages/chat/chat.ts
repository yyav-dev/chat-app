import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, interval } from 'rxjs';

import {
  ChatUser,
  UserList
} from '../../components/user-list/user-list';
import { UserService } from '../../../../core/services/user';
import { RoomService } from '../../../../core/services/room';
import { Socket } from '../../../../core/services/socket';
import { Token } from '../../../../core/services/token';
import { Room } from '../../../../core/models/room.model';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string;
  message: string;
  timestamp: Date;
  isMine: boolean;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    FormsModule,
    UserList
  ],
  templateUrl: './chat.html'
})
export class Chat implements OnInit, OnDestroy {
  private readonly userService = inject(UserService);
  private readonly roomService = inject(RoomService);
  private readonly socket = inject(Socket);
  private readonly token = inject(Token);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

  selectedRoom: Room | null = null;
  selectedChatUser: ChatUser | null = null;
  currentRoomId: string | null = null;

  messageText = '';
  messages: ChatMessage[] = [];
  currentUser: CurrentUser | null = null;
  isLoadingHistory = false;

  // Typing indicators
  typingUsers: { userId: string; userName: string }[] = [];
  private typingTimeout: any = null;
  private isTyping = false;

  // Edit Channel Modal state
  showEditModal = false;
  editRoomName = '';
  editRoomDescription = '';
  isUpdatingRoom = false;
  editError = '';

  // Delete Channel Modal state
  showDeleteModal = false;
  isDeletingRoom = false;
  deleteError = '';

  ngOnInit(): void {
    console.log('Chat dashboard initialized');
    this.loadCurrentUser();
    this.setupSocketListeners();
    this.setupPresenceHeartbeat();
    this.setupDefaultRoomAutoSelection();
  }

  private loadCurrentUser(): void {
    this.userService
      .getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.currentUser = {
            id: response.data.id,
            name: response.data.name,
            email: response.data.email
          };

          this.roomService.loadRooms(true);
          this.userService.loadUsers(true);
          this.socket.connect(this.currentUser.id, this.currentUser.name);
        },
        error: (error) => {
          console.error('Failed to load authenticated user:', error);
          if (error?.status === 401) {
            this.logout();
          }
        }
      });
  }

  private setupDefaultRoomAutoSelection(): void {
    this.roomService.rooms$
      .pipe(takeUntil(this.destroy$))
      .subscribe((rooms) => {
        if (rooms.length > 0 && !this.selectedRoom && !this.selectedChatUser) {
          this.onRoomSelected(rooms[0]);
        }
      });
  }

  private setupPresenceHeartbeat(): void {
    interval(60000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.socket.sendHeartbeat();
      });
  }

  private setupSocketListeners(): void {
    this.socket.connected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.currentRoomId) {
          this.socket.joinRoom(this.currentRoomId);
          this.isLoadingHistory = true;
        }
      });

    this.socket.messageReceived$
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        if (msg.roomId === this.currentRoomId) {
          const exists = this.messages.some((m) => m.id === msg.id);
          if (!exists) {
            this.messages.push({
              id: msg.id,
              senderId: msg.senderId,
              senderName: msg.senderName,
              message: msg.message,
              timestamp: new Date(msg.createdAt),
              isMine: msg.senderId === this.currentUser?.id
            });
            this.scrollToBottom();
          }
        }
      });

    this.socket.roomHistory$
      .pipe(takeUntil(this.destroy$))
      .subscribe((history) => {
        if (history.roomId === this.currentRoomId) {
          this.isLoadingHistory = false;
          const mappedMessages: ChatMessage[] = (history.messages || []).map((msg) => ({
            id: msg.id,
            senderId: msg.senderId,
            senderName: msg.senderName,
            message: msg.message,
            timestamp: new Date(msg.createdAt),
            isMine: msg.senderId === this.currentUser?.id
          }));

          mappedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          this.messages = mappedMessages;
          this.scrollToBottom();
        }
      });

    this.socket.typingUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((typingData) => {
        if (typingData.roomId === this.currentRoomId) {
          this.typingUsers = (typingData.typingUsers || []).filter(
            (u) => u.userId !== this.currentUser?.id
          );
        }
      });

    this.socket.presenceUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((presence) => {
        if (this.selectedChatUser && this.selectedChatUser.id === presence.userId) {
          this.selectedChatUser = {
            ...this.selectedChatUser,
            isOnline: presence.status === 'online'
          };
        }
      });

    this.socket.roomUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((updatedRoom) => {
        if (this.selectedRoom && this.selectedRoom.id === updatedRoom.id) {
          this.selectedRoom = updatedRoom;
        }
      });

    this.socket.roomDeleted$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        if (this.selectedRoom?.id === data.roomId || this.currentRoomId === data.roomId) {
          this.onRoomSelected(null);
        }
      });
  }

  onRoomSelected(room: Room | null, forceReload = false): void {
    if (room === null) {
      if (this.currentRoomId) {
        this.socket.leaveRoom(this.currentRoomId);
      }
      this.selectedRoom = null;
      this.selectedChatUser = null;
      this.currentRoomId = null;
      this.messages = [];
      this.typingUsers = [];
      this.isLoadingHistory = false;
      this.showDeleteModal = false;
      this.showEditModal = false;
      return;
    }

    if (this.currentRoomId === room.id && !forceReload && this.messages.length > 0) {
      this.selectedRoom = room;
      return;
    }

    if (this.currentRoomId && this.currentRoomId !== room.id) {
      this.socket.leaveRoom(this.currentRoomId);
    }

    this.selectedRoom = room;
    this.selectedChatUser = null;
    this.currentRoomId = room.id;
    this.messages = [];
    this.typingUsers = [];
    this.isLoadingHistory = true;

    this.socket.joinRoom(room.id);
  }

  onUserSelected(user: ChatUser): void {
    if (!this.currentUser) {
      this.selectedChatUser = user;
      return;
    }

    const newRoomId = `room_${[this.currentUser.id, user.id].sort().join('_')}`;

    if (this.currentRoomId === newRoomId && this.messages.length > 0) {
      this.selectedChatUser = user;
      return;
    }

    if (this.currentRoomId && this.currentRoomId !== newRoomId) {
      this.socket.leaveRoom(this.currentRoomId);
    }

    this.selectedChatUser = user;
    this.selectedRoom = null;
    this.currentRoomId = newRoomId;
    this.messages = [];
    this.typingUsers = [];
    this.isLoadingHistory = true;

    this.socket.joinRoom(newRoomId);
  }

  openEditChannelModal(): void {
    if (!this.selectedRoom) return;
    this.editRoomName = this.selectedRoom.name;
    this.editRoomDescription = this.selectedRoom.description || '';
    this.editError = '';
    this.showEditModal = true;
  }

  closeEditChannelModal(): void {
    this.showEditModal = false;
  }

  updateChannel(): void {
    if (!this.selectedRoom) return;
    const name = this.editRoomName.trim();
    if (!name) {
      this.editError = 'Channel name is required.';
      return;
    }

    this.isUpdatingRoom = true;
    this.editError = '';

    this.roomService.updateRoom(this.selectedRoom.id, name, this.editRoomDescription.trim()).subscribe({
      next: (response) => {
        this.isUpdatingRoom = false;
        this.showEditModal = false;
        if (response.success && response.data) {
          this.socket.updateRoom(this.selectedRoom!.id, response.data.name, response.data.description || undefined);
          this.selectedRoom = response.data;
        }
      },
      error: (err) => {
        this.isUpdatingRoom = false;
        this.editError = err?.error?.message || 'Failed to update channel.';
      }
    });
  }

  openDeleteChannelModal(): void {
    if (!this.selectedRoom) return;
    this.deleteError = '';
    this.showDeleteModal = true;
  }

  closeDeleteChannelModal(): void {
    this.showDeleteModal = false;
  }

  deleteChannel(): void {
    if (!this.selectedRoom) return;

    const roomIdToDelete = this.selectedRoom.id;
    this.isDeletingRoom = true;
    this.deleteError = '';

    this.roomService.deleteRoom(roomIdToDelete).subscribe({
      next: (response) => {
        this.isDeletingRoom = false;
        this.showDeleteModal = false;
        if (response.success) {
          this.socket.deleteRoom(roomIdToDelete);
          this.onRoomSelected(null);
        }
      },
      error: (err) => {
        this.isDeletingRoom = false;
        this.deleteError = err?.error?.message || 'Failed to delete channel.';
      }
    });
  }

  onMessageInputChange(): void {
    if (!this.currentRoomId) return;

    if (!this.isTyping) {
      this.isTyping = true;
      this.socket.sendTyping(this.currentRoomId, true);
    }

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 2500);
  }

  private stopTyping(): void {
    if (this.isTyping && this.currentRoomId) {
      this.isTyping = false;
      this.socket.sendTyping(this.currentRoomId, false);
    }
  }

  sendMessage(): void {
    const message = this.messageText.trim();
    if (!message || !this.currentUser || !this.currentRoomId) {
      return;
    }

    this.stopTyping();
    this.messageText = '';

    const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newMsg: ChatMessage = {
      id: messageId,
      senderId: this.currentUser.id,
      senderName: this.currentUser.name,
      message: message,
      timestamp: new Date(),
      isMine: true
    };

    this.messages.push(newMsg);
    this.scrollToBottom();

    this.socket.sendMessage(
      this.currentRoomId,
      message,
      this.currentUser.id,
      this.currentUser.name,
      messageId
    );
  }

  onMessageKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatTime(date: Date): string {
    if (!date || isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTypingText(): string {
    if (this.typingUsers.length === 0) return '';
    if (this.typingUsers.length === 1) {
      return `${this.typingUsers[0].userName} is typing...`;
    }
    if (this.typingUsers.length === 2) {
      return `${this.typingUsers[0].userName} and ${this.typingUsers[1].userName} are typing...`;
    }
    return `${this.typingUsers[0].userName} and ${this.typingUsers.length - 1} others are typing...`;
  }

  scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer?.nativeElement) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    }, 50);
  }

  logout(): void {
    if (this.currentRoomId) {
      this.socket.leaveRoom(this.currentRoomId);
    }
    this.socket.disconnect();
    this.token.removeToken();
    this.userService.clearUsers();
    this.roomService.clearRooms();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    if (this.currentRoomId) {
      this.socket.leaveRoom(this.currentRoomId);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }
}