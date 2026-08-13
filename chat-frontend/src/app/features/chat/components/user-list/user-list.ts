import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { UserService } from '../../../../core/services/user';
import { RoomService } from '../../../../core/services/room';
import { Socket } from '../../../../core/services/socket';
import { User } from '../../../../core/models/user.model';
import { Room } from '../../../../core/models/room.model';

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './user-list.html'
})
export class UserList implements OnInit, OnDestroy {
  private readonly userService = inject(UserService);
  private readonly roomService = inject(RoomService);
  private readonly socket = inject(Socket);
  private readonly destroy$ = new Subject<void>();

  @Input() selectedRoomId: string | null = null;
  @Input() selectedUserId: string | null = null;

  @Output() roomSelected = new EventEmitter<Room | null>();
  @Output() userSelected = new EventEmitter<ChatUser>();

  activeTab: 'channels' | 'direct' = 'channels';

  rooms: Room[] = [];
  users: ChatUser[] = [];
  selectedUser: ChatUser | null = null;
  selectedRoom: Room | null = null;

  isLoading = false;
  errorMessage = '';

  // Create Channel Modal state
  showCreateModal = false;
  newRoomName = '';
  newRoomDescription = '';
  isCreatingRoom = false;
  createError = '';

  // Edit Channel Modal state
  showEditModal = false;
  editRoomId = '';
  editRoomName = '';
  editRoomDescription = '';
  isUpdatingRoom = false;
  editError = '';

  // Delete Channel Modal state
  showDeleteModal = false;
  deleteRoomId = '';
  deleteRoomName = '';
  isDeletingRoom = false;
  deleteError = '';

  ngOnInit(): void {
    this.userService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.isLoading = loading;
      });

    this.roomService.rooms$
      .pipe(takeUntil(this.destroy$))
      .subscribe((rooms) => {
        this.rooms = rooms;
        if (this.selectedRoomId) {
          this.selectedRoom = this.rooms.find((r) => r.id === this.selectedRoomId) || null;
        }
      });

    this.userService.users$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = this.mapUsers(users);
          this.errorMessage = '';

          if (this.selectedUser) {
            const found = this.users.find((u) => u.id === this.selectedUser?.id);
            if (found) {
              this.selectedUser = found;
            }
          }

          if (this.users.length > 0) {
            const ids = this.users.map((u) => u.id);
            this.socket.requestPresence(ids);
          }
        },
        error: (err) => {
          console.error('UserList failed to load users:', err);
          this.errorMessage = 'Unable to load users. Please try again.';
        }
      });

    this.socket.roomCreated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((newRoom) => {
        this.roomService.addRoomLocally(newRoom);
      });

    this.socket.roomUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((updatedRoom) => {
        this.roomService.updateRoomLocally(updatedRoom);
        if (this.selectedRoom && this.selectedRoom.id === updatedRoom.id) {
          this.selectedRoom = updatedRoom;
          this.roomSelected.emit(updatedRoom);
        }
      });

    this.socket.roomDeleted$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        this.roomService.removeRoomLocally(data.roomId);
        if (this.selectedRoom && this.selectedRoom.id === data.roomId) {
          this.selectedRoom = null;
          this.roomSelected.emit(null);
        }
      });

    this.socket.roomsList$
      .pipe(takeUntil(this.destroy$))
      .subscribe((roomsList) => {
        if (roomsList && Array.isArray(roomsList)) {
          for (const room of roomsList) {
            this.roomService.addRoomLocally(room);
          }
        }
      });

    this.socket.presenceUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        this.userService.updateUserPresence(update.userId, update.status === 'online');
      });

    this.socket.presenceResponse$
      .pipe(takeUntil(this.destroy$))
      .subscribe((presenceList) => {
        this.userService.updateBatchPresence(presenceList);
      });

    this.socket.connected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.socket.requestRoomsList();
        if (this.users.length > 0) {
          this.socket.requestPresence(this.users.map((u) => u.id));
        } else {
          this.userService.loadUsers(true);
        }
      });

    this.roomService.loadRooms(true);
    this.userService.loadUsers(true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: 'channels' | 'direct'): void {
    this.activeTab = tab;
  }

  selectRoom(room: Room): void {
    this.selectedRoom = room;
    this.selectedUser = null;
    this.roomSelected.emit(room);
  }

  selectUser(user: ChatUser): void {
    this.selectedUser = user;
    this.selectedRoom = null;
    this.userSelected.emit(user);
  }

  refresh(): void {
    this.errorMessage = '';
    this.roomService.loadRooms(true);
    this.userService.refreshUsers();
  }

  openCreateModal(): void {
    this.newRoomName = '';
    this.newRoomDescription = '';
    this.createError = '';
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  createChannel(): void {
    const name = this.newRoomName.trim();
    if (!name) {
      this.createError = 'Channel name is required.';
      return;
    }

    this.isCreatingRoom = true;
    this.createError = '';

    this.roomService.createRoom(name, this.newRoomDescription.trim()).subscribe({
      next: (response) => {
        this.isCreatingRoom = false;
        this.showCreateModal = false;
        if (response.success && response.data) {
          this.socket.createRoom(response.data.name, response.data.description || undefined);
          this.selectRoom(response.data);
        }
      },
      error: (err) => {
        this.isCreatingRoom = false;
        this.createError = err?.error?.message || 'Failed to create channel.';
      }
    });
  }

  openEditModal(room: Room, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.editRoomId = room.id;
    this.editRoomName = room.name;
    this.editRoomDescription = room.description || '';
    this.editError = '';
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
  }

  updateChannel(): void {
    const name = this.editRoomName.trim();
    if (!name) {
      this.editError = 'Channel name is required.';
      return;
    }

    const roomId = this.editRoomId;
    this.isUpdatingRoom = true;
    this.editError = '';

    this.roomService.updateRoom(roomId, name, this.editRoomDescription.trim()).subscribe({
      next: (response) => {
        this.isUpdatingRoom = false;
        this.showEditModal = false;
        if (response.success && response.data) {
          this.socket.updateRoom(roomId, response.data.name, response.data.description || undefined);
          if (this.selectedRoom?.id === roomId) {
            this.selectedRoom = response.data;
            this.roomSelected.emit(response.data);
          }
        }
      },
      error: (err) => {
        this.isUpdatingRoom = false;
        this.editError = err?.error?.message || 'Failed to update channel.';
      }
    });
  }

  openDeleteModal(room: Room, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.deleteRoomId = room.id;
    this.deleteRoomName = room.name;
    this.deleteError = '';
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
  }

  deleteChannel(): void {
    if (!this.deleteRoomId) return;

    const roomIdToDelete = this.deleteRoomId;
    this.isDeletingRoom = true;
    this.deleteError = '';

    this.roomService.deleteRoom(roomIdToDelete).subscribe({
      next: (response) => {
        this.isDeletingRoom = false;
        this.showDeleteModal = false;
        this.deleteRoomId = '';
        this.deleteRoomName = '';
        if (response.success) {
          this.socket.deleteRoom(roomIdToDelete);
          if (this.selectedRoom?.id === roomIdToDelete) {
            this.selectedRoom = null;
            this.roomSelected.emit(null);
          }
        }
      },
      error: (err) => {
        this.isDeletingRoom = false;
        this.deleteError = err?.error?.message || 'Failed to delete channel.';
      }
    });
  }

  private mapUsers(users: User[]): ChatUser[] {
    return (users || []).map((user: User) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      isOnline: Boolean(user.isOnline)
    }));
  }
}