import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-config';
import { RegisterRequest } from '../models/auth';
import { SystemInfo } from '../models/system-info';
import { User } from '../models/user';
import { AuthApi } from './auth-api';
import { LocationApi } from './location-api';
import { SystemApi } from './system-api';

describe('API services', () => {
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '/test/api' }],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('SystemApi.ping calls GET {base}/system/ping', () => {
    const body: SystemInfo = {
      application: 'resale-market-api',
      version: '0.1.0',
      environment: 'dev',
      serverTime: '2026-10-20T08:15:00Z',
      database: { status: 'UP', version: '16.4', migrationsApplied: 10, latestMigration: '10' },
    };
    let result: SystemInfo | undefined;

    TestBed.inject(SystemApi)
      .ping()
      .subscribe((value) => (result = value));
    const request = controller.expectOne('/test/api/system/ping');
    expect(request.request.method).toBe('GET');
    request.flush(body);

    expect(result).toEqual(body);
  });

  it('LocationApi builds the province -> district -> municipality URLs', () => {
    const api = TestBed.inject(LocationApi);

    api.provinces().subscribe();
    api.districts(3).subscribe();
    api.municipalities(25).subscribe();

    controller.expectOne('/test/api/locations/provinces').flush([]);
    controller.expectOne('/test/api/locations/provinces/3/districts').flush([]);
    controller.expectOne('/test/api/locations/districts/25/municipalities').flush([]);
  });

  it('AuthApi.register posts the request to {base}/auth/register and returns the created user', () => {
    const request: RegisterRequest = {
      email: 'sita@example.com',
      password: 'correct horse',
      displayName: 'Sita Sharma',
      phone: null,
    };
    const created: User = {
      id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      email: 'sita@example.com',
      displayName: 'Sita Sharma',
      phone: null,
      createdAt: '2026-10-20T08:15:00Z',
    };
    let result: User | undefined;

    TestBed.inject(AuthApi)
      .register(request)
      .subscribe((value) => (result = value));
    const http = controller.expectOne('/test/api/auth/register');
    expect(http.request.method).toBe('POST');
    expect(http.request.body).toEqual(request);
    http.flush(created);

    expect(result).toEqual(created);
  });
});
