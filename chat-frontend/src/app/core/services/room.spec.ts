import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RoomService } from './room';
import { Room } from '../models/room.model';
import { environment } from '../../../environments/environment';

describe('RoomService', () => {
  let service: RoomService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RoomService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(RoomService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch rooms via GET and update rooms$', () => {
    const mockRooms: Room[] = [
      { id: 'tech', name: 'tech', description: 'Tech channel', type: 'channel' }
    ];

    let receivedRooms: Room[] = [];
    service.rooms$.subscribe((rooms) => {
      receivedRooms = rooms;
    });

    service.getRooms().subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data).toEqual(mockRooms);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/rooms`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockRooms });

    expect(receivedRooms).toEqual(mockRooms);
  });

  it('should update a room via PUT and update locally', () => {
    const originalRoom: Room = { id: 'tech', name: 'tech', description: 'Tech channel', type: 'channel' };
    const updatedRoom: Room = { id: 'tech', name: 'tech-renamed', description: 'Updated channel', type: 'channel' };

    service.addRoomLocally(originalRoom);
    expect(service.getCachedRooms()[0].name).toBe('tech');

    service.updateRoom('tech', 'tech-renamed', 'Updated channel').subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.name).toBe('tech-renamed');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/rooms/tech`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'tech-renamed', description: 'Updated channel' });
    req.flush({ success: true, data: updatedRoom });

    expect(service.getCachedRooms()[0].name).toBe('tech-renamed');
  });

  it('should delete a room via DELETE and remove locally', () => {
    const room: Room = { id: 'to-delete', name: 'to-delete', type: 'channel' };
    service.addRoomLocally(room);
    expect(service.getCachedRooms().length).toBe(1);

    service.deleteRoom('to-delete').subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/rooms/to-delete`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: { roomId: 'to-delete' } });

    expect(service.getCachedRooms().length).toBe(0);
  });

  it('should add a room locally and avoid duplicates', () => {
    const room: Room = { id: 'gaming', name: 'gaming', type: 'channel' };
    service.addRoomLocally(room);
    expect(service.getCachedRooms().length).toBe(1);

    service.addRoomLocally(room);
    expect(service.getCachedRooms().length).toBe(1);
  });

  it('should clear rooms cleanly', () => {
    const room: Room = { id: 'gaming', name: 'gaming', type: 'channel' };
    service.addRoomLocally(room);
    expect(service.getCachedRooms().length).toBe(1);

    service.clearRooms();
    expect(service.getCachedRooms().length).toBe(0);
  });
});
