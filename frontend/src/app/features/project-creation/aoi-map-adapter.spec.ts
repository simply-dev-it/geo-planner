import Feature from 'ol/Feature.js';
import Map from 'ol/Map.js';
import type MapBrowserEvent from 'ol/MapBrowserEvent.js';
import type Event from 'ol/events/Event.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import { fromExtent } from 'ol/geom/Polygon.js';
import ExtentInteraction from 'ol/interaction/Extent.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import { transform } from 'ol/proj.js';
import XYZ from 'ol/source/XYZ.js';
import Style from 'ol/style/Style.js';
import { vi } from 'vitest';

import { AoiMapAdapter } from './aoi-map-adapter';

describe('AoiMapAdapter', () => {
  let target: HTMLElement;
  let adapter: AoiMapAdapter;
  let map: Map;
  let interaction: ExtentInteraction;
  let callbacks: {
    onPoint: ReturnType<typeof vi.fn<(point: [number, number]) => void>>;
    onExtentChanged: ReturnType<typeof vi.fn<(bounds: [number, number, number, number]) => void>>;
    onTileError: ReturnType<typeof vi.fn<() => void>>;
    onTileLoaded: ReturnType<typeof vi.fn<() => void>>;
    onDrawFinished: ReturnType<typeof vi.fn<() => void>>;
  };

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    target = document.createElement('div');
    document.body.append(target);
    callbacks = {
      onPoint: vi.fn(),
      onExtentChanged: vi.fn(),
      onTileError: vi.fn(),
      onTileLoaded: vi.fn(),
      onDrawFinished: vi.fn(),
    };
    const addInteraction = vi.spyOn(Map.prototype, 'addInteraction');
    adapter = new AoiMapAdapter(target, '/api/v1/map/layers/base/tiles/{z}/{x}/{y}', callbacks);
    map = addInteraction.mock.instances[0] as Map;
    interaction = map
      .getInteractions()
      .getArray()
      .find((item) => item instanceof ExtentInteraction)! as ExtentInteraction;
    addInteraction.mockRestore();
  });

  afterEach(() => {
    adapter.destroy();
    target.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses EPSG:2180 easting/northing and normalized same-origin XYZ tiles', () => {
    expect(map.getView().getProjection().getCode()).toBe('EPSG:2180');
    const center = transform([19, 52], 'EPSG:4326', 'EPSG:2180');
    expect(center[0]).toBeCloseTo(500000, 1);
    expect(center[1]).toBeCloseTo(459309.21, 0);
    const lonLat = transform(center, 'EPSG:2180', 'EPSG:4326');
    expect(lonLat[0]).toBeCloseTo(19, 6);
    expect(lonLat[1]).toBeCloseTo(52, 6);
    const tiles = (map.getLayers().item(0) as TileLayer<XYZ>).getSource()!;
    expect(tiles.getProjection()?.getCode()).toBe('EPSG:2180');
    expect(tiles.getTileGrid()?.getOrigin(0)).toEqual([-1000000, 2000000]);
    expect(tiles.getTileGrid()?.getResolution(3)).toBe(3000000 / (256 * 2 ** 3));
    expect(tiles.getTileUrlFunction()([3, 4, 2], 1, tiles.getProjection()!)).toBe(
      '/api/v1/map/layers/base/tiles/3/4/2',
    );
    expect(
      () => new AoiMapAdapter(target, 'https://example.test/{z}/{x}/{y}', callbacks),
    ).toThrow();
    expect(() => new AoiMapAdapter(target, '//example.test/{z}/{x}/{y}', callbacks)).toThrow();
    expect(() => new AoiMapAdapter(target, '/\n/example.test/{z}/{x}/{y}', callbacks)).toThrow();
  });

  it('renders parcels separately and replaces them without mutating input', () => {
    const coordinates: [number, number][][] = [
      [
        [100, 200],
        [150, 200],
        [150, 250],
        [100, 200],
      ],
    ];
    adapter.setParcels([
      {
        id: 'one',
        geometry: { type: 'Polygon', coordinates, crs: 'EPSG:2180', axisOrder: 'easting-northing' },
      },
    ]);
    const source = (map.getLayers().item(1) as VectorLayer).getSource()!;
    expect(source.getFeatureById('one')?.getGeometry()?.getExtent()).toEqual([100, 200, 150, 250]);
    adapter.setParcels([
      {
        id: 'two',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [coordinates],
          crs: 'EPSG:2180',
          axisOrder: 'easting-northing',
        },
      },
    ]);
    expect(source.getFeatureById('one')).toBeNull();
    expect(source.getFeatureById('two')?.getGeometry()?.getExtent()).toEqual([100, 200, 150, 250]);
    expect(coordinates[0][0]).toEqual([100, 200]);
    expect(() =>
      adapter.setParcels([
        {
          id: 'bad',
          geometry: {
            type: 'Polygon',
            coordinates,
            crs: 'EPSG:4326',
            axisOrder: 'easting-northing',
          },
        } as never,
      ]),
    ).toThrow();
    expect(source.getFeatureById('two')).not.toBeNull();
    expect(() =>
      adapter.setParcels([
        {
          id: 'open',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
              ],
            ],
            crs: 'EPSG:2180',
            axisOrder: 'easting-northing',
          },
        },
      ]),
    ).toThrow();
    expect(source.getFeatureById('two')).not.toBeNull();
  });

  it('renders suggested geometry separately from selected parcels', () => {
    const parcel = {
      id: 'suggested',
      geometry: {
        type: 'Polygon' as const,
        crs: 'EPSG:2180' as const,
        axisOrder: 'easting-northing' as const,
        coordinates: [
          [
            [10, 20],
            [30, 20],
            [30, 40],
            [10, 40],
            [10, 20],
          ],
        ] as [number, number][][],
      },
    };
    adapter.setSuggestedParcels([parcel]);
    const selected = (map.getLayers().item(1) as VectorLayer).getSource()!;
    const suggested = (map.getLayers().item(2) as VectorLayer).getSource()!;
    expect(selected.getFeatures()).toHaveLength(0);
    expect(suggested.getFeatureById(parcel.id)?.getGeometry()?.getExtent()).toEqual([
      10, 20, 30, 40,
    ]);
    adapter.setParcels([parcel]);
    adapter.setSuggestedParcels([]);
    expect(selected.getFeatureById(parcel.id)).toBeTruthy();
    expect(suggested.getFeatures()).toHaveLength(0);
    expect(parcel.geometry.coordinates[0][0]).toEqual([10, 20]);
  });

  it('renders eight handles and safely handles a cleared extent', () => {
    const overlay = (interaction as unknown as { extentOverlay_: VectorLayer }).extentOverlay_;
    const styles = overlay.getStyle() as Style[];
    const handles = styles[1].getGeometryFunction();
    expect(handles(new Feature())).toBeUndefined();
    const geometry = handles(new Feature(fromExtent([10, 20, 30, 40]))) as MultiPoint;
    expect(geometry.getCoordinates()).toEqual([
      [10, 20],
      [20, 20],
      [30, 20],
      [30, 30],
      [30, 40],
      [20, 40],
      [10, 40],
      [10, 30],
    ]);
    adapter.setExtent([10, 20, 30, 40]);
    adapter.setEditingEnabled(false);
    expect(handles(new Feature(fromExtent([10, 20, 30, 40])))).toBeUndefined();
    expect(interaction.getExtent()).toEqual([10, 20, 30, 40]);
    expect(callbacks.onExtentChanged).not.toHaveBeenCalled();
    adapter.setEditingEnabled(true);
    expect(handles(new Feature(fromExtent([10, 20, 30, 40])))).toBeInstanceOf(MultiPoint);
  });

  it('colors invalid area outlines red and restores blue after correction', () => {
    const overlay = (interaction as unknown as { extentOverlay_: VectorLayer }).extentOverlay_;
    const styles = overlay.getStyle() as Style[];
    adapter.setExtent([100000, 200000, 103000, 200300]);
    expect(styles[0].getStroke()!.getColor()).toBe('#b42318');
    adapter.setExtent([100000, 200000, 100400, 200300]);
    expect(styles[0].getStroke()!.getColor()).toBe('#006ebe');
    expect(callbacks.onExtentChanged).not.toHaveBeenCalled();
  });
  it('clips the saved project frame and constrains zoom and panning to it', () => {
    map.setSize([800, 600]);
    const bounds: [number, number, number, number] = [100000, 200000, 100400, 200300];
    adapter.setProjectFrame(bounds);
    map.getLayers().forEach((layer) => expect(layer.getExtent()).toEqual(bounds));
    const view = map.getView();
    const fitted = view.getResolution()!;
    view.setResolution(fitted * 100);
    expect(view.getResolution()).toBeLessThanOrEqual(fitted);
    view.setCenter([500000, 500000]);
    expect(view.getCenter()![0]).toBeLessThanOrEqual(bounds[2]);
    expect(view.getCenter()![1]).toBeLessThanOrEqual(bounds[3]);
    expect(interaction.getExtent()).toBeNull();
    expect(interaction.getActive()).toBe(false);
  });
  it('draws and resizes rectangles, restoring zero-area edits without notifying', () => {
    const mapInternals = map as unknown as {
      getCoordinateFromPixelInternal(pixel: number[]): number[];
      getPixelFromCoordinateInternal(coordinate: number[]): number[];
    };
    vi.spyOn(mapInternals, 'getCoordinateFromPixelInternal').mockImplementation((pixel) => pixel);
    vi.spyOn(mapInternals, 'getPixelFromCoordinateInternal').mockImplementation(
      (coordinate) => coordinate,
    );
    const pointer = interaction as unknown as {
      handleDownEvent(event: MapBrowserEvent): boolean;
      handleDragEvent(event: MapBrowserEvent): void;
      handleUpEvent(event: MapBrowserEvent): boolean;
    };
    const event = (coordinate: number[]) =>
      ({ map, pixel: coordinate, coordinate }) as MapBrowserEvent;

    adapter.startDraw();
    expect(pointer.handleDownEvent(event([100, 200]))).toBe(true);
    pointer.handleDragEvent(event([200, 300]));
    expect(callbacks.onExtentChanged).not.toHaveBeenCalled();
    pointer.handleUpEvent(event([200, 300]));
    expect(callbacks.onExtentChanged).toHaveBeenLastCalledWith([100, 200, 200, 300]);

    expect(pointer.handleDownEvent(event([200, 300]))).toBe(true);
    pointer.handleDragEvent(event([240, 350]));
    pointer.handleUpEvent(event([240, 350]));
    expect(callbacks.onExtentChanged).toHaveBeenLastCalledWith([100, 200, 240, 350]);
    expect(pointer.handleDownEvent(event([240, 350]))).toBe(true);
    pointer.handleDragEvent(event([100, 200]));
    pointer.handleUpEvent(event([100, 200]));
    expect(interaction.getExtent()).toEqual([100, 200, 240, 350]);
    expect(callbacks.onExtentChanged).toHaveBeenCalledTimes(2);
    adapter.setExtent([10, 20, 30, 40]);
    expect(callbacks.onExtentChanged).toHaveBeenCalledTimes(2);
  });

  it('restores a previous rectangle when drawing is cancelled by a click', () => {
    adapter.setExtent([10, 20, 30, 40]);
    const mapInternals = map as unknown as {
      getCoordinateFromPixelInternal(pixel: number[]): number[];
    };
    vi.spyOn(mapInternals, 'getCoordinateFromPixelInternal').mockImplementation((pixel) => pixel);
    const pointer = interaction as unknown as {
      handleDownEvent(event: MapBrowserEvent): boolean;
      handleUpEvent(event: MapBrowserEvent): boolean;
    };
    const event = { map, pixel: [100, 200], coordinate: [100, 200] } as MapBrowserEvent;
    adapter.startDraw();
    expect(pointer.handleDownEvent(event)).toBe(true);
    pointer.handleUpEvent(event);
    expect(interaction.getExtent()).toEqual([10, 20, 30, 40]);
    expect(callbacks.onDrawFinished).toHaveBeenCalledTimes(1);
    map.dispatchEvent({ type: 'click', coordinate: [100, 200] } as unknown as Event);
    expect(callbacks.onPoint).not.toHaveBeenCalled();
    expect(callbacks.onExtentChanged).not.toHaveBeenCalled();
    map.dispatchEvent({ type: 'click', coordinate: [500, 600] } as unknown as Event);
    expect(callbacks.onPoint).toHaveBeenCalledWith([500, 600]);
  });

  it('forwards clicks and tile errors and detaches listeners on destroy', () => {
    const tiles = (map.getLayers().item(0) as TileLayer<XYZ>).getSource()!;
    const click = { type: 'click', coordinate: [500000, 459309] } as unknown as Event;
    map.dispatchEvent(click);
    tiles.dispatchEvent('tileloaderror');
    tiles.dispatchEvent('tileloadend');
    expect(callbacks.onPoint).toHaveBeenCalledWith([500000, 459309]);
    expect(callbacks.onTileError).toHaveBeenCalledTimes(1);
    expect(callbacks.onTileLoaded).toHaveBeenCalledTimes(1);
    adapter.destroy();
    expect(map.getTarget()).toBeNull();
    map.dispatchEvent(click);
    tiles.dispatchEvent('tileloaderror');
    tiles.dispatchEvent('tileloadend');
    expect(callbacks.onPoint).toHaveBeenCalledTimes(1);
    expect(callbacks.onTileError).toHaveBeenCalledTimes(1);
    expect(callbacks.onTileLoaded).toHaveBeenCalledTimes(1);
  });
});
