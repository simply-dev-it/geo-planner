import {
  boundsOfCoordinates,
  centeredArea,
  parcelNumber,
  proposedWorkingArea,
  roundMapBounds,
  validWorkingArea,
} from './working-area';

describe('working area', () => {
  it('accepts the exact limit and rejects excessive, inverted and non-finite bounds', () => {
    expect(validWorkingArea([0, 0, 2000, 2000])).toBe(true);
    expect(validWorkingArea([0, 0, 2000.01, 100])).toBe(false);
    expect(validWorkingArea([0, 0, 0, 100])).toBe(false);
    expect(validWorkingArea([100, 0, 0, 100])).toBe(false);
    expect(validWorkingArea([0, 0, Infinity, 100])).toBe(false);
  });

  it('finds bounds without changing geometry and adds 100 metres of context', () => {
    const coordinates = [
      [
        [100, 200],
        [150, 200],
        [150, 240],
        [100, 200],
      ],
    ];
    const bounds = boundsOfCoordinates(coordinates);
    expect(bounds).toEqual([100, 200, 150, 240]);
    expect(proposedWorkingArea(bounds!)).toEqual([0, 100, 250, 340]);
    expect(coordinates[0][0]).toEqual([100, 200]);
  });

  it('rejects empty or malformed coordinates', () => {
    expect(boundsOfCoordinates([])).toBeNull();
    expect(boundsOfCoordinates([[[100, NaN]]])).toBeNull();
    expect(
      boundsOfCoordinates([
        [
          [100, 200],
          ['bad', 4],
        ],
      ]),
    ).toBeNull();
  });

  it('rounds map coordinates to millimetres and rejects over-precise typed bounds', () => {
    expect(roundMapBounds([100000.12345, 200000.11119, 100100.12345, 200100.11119])).toEqual([
      100000.123, 200000.111, 100100.123, 200100.111,
    ]);
    expect(validWorkingArea([100000.12345, 200000, 100100, 200100])).toBe(false);
  });
  it('fits all selected extents with the requested buffer and retains fractional parcel numbers', () => {
    const bounds = boundsOfCoordinates([
      [
        [
          [0, 0],
          [10, 0],
          [10, 20],
          [0, 0],
        ],
      ],
      [
        [
          [100, 50],
          [110, 50],
          [110, 70],
          [100, 50],
        ],
      ],
    ]);
    expect(proposedWorkingArea(bounds!, 200)).toEqual([-200, -200, 310, 270]);
    expect(proposedWorkingArea(bounds!, 0)).toEqual([0, 0, 110, 70]);
    expect(() => proposedWorkingArea(bounds!, -1)).toThrow();
    expect(centeredArea([100, 200], 80, 60)).toEqual([60, 170, 140, 230]);
    expect(parcelNumber('999999_9.9999.101/1')).toBe('101/1');
  });
});
