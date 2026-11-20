"""Explicit bounded public-provider capture; never run by build/test/hot reload."""
import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'backend-simulator/fixtures/public-near-ciezkowice'
DEST.mkdir(parents=True, exist_ok=True)
LIMIT = 2 * 1024 * 1024
consumed = 0
manifest = []
def project(coordinates, source='EPSG:2180', target='EPSG:3857'):
    response = subprocess.run(['mise','exec','--','node',str(ROOT/'backend-simulator/scripts/project-snapshot-coordinates.mjs')],input=json.dumps(dict(coordinates=coordinates,**{'from':source,'to':target})),text=True,capture_output=True,check=True,cwd=ROOT)
    return json.loads(response.stdout)
def fetch(name, base, params):
    global consumed
    url = base + '?' + urllib.parse.urlencode(params)
    record = dict(name=name,url=url)
    cached = DEST/(name+'.response')
    if cached.exists():
        data=cached.read_bytes();consumed+=len(data)
        record.update(status=200,contentType=None,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),reused=True)
        manifest.append(record);return data
    try:
        with urllib.request.urlopen(url, timeout=15) as response:
            data = response.read(min(512*1024,LIMIT-consumed)+1)
            if len(data)>min(512*1024,LIMIT-consumed):
                raise ValueError('Response exceeded the explicit capture budget')
            consumed += len(data)
            record.update(status=response.status,contentType=response.headers.get('Content-Type'),bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
        (DEST/(name+'.response')).write_bytes(data)
        manifest.append(record)
        return data
    except Exception as error:
        record['error']=str(error);manifest.append(record);return None
UUG='https://services.gugik.gov.pl/uug/'
STREETS='https://mapy.geoportal.gov.pl/wss/ext/wfs/KrajowaIntegracjaNumeracjiAdresowej'
PARCELS='https://mapy.geoportal.gov.pl/wss/service/PZGIK/EGIB/WFS/UslugaZbiorcza'
ns={'wfs':'http://www.opengis.net/wfs/2.0','ms':'http://mapserver.gis.umn.edu/mapserver','gml':'http://www.opengis.net/gml/3.2'}
locations=[];streets=[];addresses=[];parcels=[]
for name in ['Ciężkowice','Bobowa','Gromnik']:
    key={'Ciężkowice':'ciezkowice','Bobowa':'bobowa','Gromnik':'gromnik'}[name]
    raw=fetch(key+'-locality',UUG,dict(request='GetAddress',address=name))
    if raw is None:continue
    reply=json.loads(raw);rows=list((reply.get('results') or {}).values())
    expected_teryt={'Ciężkowice':'121601','Bobowa':'120503','Gromnik':'121602'}[name]
    candidates=[r for r in rows if r.get('city')==name and str(r.get('teryt',''))==expected_teryt]
    if len(candidates)!=1:raise ValueError('Expected one explicitly qualified nearby locality: '+name)
    city=candidates[0];x,y=float(city['x']),float(city['y']);simc=city['simc']
    for row in rows:
        if not row.get('city') or not row.get('simc'):continue
        px,py=float(row['x']),float(row['y'])
        locations.append(dict(id=row['simc'],label=row['city'],regionId=str(row['teryt'])[:2],precinct='source-dependent',center=[px,py],source='CAPTURED_GUGIK_UUG',contextLabel=row.get('jednostka','').strip('{}').replace(',', ' · '),extent=[px-400,py-400,px+400,py+400],teryt=row['teryt'],detailedCapture=row['simc']==simc))
    filt=f'<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:PropertyIsEqualTo><fes:ValueReference>ID_MIEJSCOWOSCI</fes:ValueReference><fes:Literal>{simc}</fes:Literal></fes:PropertyIsEqualTo></fes:Filter>'
    raw=fetch(key+'-streets',STREETS,dict(service='WFS',version='2.0.0',request='GetFeature',typeNames='adresyUlice:A08_Ulice',count=5,sortBy='ID_IIP',filter=filt,srsName='urn:ogc:def:crs:EPSG::2180'))
    city_streets=[]
    if raw:
        xml=ET.fromstring(raw)
        for member in xml.findall('{http://www.opengis.net/wfs/2.0}member'):
            feature=list(member)[0]
            props={child.tag.split('}')[-1]:(child.text or '').strip() for child in feature}
            street_name=props.get('NAZWA_ULICY');ulic=props.get('ID_ULICY')
            if not street_name or not ulic:continue
            paths=[]
            for pos in feature.findall('.//{http://www.opengis.net/gml/3.2}posList'):
                values=list(map(float,(pos.text or '').split()))
                if len(values)%2:raise ValueError('Unexpected GML coordinate dimensions')
                paths.append([[values[i+1],values[i]] for i in range(0,len(values),2)])
            points=[p for path in paths for p in path]
            if not points:continue
            if max(abs(p[0]-x)+abs(p[1]-y) for p in points)>30000:raise ValueError('Street axis normalization mismatch')
            extent=[min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points),max(p[1] for p in points)]
            record=dict(id='prg-'+hashlib.sha256((props.get('ID_IIP') or simc+'-'+ulic).encode()).hexdigest()[:24],streetId=ulic,localityId=simc,regionId='12',label=street_name,contextLabel=name,center=[(extent[0]+extent[2])/2,(extent[1]+extent[3])/2],extent=extent,paths=paths,source='CAPTURED_GUGIK_PRG')
            streets.append(record);city_streets.append(record)
    corners=project([[x-150,y-150],[x+150,y+150]])
    bbox=','.join(str(v) for p in corners for v in p)+',EPSG:3857'
    raw=fetch(key+'-parcels',PARCELS,dict(service='WFS',version='2.0.0',request='GetFeature',typeNames='ms:dzialki',count=5,outputFormat='application/json',srsName='EPSG:3857',bbox=bbox))
    city_parcels=[]
    if raw:
        data=json.loads(raw)
        for feature in data.get('features',[]):
            props=feature.get('properties',{});geometry=feature.get('geometry')
            if not geometry or geometry.get('type') not in ['Polygon','MultiPolygon'] or not props.get('ID_DZIALKI'):continue
            coordinates=project(geometry['coordinates'],'EPSG:3857','EPSG:2180')
            points=[]
            def walk(c):
                if isinstance(c[0],(int,float)):points.append(c)
                else:
                    for child in c:walk(child)
            walk(coordinates)
            extent=[min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points),max(p[1] for p in points)]
            rec=dict(id=props['ID_DZIALKI'],number=props['NUMER_DZIALKI'],localityId=simc,bounds=extent,geometry=dict(type=geometry['type'],coordinates=coordinates,crs='EPSG:2180',axisOrder='easting-northing'),source='CAPTURED_GUGIK_EGIB',sourceDataDate=props.get('DATA') or None,precinct=props.get('NAZWA_OBREBU') or props.get('NUMER_OBREBU') or '',sourceProperties=props)
            parcels.append(rec);city_parcels.append(rec)
    if city_parcels:
        fetch(key+'-uldk-example','https://uldk.gugik.gov.pl/',dict(request='GetParcelById',id=city_parcels[0]['id'],result='id,parcel,geom_wkt,datasource',srid=2180))
    for street in city_streets[:2]:
        raw=fetch(key+'-address-'+street['streetId'],UUG,dict(request='GetAddress',address=f"{name}, {street['label']} 1",exact_number=1))
        if not raw:continue
        data=json.loads(raw)
        if data.get('type')!='address':continue
        found=[r for r in (data.get('results') or {}).values() if r.get('simc')==simc and r.get('ulic')==street['streetId'] and str(r.get('number'))=='1']
        for row in found:
            px,py=float(row['x']),float(row['y'])
            addresses.append(dict(id='uug-'+simc+'-'+row['ulic']+'-'+str(row['number']),streetId=row['ulic'],localityId=simc,regionId='12',label=f"{name}, {row['street']} {row['number']}",houseNumber=str(row['number']),streetName=row['street'],contextLabel=name,center=[px,py],extent=[px-100,py-100,px+100,py+100],source='CAPTURED_GUGIK_UUG'))
        if found:break
    if not any(row['localityId']==simc for row in addresses) and city_streets:
        street=city_streets[0]
        raw=fetch(key+'-address-dictionary',UUG,dict(request='GetAddresses',simc=simc,ulic=street['streetId']))
        if raw:
            data=json.loads(raw);numbers=[]
            def collect(value):
                if isinstance(value,dict):
                    if value.get('number') is not None:numbers.append(str(value['number']))
                    for child in value.values():collect(child)
                elif isinstance(value,list):
                    for child in value:collect(child)
            collect(data)
            for number in numbers[:1]:
                raw=fetch(key+'-known-address',UUG,dict(request='GetAddress',address=f"{name}, {street['label']} {number}",exact_number=1))
                if not raw:continue
                data=json.loads(raw)
                for row in (data.get('results') or {}).values():
                    if row.get('simc')!=simc or row.get('ulic')!=street['streetId'] or str(row.get('number'))!=number:continue
                    px,py=float(row['x']),float(row['y'])
                    addresses.append(dict(id='uug-'+simc+'-'+row['ulic']+'-'+number,streetId=row['ulic'],localityId=simc,regionId='12',label=f"{name}, {row['street']} {number}",houseNumber=number,streetName=row['street'],contextLabel=name,center=[px,py],extent=[px-100,py-100,px+100,py+100],source='CAPTURED_GUGIK_UUG'))
output=dict(capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),byteBudget=LIMIT,responseBytes=consumed,scope='Three nearby localities; at most 5 streets, 5 parcels and 2 explicit house-number probes per locality; no bulk imagery or registry acquisition.',limitations=['Frozen bounded responses, not complete locality or cadastral coverage.','Source response dates and field DATA do not establish legal/survey currency.','Live fuzzy matching, source availability and rate limits are not reproduced.'],localities=locations,streets=streets,addresses=addresses,parcels=parcels,requests=manifest)
(DEST/'snapshot.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(responseBytes=consumed,localities=len(locations),streets=len(streets),addresses=len(addresses),parcels=len(parcels),errors=[r for r in manifest if 'error' in r]),ensure_ascii=False,indent=2))
