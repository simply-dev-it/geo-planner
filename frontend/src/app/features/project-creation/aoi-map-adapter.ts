import Feature from 'ol/Feature.js';
import { validWorkingArea } from './working-area';
import Map from 'ol/Map.js';
import type MapBrowserEvent from 'ol/MapBrowserEvent.js';
import View from 'ol/View.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import Polygon from 'ol/geom/Polygon.js';
import ExtentInteraction from 'ol/interaction/Extent.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import { get as getProjection, transform } from 'ol/proj.js';
import { register } from 'ol/proj/proj4.js';
import VectorSource from 'ol/source/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Style from 'ol/style/Style.js';
import { unByKey } from 'ol/Observable.js';
import type { EventsKey } from 'ol/events.js';
import proj4 from 'proj4';

type Point = [number, number];
type Bounds = [number, number, number, number];
interface Parcel {
  id: string;
  geometry: { crs: 'EPSG:2180'; axisOrder: 'easting-northing' } & (
    { type: 'Polygon'; coordinates: Point[][] } | { type: 'MultiPolygon'; coordinates: Point[][][] }
  );
}
interface Callbacks {
  onPoint(point: Point): void;
  onParcelToggle?(id: string): void;
  onViewportChanged?(bounds: Bounds): void;
  onRenderComplete?(): void;
  onExtentChanged(bounds: Bounds): void;
  onTileError(): void;
  onTileLoaded?(): void;
  onDrawFinished?(): void;
}

proj4.defs(
  'EPSG:2180',
  '+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs +type=crs',
);
register(proj4);

const projection = getProjection('EPSG:2180')!;
projection.setExtent([-1000000, -1000000, 2000000, 2000000]);

const boxStyle = new Style({
  fill: new Fill({ color: 'rgba(0, 110, 190, 0.12)' }),
  stroke: new Stroke({ color: '#006ebe', width: 2 }),
});
const handleStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: '#fff' }),
    stroke: new Stroke({ color: '#006ebe', width: 2 }),
  }),
  geometry: (feature) => {
    const geometry = feature.getGeometry();
    if (!geometry) return undefined;
    const [minX, minY, maxX, maxY] = geometry.getExtent();
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    return new MultiPoint([
      [minX, minY],
      [midX, minY],
      [maxX, minY],
      [maxX, midY],
      [maxX, maxY],
      [midX, maxY],
      [minX, maxY],
      [minX, midY],
    ]);
  },
});

function validPolygon(coordinates: Point[][]): boolean {
  return (
    Array.isArray(coordinates) &&
    coordinates.length > 0 &&
    coordinates.every(
      (ring) =>
        Array.isArray(ring) &&
        ring.length >= 4 &&
        ring.every(
          (point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite),
        ) &&
        ring[0][0] === ring[ring.length - 1][0] &&
        ring[0][1] === ring[ring.length - 1][1],
    )
  );
}

class RectangleInteraction extends ExtentInteraction {
  private beforeDrag: number[] | null = null;
  private dragged = false;

  constructor(
    canDraw: () => boolean,
    private readonly finished: (bounds: number[] | null, dragged: boolean) => void,
    styles: Style[],
  ) {
    super({ createCondition: canDraw, boxStyle: styles });
  }

  protected override handleDownEvent(event: MapBrowserEvent): boolean {
    this.beforeDrag = this.getExtent()?.slice() ?? null;
    this.dragged = false;
    return super.handleDownEvent(event);
  }

  protected override handleDragEvent(event: MapBrowserEvent): void {
    this.dragged = true;
    super.handleDragEvent(event);
  }

  protected override handleUpEvent(event: MapBrowserEvent): boolean {
    const result = super.handleUpEvent(event);
    const extent = this.getExtent();
    if (!extent && this.beforeDrag) this.setExtent(this.beforeDrag);
    this.finished(extent, this.dragged);
    return result;
  }
}

