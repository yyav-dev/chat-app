import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserService } from './user';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  const sampleUsers: User[] = [
    {
      id: 'u1',
      name: 'Alice',
      email: 'alice@example.com',
      isOnline: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'u2',
      name: 'Bob',
      email: 'bob@example.com',
      isOnline: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch users list and update users$', () => {
    let receivedUsers: User[] = [];
    service.users$.subscribe((users) => {
      receivedUsers = users;
    });

    service.getUsers().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.length).toBe(2);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/users`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: sampleUsers });

    expect(receivedUsers.length).toBe(2);
    expect(receivedUsers[0].name).toBe('Alice');
  });

  it('should update user presence correctly', () => {
    service.getUsers().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/users`);
    req.flush({ success: true, data: sampleUsers });

    expect(service.getCachedUsers()[1].isOnline).toBe(false);

    service.updateUserPresence('u2', true);
    expect(service.getCachedUsers()[1].isOnline).toBe(true);
  });

  it('should update batch presence correctly', () => {
    service.getUsers().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/users`);
    req.flush({ success: true, data: sampleUsers });

    service.updateBatchPresence([
      { id: 'u1', online: true },
      { id: 'u2', online: true }
    ]);

    const updated = service.getCachedUsers();
    expect(updated[0].isOnline).toBe(true);
    expect(updated[1].isOnline).toBe(true);
  });

  it('should clear users on logout', () => {
    service.clearUsers();
    expect(service.getCachedUsers().length).toBe(0);
  });
});
