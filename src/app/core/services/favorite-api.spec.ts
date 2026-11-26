import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { pageOf, summary } from '../../testing/listing-fixtures';
import { API_BASE_URL } from '../config/api-config';
import { FavoriteApi } from './favorite-api';

const ID = '0b8f0a54-6a52-4d3c-9f43-0a3d4a8d6c11';

describe('FavoriteApi', () => {
  let api: FavoriteApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/test/api' },
      ],
    });
    api = TestBed.inject(FavoriteApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('list asks for a page of saved ads', () => {
    api.list(1, 12).subscribe();

    const call = controller.expectOne('/test/api/favorites?page=1&size=12');
    expect(call.request.method).toBe('GET');
    call.flush(
      pageOf([
        { listingId: ID, savedAt: '2026-11-20T10:00:00Z', available: true, listing: summary() },
      ]),
    );
  });

  it('ids calls GET {base}/favorites/ids', () => {
    let ids: string[] = [];
    api.ids().subscribe((value) => (ids = value));

    controller.expectOne('/test/api/favorites/ids').flush([ID]);

    expect(ids).toEqual([ID]);
  });

  it("add posts to the listing's own address with no body", () => {
    api.add(ID).subscribe();

    const call = controller.expectOne(`/test/api/favorites/${ID}`);
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toBeNull();
    call.flush({
      listingId: ID,
      savedAt: '2026-11-20T10:00:00Z',
      available: true,
      listing: summary(),
    });
  });

  it('remove deletes it', () => {
    api.remove(ID).subscribe();

    const call = controller.expectOne(`/test/api/favorites/${ID}`);
    expect(call.request.method).toBe('DELETE');
    call.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('puts an id from outside safely into the address', () => {
    api.remove('../x?y=1').subscribe();

    controller
      .expectOne('/test/api/favorites/..%2Fx%3Fy%3D1')
      .flush(null, { status: 204, statusText: 'No Content' });
  });
});
