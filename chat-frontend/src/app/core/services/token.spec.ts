import { TestBed } from '@angular/core/testing';
import { Token } from './token';

describe('Token Service', () => {
  let service: Token;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Token);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should store and retrieve token in localStorage', () => {
    const testToken = 'mock-jwt-token-123';
    service.setToken(testToken);
    expect(service.getToken()).toBe(testToken);
    expect(service.hasToken()).toBe(true);
  });

  it('should remove token from localStorage', () => {
    service.setToken('test-token');
    expect(service.hasToken()).toBe(true);
    service.removeToken();
    expect(service.getToken()).toBeNull();
    expect(service.hasToken()).toBe(false);
  });
});
