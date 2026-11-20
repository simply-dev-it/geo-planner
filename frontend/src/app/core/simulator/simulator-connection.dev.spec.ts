import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SimulatorConnection, SIMULATOR_BUILD } from './simulator-connection';

describe('Development simulator connection', () => {
  it('requires a positive health response and closes the catalogue when the simulator fails', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SIMULATOR_BUILD, useValue: true },
      ],
    });
    const service = TestBed.inject(SimulatorConnection),
      http = TestBed.inject(HttpTestingController);
    expect(service.connected()).toBe(false);
    http.expectOne('/_simulator/health').flush({
      service: 'geo-planner-contract-simulator',
      status: 'ready',
      mode: 'offline-fixtures',
    });
    expect(service.connected()).toBe(true);
    service.show();
    http
      .expectOne('/_simulator/catalog')
      .flush({ parcels: [{ id: 'one', parcelNumber: '101/1', contextLabel: 'Brzozowo' }] });
    expect(service.open()).toBe(true);
    service.show();
    http.expectOne('/_simulator/catalog').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.connected()).toBe(false);
    expect(service.open()).toBe(false);
    http.verify();
  });
});
