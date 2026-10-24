import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-config';
import { SystemInfo } from '../models/system-info';
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
});