// The host application must load ol/ol.css globally for OpenLayers controls.
export class AoiMapAdapter {
  private readonly map: Map;
  private readonly parcels = new VectorSource();
  private readonly suggestions = new VectorSource();
  private readonly contextParcels = new VectorSource();
  private readonly tiles: XYZ;
  private readonly rectangle: RectangleInteraction;
  private readonly listeners: EventsKey[];
  private drawing = false;
  private previousExtent: Bounds | null = null;
  private suppressClick = false;
  private destroyed = false;
  private editingEnabled = true;
  private readonly areaBox = boxStyle.clone();
  private readonly areaHandles = handleStyle.clone();

  constructor(
    target: HTMLElement,
    tileUrl: string,
    private readonly callbacks: Callbacks,
  ) {
    if (
      !/^\/(?!\/)[^\s\\?#]*$/.test(tileUrl) ||
      !['{z}', '{x}', '{y}'].every((part) => tileUrl.includes(part))
    ) {
      throw new Error('Tile URL must be a same-origin XYZ path');
    }

    this.tiles = new XYZ({ url: tileUrl, projection, tileSize: 256, wrapX: false, maxZoom: 18 });
    const handles = this.areaHandles;
    handles.setGeometry((feature) =>
      this.editingEnabled ? handleStyle.getGeometryFunction()(feature) : undefined,
    );
    this.rectangle = new RectangleInteraction(
      () => this.drawing,
      (extent, dragged) => {
        if (!dragged) this.suppressClick = true;
        if (extent && dragged) {
          this.drawing = false;
          this.previousExtent = null;
          this.callbacks.onExtentChanged([extent[0], extent[1], extent[2], extent[3]]);
        } else if (this.drawing) {
          this.drawing = false;
          this.rectangle.setExtent(this.previousExtent?.slice() ?? null);
          this.previousExtent = null;
        }
        this.callbacks.onDrawFinished?.();
      },
      [this.areaBox, handles],
    );
    this.map = new Map({
      target,
      layers: [
        new TileLayer({ source: this.tiles }),
        new VectorLayer({
          source: this.parcels,
          zIndex: 2,
          style: new Style({
            fill: new Fill({ color: 'rgba(255, 164, 0, 0.15)' }),
            stroke: new Stroke({ color: '#a65b00', width: 2 }),
          }),
        }),
        new VectorLayer({
          source: this.suggestions,
          zIndex: 1,
          style: new Style({
            fill: new Fill({ color: 'rgba(0, 128, 110, 0.08)' }),
            stroke: new Stroke({ color: '#00806e', width: 2, lineDash: [6, 4] }),
          }),
        }),
        new VectorLayer({
          source: this.contextParcels,
          zIndex: 0.5,
          style: new Style({
            fill: new Fill({ color: 'rgba(60, 90, 60, 0.035)' }),
            stroke: new Stroke({ color: 'rgba(65, 90, 65, 0.5)', width: 1 }),
          }),
        }),
      ],
      view: new View({
        projection,
        center: transform([19, 52], 'EPSG:4326', projection),
        zoom: 2,
        maxZoom: 18,
        enableRotation: false,
      }),
    });
    this.map.addInteraction(this.rectangle);
    this.listeners = [
      this.map.on('click', (event) => {
        if (this.suppressClick) {
          this.suppressClick = false;
        } else if (!this.drawing && this.editingEnabled) {
          const selected = this.parcels
            .getFeatures()
            .find((f) => f.getGeometry()?.intersectsCoordinate(event.coordinate));
          if (selected && this.callbacks.onParcelToggle) {
            this.callbacks.onParcelToggle(String(selected.getId()));
            return;
          }
          this.callbacks.onPoint([event.coordinate[0], event.coordinate[1]]);
        }
      }),
      this.map.on('moveend', () => {
        const size = this.map.getSize();
        if (!size) return;
        const extent = this.map.getView().calculateExtent(size);
        this.callbacks.onViewportChanged?.([extent[0], extent[1], extent[2], extent[3]]);
      }),
      this.map.on('rendercomplete', () => this.callbacks.onRenderComplete?.()),
      this.tiles.on('tileloaderror', () => this.callbacks.onTileError()),
      this.tiles.on('tileloadend', () => this.callbacks.onTileLoaded?.()),
    ];
  }

  setExtent(bounds: Bounds | null): void {
    this.drawing = false;
    this.previousExtent = null;
    const invalid = !!bounds && !validWorkingArea(bounds);
    const color = invalid ? '#b42318' : '#006ebe';
    this.areaBox.getStroke()!.setColor(color);
    this.areaBox
      .getFill()!
      .setColor(invalid ? 'rgba(180, 35, 24, 0.10)' : 'rgba(0, 110, 190, 0.12)');
    (this.areaHandles.getImage() as CircleStyle).setStroke(new Stroke({ color, width: 2 }));
    this.rectangle.setExtent(bounds?.slice() ?? null);
  }

  setEditingEnabled(enabled: boolean): void {
    this.editingEnabled = enabled;
    this.rectangle.setActive(enabled);
    this.rectangle.setExtent(this.rectangle.getExtent()?.slice() ?? null);
  }

  setParcels(parcels: Parcel[]): void {
    const features = this.parcelFeatures(parcels);
    this.parcels.clear();
    this.parcels.addFeatures(features);
  }

  setContextParcels(parcels: Parcel[]): void {
    const features = this.parcelFeatures(parcels);
    this.contextParcels.clear();
    this.contextParcels.addFeatures(features);
  }

  setSuggestedParcels(parcels: Parcel[]): void {
    const features = this.parcelFeatures(parcels);
    this.suggestions.clear();
    this.suggestions.addFeatures(features);
  }

  private parcelFeatures(parcels: Parcel[]) {
    return parcels.map(({ id, geometry }) => {
      if (geometry.crs !== 'EPSG:2180' || geometry.axisOrder !== 'easting-northing') {
        throw new Error('Unsupported parcel CRS or axis order');
      }
      if (
        (geometry.type === 'Polygon' && !validPolygon(geometry.coordinates)) ||
        (geometry.type === 'MultiPolygon' &&
          (!Array.isArray(geometry.coordinates) ||
            geometry.coordinates.length === 0 ||
            !geometry.coordinates.every(validPolygon))) ||
        (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')
      ) {
        throw new Error('Invalid parcel geometry');
      }
      const feature = new Feature(
        geometry.type === 'Polygon'
          ? new Polygon(geometry.coordinates)
          : new MultiPolygon(geometry.coordinates),
      );
      feature.setId(id);
      return feature;
    });
  }

  fitExtent(bounds: Bounds): void {
    this.map.getView().fit(bounds, { padding: [40, 40, 40, 40], maxZoom: 18 });
  }

  setProjectFrame(bounds: Bounds): void {
    this.setEditingEnabled(false);
    this.setExtent(null);
    this.map.getLayers().forEach((layer) => layer.setExtent([...bounds]));
    this.map.setView(
      new View({
        projection,
        extent: [...bounds],
        showFullExtent: true,
        smoothExtentConstraint: false,
        smoothResolutionConstraint: false,
        enableRotation: false,
        maxZoom: 18,
      }),
    );
    this.map.getView().fit(bounds);
  }

  startDraw(): void {
    if (!this.drawing) {
      const extent = this.rectangle.getExtent();
      this.previousExtent = extent ? [extent[0], extent[1], extent[2], extent[3]] : null;
      this.rectangle.setExtent(null);
    }
    this.drawing = true;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    unByKey(this.listeners);
    this.map.removeInteraction(this.rectangle);
    this.map.setTarget(undefined);
    this.map.dispose();
    this.parcels.clear();
    this.suggestions.clear();
    this.contextParcels.clear();
  }
}
