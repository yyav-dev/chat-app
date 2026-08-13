import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  tap
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

export interface UsersResponse {
  success: boolean;
  data: User[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private readonly usersSubject =
    new BehaviorSubject<User[]>([]);

  readonly users$ =
    this.usersSubject.asObservable();

  private readonly loadingSubject =
    new BehaviorSubject<boolean>(false);

  readonly loading$ =
    this.loadingSubject.asObservable();

  private hasLoadedUsers = false;
  private loadingUsers = false;

  getUsers(): Observable<UsersResponse> {
    this.loadingSubject.next(true);

    return this.http.get<UsersResponse>(
      `${this.apiUrl}/users`
    ).pipe(
      tap({
        next: (response) => {
          this.loadingSubject.next(false);
          if (
            response.success &&
            Array.isArray(response.data)
          ) {
            this.usersSubject.next(
              response.data
            );
            this.hasLoadedUsers = true;
          }
        },
        error: () => {
          this.loadingSubject.next(false);
        }
      })
    );
  }

  loadUsers(force = false): void {
    if (!force && (this.hasLoadedUsers || this.loadingUsers)) {
      return;
    }

    this.loadingUsers = true;
    this.loadingSubject.next(true);

    this.getUsers()
      .subscribe({
        next: () => {
          this.loadingUsers = false;
        },
        error: (error) => {
          this.loadingUsers = false;
          console.error(
            'Failed to load users:',
            error
          );
        }
      });
  }

  refreshUsers(): void {
    this.loadUsers(true);
  }

  updateUserPresence(userId: string, isOnline: boolean): void {
    const currentUsers = this.usersSubject.value;
    let changed = false;

    const updatedUsers = currentUsers.map((user) => {
      if (user.id === userId && user.isOnline !== isOnline) {
        changed = true;
        return { ...user, isOnline };
      }
      return user;
    });

    if (changed) {
      this.usersSubject.next(updatedUsers);
    }
  }

  updateBatchPresence(presenceList: { id: string; online: boolean }[]): void {
    if (!presenceList || presenceList.length === 0) {
      return;
    }

    const presenceMap = new Map<string, boolean>();
    for (const item of presenceList) {
      presenceMap.set(item.id, item.online);
    }

    const currentUsers = this.usersSubject.value;
    let changed = false;

    const updatedUsers = currentUsers.map((user) => {
      if (presenceMap.has(user.id)) {
        const newStatus = presenceMap.get(user.id)!;
        if (user.isOnline !== newStatus) {
          changed = true;
          return { ...user, isOnline: newStatus };
        }
      }
      return user;
    });

    if (changed) {
      this.usersSubject.next(updatedUsers);
    }
  }

  getProfile(): Observable<{ success: boolean; data: User }> {
    return this.http.get<{ success: boolean; data: User }>(
      `${this.apiUrl}/users/me`
    );
  }

  getCachedUsers(): User[] {
    return this.usersSubject.value;
  }

  clearUsers(): void {
    this.usersSubject.next([]);
    this.hasLoadedUsers = false;
    this.loadingUsers = false;
    this.loadingSubject.next(false);
  }

}