import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SimulatorConnection } from './simulator-connection';
describe('Production simulator isolation', () => {
  it('never probes or exposes simulator facilities in the normal build', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(SimulatorConnection);
    const http = TestBed.inject(HttpTestingController);
    service.show();
    expect(service.connected()).toBe(false);
    expect(service.open()).toBe(false);
    http.expectNone('/_simulator/health');
    http.expectNone('/_simulator/catalog');
    http.verify();
  });
});
