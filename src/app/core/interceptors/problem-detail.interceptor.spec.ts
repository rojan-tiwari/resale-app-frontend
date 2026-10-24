import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../models/api-error';
import { problemDetailInterceptor } from './problem-detail.interceptor';

describe('problemDetailInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([problemDetailInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('passes successful responses through untouched', () => {
    let result: unknown;
    http.get('/api/v1/ok').subscribe((value) => (result = value));

    controller.expectOne('/api/v1/ok').flush({ hello: 'world' });

    expect(result).toEqual({ hello: 'world' });
  });

  it('turns failed responses into ApiError', () => {
    let caught: unknown;
    http.get('/api/v1/missing').subscribe({ error: (e: unknown) => (caught = e) });

    controller
      .expectOne('/api/v1/missing')
      .flush(
        { title: 'Not Found', status: 404, detail: 'Listing 42 does not exist', code: 'LISTING_NOT_FOUND' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).isNotFound).toBe(true);
    expect((caught as ApiError).code).toBe('LISTING_NOT_FOUND');
    expect((caught as ApiError).message).toBe('Listing 42 does not exist');
  });
});
