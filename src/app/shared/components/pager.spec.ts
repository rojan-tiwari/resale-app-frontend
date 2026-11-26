import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pager } from './pager';

@Component({
  imports: [Pager],
  template: `<app-pager [page]="page()" [totalPages]="total()" (pageChange)="page.set($event)" />`,
})
class Host {
  readonly page = signal(0);
  readonly total = signal(3);
}

describe('Pager', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;

  const button = (text: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === text,
    );

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('shows the page for people (from 1) while the API counts from 0', () => {
    expect(root.textContent).toContain('Page 1 of 3');
  });

  it('cannot go before the first or after the last page', () => {
    expect(button('Previous')?.disabled).toBe(true);
    expect(button('Next')?.disabled).toBe(false);

    fixture.componentInstance.page.set(2);
    fixture.detectChanges();
    expect(button('Previous')?.disabled).toBe(false);
    expect(button('Next')?.disabled).toBe(true);
  });

  it('asks for the neighbouring page', () => {
    button('Next')?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.page()).toBe(1);
    expect(root.textContent).toContain('Page 2 of 3');

    button('Previous')?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.page()).toBe(0);
  });

  it('shows nothing at all for a single page or for none', () => {
    fixture.componentInstance.total.set(1);
    fixture.detectChanges();
    expect(root.querySelector('nav')).toBeNull();

    fixture.componentInstance.total.set(0);
    fixture.detectChanges();
    expect(root.querySelector('nav')).toBeNull();
  });
});
