import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-config';
import { ChangePasswordRequest } from '../models/auth';
import { PublicUser, UpdateProfileRequest, User } from '../models/user';
import { UserApi } from './user-api';

const account: User = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  email: 'sita@example.com',
  displayName: 'Sita Sharma',
  phone: '+9779812345678',
  showPhone: true,
  bio: 'I sell books',
  provinceId: 3,
  districtId: 25,
  municipalityId: 1,
  createdAt: '2026-10-20T08:15:00Z',
  roles: ['ROLE_USER'],
};

describe('UserApi', () => {
  let api: UserApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/test/api' },
      ],
    });
    api = TestBed.inject(UserApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('me calls GET {base}/users/me and returns the account', () => {
    let result: User | undefined;
    api.me().subscribe((value) => (result = value));

    const request = controller.expectOne('/test/api/users/me');
    expect(request.request.method).toBe('GET');
    request.flush(account);

    expect(result).toEqual(account);
  });

  it('updateMe puts the whole profile to {base}/users/me', () => {
    const form: UpdateProfileRequest = {
      displayName: 'Sita Sharma',
      phone: '9812345678',
      showPhone: true,
      bio: 'I sell books',
      provinceId: 3,
      districtId: 25,
      municipalityId: 1,
    };
    let result: User | undefined;
    api.updateMe(form).subscribe((value) => (result = value));

    const request = controller.expectOne('/test/api/users/me');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(form);
    request.flush(account);

    expect(result).toEqual(account);
  });

  it('changePassword puts both passwords to {base}/users/me/password', () => {
    const body: ChangePasswordRequest = {
      currentPassword: 'old password',
      newPassword: 'a brand new password',
    };
    let completed = false;
    api.changePassword(body).subscribe({ complete: () => (completed = true) });

    const request = controller.expectOne('/test/api/users/me/password');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('publicProfile calls GET {base}/users/{id} and encodes the id', () => {
    const member: PublicUser = {
      id: account.id,
      displayName: 'Sita Sharma',
      bio: null,
      memberSince: '2026-10-20T08:15:00Z',
      location: { province: 'Bagmati', district: null, municipality: null },
      phone: null,
    };
    let result: PublicUser | undefined;
    api.publicProfile(account.id).subscribe((value) => (result = value));

    const request = controller.expectOne(`/test/api/users/${account.id}`);
    expect(request.request.method).toBe('GET');
    request.flush(member);
    expect(result).toEqual(member);

    api.publicProfile('a/b?c').subscribe();
    controller.expectOne('/test/api/users/a%2Fb%3Fc').flush(member);
  });
});
