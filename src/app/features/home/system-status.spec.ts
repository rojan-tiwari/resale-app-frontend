import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { problemDetailInterceptor } from '../../core/interceptors/problem-detail.interceptor';
import { SystemInfo } from '../../core/models/system-info';
import { SystemStatus } from './system-status';

const PING = '/api/v1/system/ping';
const PROVINCES = '/api/v1/locations/provinces';

const info: SystemInfo = {
  application: 'resale-market-api',
  version: '0.1.0',
  environment: 'dev',
  serverTime: '2026-10-20T08:15:00Z',
  database: { status: 'UP', version: '16.4', migrationsApplied: 10, latestMigration: '10' },
};

describe('SystemStatus', () => {
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SystemStatus],
      providers: [provideHttpClient(withInterceptors([problemDetailInterceptor])), provideHttpClientTesting()],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('shows a loading skeleton while the checks are in flight', () => {
    // HttpClient registers in-flight requests as pending tasks, so whenStable() would wait for them:
    // render synchronously here and only await stability after flushing.
    const fixture = TestBed.createComponent(SystemStatus);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(root.querySelector('button')?.disabled).toBe(true);

    controller.expectOne(PING);
    controller.expectOne(PROVINCES);
  });

  it('shows API, database and seed-data results once both requests succeed', async () => {
    const fixture = TestBed.createComponent(SystemStatus);
    controller.expectOne(PING).flush(info);
    controller.expectOne(PROVINCES).flush(new Array(7).fill({}));
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('resale-market-api v0.1.0');
    expect(text).toContain('PostgreSQL 16.4');
    expect(text).toContain('10 migrations');
    expect(text).toContain('7 provinces');
    expect(text).toContain('Nepal time');
    expect((fixture.nativeElement as HTMLElement).querySelector('.skeleton')).toBeNull();
  });

  it('flags a database that is down', async () => {
    const fixture = TestBed.createComponent(SystemStatus);
    controller.expectOne(PING).flush({ ...info, database: { status: 'DOWN', version: null, migrationsApplied: 0, latestMigration: null } });
    controller.expectOne(PROVINCES).flush([]);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('cannot reach PostgreSQL');
    expect(text).toContain('Missing');
  });

  it('shows the problem detail and allows retrying when the API fails', async () => {
    const fixture = TestBed.createComponent(SystemStatus);
    controller
      .expectOne(PING)
      .flush({ title: 'Service Unavailable', status: 503, detail: 'Database is unavailable.' }, { status: 503, statusText: 'Service Unavailable' });
    controller.match(PROVINCES).forEach((req) => req.cancelled || req.flush([]));
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Database is unavailable.');

    // "Check again" re-issues both requests.
    (root.querySelector('button') as HTMLButtonElement).click();
    controller.expectOne(PING).flush(info);
    controller.expectOne(PROVINCES).flush(new Array(7).fill({}));
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.textContent).toContain('7 provinces');
  });
});
