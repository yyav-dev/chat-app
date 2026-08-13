import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Room } from '../models/room.model';

export interface RoomsResponse {
  success: boolean;
  data: Room[];
}

export interface RoomHistoryResponse {
  success: boolean;
  data: any[];
}

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private readonly roomsSubject = new BehaviorSubject<Room[]>([]);
  readonly rooms$ = this.roomsSubject.asObservable();

  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  readonly loading$ = this.loadingSubject.asObservable();

  private hasLoadedRooms = false;

  getRooms(): Observable<RoomsResponse> {
    this.loadingSubject.next(true);
    return this.http.get<RoomsResponse>(`${this.apiUrl}/rooms`).pipe(
      tap({
        next: (response) => {
          this.loadingSubject.next(false);
          if (response.success && Array.isArray(response.data)) {
            this.roomsSubject.next(response.data);
            this.hasLoadedRooms = true;
          }
        },
        error: () => {
          this.loadingSubject.next(false);
        }
      })
    );
  }

  loadRooms(force = false): void {
    if (!force && this.hasLoadedRooms) {
      return;
    }

    this.getRooms().subscribe({
      next: () => {},
      error: (err) => console.error('Failed to load rooms:', err)
    });
  }

  createRoom(name: string, description?: string): Observable<{ success: boolean; data: Room }> {
    return this.http.post<{ success: boolean; data: Room }>(`${this.apiUrl}/rooms`, {
      name,
      description
    }).pipe(
      tap((response) => {
        if (response.success && response.data) {
          this.addRoomLocally(response.data);
        }
      })
    );
  }

  updateRoom(roomId: string, name: string, description?: string): Observable<{ success: boolean; data: Room }> {
    return this.http.put<{ success: boolean; data: Room }>(`${this.apiUrl}/rooms/${roomId}`, {
      name,
      description
    }).pipe(
      tap((response) => {
        if (response.success && response.data) {
          this.updateRoomLocally(response.data);
        }
      })
    );
  }

  deleteRoom(roomId: string): Observable<{ success: boolean; data: { roomId: string } }> {
    return this.http.delete<{ success: boolean; data: { roomId: string } }>(`${this.apiUrl}/rooms/${roomId}`).pipe(
      tap((response) => {
        if (response.success) {
          this.removeRoomLocally(roomId);
        }
      })
    );
  }

  addRoomLocally(room: Room): void {
    const current = this.roomsSubject.value;
    const exists = current.some((r) => r.id === room.id);
    if (!exists) {
      this.roomsSubject.next([...current, room]);
    }
  }

  updateRoomLocally(room: Room): void {
    const current = this.roomsSubject.value;
    const index = current.findIndex((r) => r.id === room.id);
    if (index !== -1) {
      const updated = [...current];
      updated[index] = { ...updated[index], ...room };
      this.roomsSubject.next(updated);
    }
  }

  removeRoomLocally(roomId: string): void {
    const current = this.roomsSubject.value;
    this.roomsSubject.next(current.filter((r) => r.id !== roomId));
  }

  getRoomHistory(roomId: string): Observable<RoomHistoryResponse> {
    return this.http.get<RoomHistoryResponse>(`${this.apiUrl}/rooms/${roomId}/history`);
  }

  clearRooms(): void {
    this.roomsSubject.next([]);
    this.hasLoadedRooms = false;
    this.loadingSubject.next(false);
  }

  getCachedRooms(): Room[] {
    return this.roomsSubject.value;
  }
}
