import { TestBed } from '@angular/core/testing';
import { SearchPanel, type SearchState, type LookupStage } from './search-panel';

describe('SearchPanel guided lookup', () => {
  it('shows one input at a time and emits explicit address-number intent', async () => {
    const fixture = TestBed.createComponent(SearchPanel);
    fixture.componentRef.setInput('stage', 'house');
    fixture.componentRef.setInput('initial', {
      query: '',
      type: 'address',
      regionId: '',
      placeText: 'Brzozowo',
      streetText: 'Lipowa',
    });
    const requests: SearchState[] = [];
    fixture.componentInstance.requested.subscribe((value) => requests.push(value));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const inputs = element.querySelectorAll<HTMLInputElement>('input');
    expect(inputs).toHaveLength(1);
    expect(element.textContent).toContain('Numer budynku');
    expect(element.querySelector('.search-guidance')?.textContent).toContain('wybranej ulicy');
    inputs[0].value = '1';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      type: 'address',
      query: '1',
      placeText: 'Brzozowo',
      streetText: 'Lipowa',
    });
  });
  it('keeps house and parcel choices explicit and supports skipping the number', async () => {
    const fixture = TestBed.createComponent(SearchPanel);
    fixture.componentRef.setInput('stage', 'number');
    fixture.componentRef.setInput('streetLabel', 'Lipowa');
    const stages: LookupStage[] = [];
    let skipped = 0;
    fixture.componentInstance.stageChanged.subscribe((stage) => stages.push(stage));
    fixture.componentInstance.mapSelectionRequested.subscribe(() => skipped++);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('input')).toHaveLength(0);
    const buttons = Array.from(el.querySelectorAll('button'));
    buttons.find((b) => b.textContent?.includes('Numer budynku'))?.click();
    buttons.find((b) => b.textContent?.includes('Krótki numer działki'))?.click();
    buttons.find((b) => b.textContent?.includes('Pomiń numer'))?.click();
    expect(stages).toEqual(['house', 'parcel']);
    expect(skipped).toBe(1);
  });
});
