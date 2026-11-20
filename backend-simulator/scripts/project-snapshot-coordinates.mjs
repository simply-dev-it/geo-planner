import proj4 from '../../frontend/node_modules/proj4/dist/proj4-src.js';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const { from, to, coordinates } = JSON.parse(input);
proj4.defs(
  'EPSG:2180',
  '+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs',
);
const convert = proj4(from, to);
const walk = (c) =>
  typeof c[0] === 'number'
    ? convert.forward(c).map((v) => Math.round(v * 1000) / 1000)
    : c.map(walk);
process.stdout.write(JSON.stringify(walk(coordinates)));
