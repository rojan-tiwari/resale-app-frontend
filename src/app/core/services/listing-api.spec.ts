import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { listing, pageOf, photo, summary } from '../../testing/listing-fixtures';
import { API_BASE_URL } from '../config/api-config';
import { ListingRequest } from '../models/listing';
import { ListingApi } from './listing-api';

const ID = '0b8f0a54-6a52-4d3c-9f43-0a3d4a8d6c11';

const request: ListingRequest = {
  title: 'iPhone 13',
  description: 'Bought last year, no scratches.',
  price: 85000,
  priceType: 'NEGOTIABLE',
  condition: 'LIKE_NEW',
  categoryId: 1,
  subcategoryId: 15,
  provinceId: 3,
  districtId: 30,
  municipalityId: null,
  locality: null,
};

describe('ListingApi', () => {
  let api: ListingApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/test/api' },
      ],
    });
    api = TestBed.inject(ListingApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('create posts the request to {base}/listings', () => {
    api.create(request).subscribe();

    const call = controller.expectOne('/test/api/listings');
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual(request);
    call.flush(listing({ status: 'DRAFT' }));
  });

  it('get, update and archive address one listing by id', () => {
    api.get(ID).subscribe();
    controller.expectOne(`/test/api/listings/${ID}`).flush(listing());

    api.update(ID, request).subscribe();
    const put = controller.expectOne(`/test/api/listings/${ID}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(request);
    put.flush(listing());

    api.archive(ID).subscribe();
    const del = controller.expectOne(`/test/api/listings/${ID}`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('puts an id from outside safely into the address', () => {
    api.get('../admin?x=1').subscribe();

    controller.expectOne('/test/api/listings/..%2Fadmin%3Fx%3D1').flush(listing());
  });

  it('changeStatus patches {base}/listings/{id}/status', () => {
    api.changeStatus(ID, { status: 'SOLD', reason: null }).subscribe();

    const call = controller.expectOne(`/test/api/listings/${ID}/status`);
    expect(call.request.method).toBe('PATCH');
    expect(call.request.body).toEqual({ status: 'SOLD', reason: null });
    call.flush(listing({ status: 'SOLD' }));
  });

  it('mine sends only the filters that are set', () => {
    api.mine().subscribe();
    controller.expectOne('/test/api/listings/mine').flush(pageOf([]));

    api.mine({ status: 'DRAFT', page: 2, size: 10 }).subscribe();
    controller
      .expectOne('/test/api/listings/mine?page=2&size=10&status=DRAFT')
      .flush(pageOf([summary()]));

    api.mine({ status: null, page: 0 }).subscribe();
    controller.expectOne('/test/api/listings/mine?page=0').flush(pageOf([]));
  });

  it('ofSeller reads the public list of a member', () => {
    api.ofSeller('11111111-2222-3333-4444-555555555555', { page: 1, size: 12 }).subscribe();

    const call = controller.expectOne(
      '/test/api/users/11111111-2222-3333-4444-555555555555/listings?page=1&size=12',
    );
    expect(call.request.method).toBe('GET');
    call.flush(pageOf([]));
  });

  it('similar asks for a limited number of listings', () => {
    api.similar(ID).subscribe();
    controller.expectOne(`/test/api/listings/${ID}/similar?limit=8`).flush([]);

    api.similar(ID, 3).subscribe();
    controller.expectOne(`/test/api/listings/${ID}/similar?limit=3`).flush([]);
  });

  it('uploadImages sends every file in the `images` part of one multipart request', () => {
    const first = new File(['a'], 'front.jpg', { type: 'image/jpeg' });
    const second = new File(['b'], 'back.png', { type: 'image/png' });
    api.uploadImages(ID, [first, second]).subscribe();

    const call = controller.expectOne(`/test/api/listings/${ID}/images`);
    expect(call.request.method).toBe('POST');
    const body = call.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const sent = body.getAll('images') as File[];
    expect(sent.map((file) => file.name)).toEqual(['front.jpg', 'back.png']);
    // The browser must set the multipart Content-Type itself (it adds the boundary); setting it here would break the upload.
    expect(call.request.headers.has('Content-Type')).toBe(false);
    call.flush([photo('a', 0), photo('b', 1)]);
  });

  it('deleteImage and reorderImages address the photos of one listing', () => {
    api.deleteImage(ID, 'img-9').subscribe();
    const del = controller.expectOne(`/test/api/listings/${ID}/images/img-9`);
    expect(del.request.method).toBe('DELETE');
    del.flush([]);

    api.reorderImages(ID, ['b', 'a']).subscribe();
    const put = controller.expectOne(`/test/api/listings/${ID}/images/order`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ imageIds: ['b', 'a'] });
    put.flush([photo('b', 0), photo('a', 1)]);
  });

  describe('discovery', () => {
    it('search sends only what is set', () => {
      api.search().subscribe();
      controller.expectOne('/test/api/listings').flush(pageOf([]));

      api
        .search({
          q: 'iphone 13',
          categoryId: 1,
          minPrice: 1000,
          sort: 'priceAsc',
          page: 2,
          size: 24,
        })
        .subscribe();
      const call = controller.expectOne(
        '/test/api/listings?q=iphone%2013&categoryId=1&minPrice=1000&sort=priceAsc&page=2&size=24',
      );
      expect(call.request.method).toBe('GET');
      call.flush(pageOf([summary()]));
    });

    it('search repeats the condition parameter and sends negotiable only when it is on', () => {
      api
        .search({ condition: ['GOOD', 'LIKE_NEW'], negotiable: true, postedWithinDays: 7 })
        .subscribe();
      controller
        .expectOne(
          '/test/api/listings?condition=GOOD&condition=LIKE_NEW&negotiable=true&postedWithinDays=7',
        )
        .flush(pageOf([]));

      api.search({ negotiable: false, condition: [] }).subscribe();
      controller.expectOne('/test/api/listings').flush(pageOf([]));
    });

    it('search sends every location and price parameter, including a price of 0', () => {
      api
        .search({
          provinceId: 3,
          districtId: 30,
          municipalityId: 1,
          subcategoryId: 15,
          minPrice: 0,
          maxPrice: 500,
        })
        .subscribe();
      controller
        .expectOne(
          '/test/api/listings?subcategoryId=15&minPrice=0&maxPrice=500&provinceId=3&districtId=30&municipalityId=1',
        )
        .flush(pageOf([]));
    });

    it('search does not send a blank keyword', () => {
      api.search({ q: '' }).subscribe();
      controller.expectOne('/test/api/listings').flush(pageOf([]));
    });

    it('featured, recent and recommended take a limit', () => {
      api.featured().subscribe();
      controller.expectOne('/test/api/listings/featured?limit=8').flush([]);
      api.recent(4).subscribe();
      controller.expectOne('/test/api/listings/recent?limit=4').flush([]);
      let basis = '';
      api.recommended(6).subscribe((result) => (basis = result.basis));
      controller
        .expectOne('/test/api/listings/recommended?limit=6')
        .flush({ basis: 'POPULAR', listings: [] });
      expect(basis).toBe('POPULAR');
    });
  });
});
