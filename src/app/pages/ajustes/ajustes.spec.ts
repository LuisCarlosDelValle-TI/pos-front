import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ajustes } from './ajustes';

describe('Ajustes', () => {
  let component: Ajustes;
  let fixture: ComponentFixture<Ajustes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ajustes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Ajustes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
