import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Recargas } from './recargas';

describe('Recargas', () => {
  let component: Recargas;
  let fixture: ComponentFixture<Recargas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Recargas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Recargas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
