/**
 * Visualizes Covid-19 case data on a US County level on a map using D3.js
 * 
 * US Covid-19 data provided by the New York Times:
 * https://github.com/nytimes/covid-19-data
 * 
 * Examples used for inspiration/code:
 * https://bl.ocks.org/adamjanes/6cf85a4fd79e122695ebde7d41fe327f
 * https://bl.ocks.org/mbostock/9943478
 * https://bost.ocks.org/mike/bubble-map/
 */

// Selects the first element that matches the specified selector string
var svg = d3.select('svg'),
  width = +svg.attr('width'),
  height = +svg.attr('height'),
  active = d3.select(null),
  countyGeo,
  covidData = [],
  endDate,
  g,
  path,
  formatNumber,
  zoom,
  radius,
  promises;

svg.on('click', stopped, true);

svg.append('rect')
  .attr('class', 'background')
  .attr('width', width)
  .attr('height', height)
  .on('click', reset);

g = svg.append('g');

// create a new geographic path generator with the default settings
path = d3.geoPath();

formatNumber = d3.format(',.0f');

zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', zoomed);

// radius for bubbles
radius = d3.scaleSqrt()
    .domain([0, 1000])
    .range([0, 8]);

svg.call(zoom); // delete this line to disable free zooming

promises = [
  d3.json('us-10m.v1.json'),
  d3.csv('covid-19-data/us-counties.csv', function(d) {
    covidData.push(d);
  })
];

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
Promise.all(promises).then(ready);

/**
 * Promise success
 *
 * @param      {<type>}  [us]    { parameter_description }
 */
function ready([us]) {
  console.log('[ready] data ready');

  // convert TopoJSON to GeoJSON.
  countyGeo = topojson.feature(us, us.objects.counties).features;
  // countyGeo.features now holds ~3000 items
  // each one representing a county as a polygon

  // get the currently processed date
  endDate = new Date(covidData[covidData.length - 1].date);

  document.getElementById('current-date').innerHTML = getFormattedDate(endDate);

  renderStates(us);
  renderBubbles(us, getFormattedDate(endDate));
  renderLegend();  
}

/**
 * Render circles for each county
 * size representing number of covid cases
 *
 * @param      {JSON}   us      US TopoJSON
 * @param      {String} selectedDate  Formatted date string
 */
function renderBubbles(us, selectedDate) {
  console.log('[renderBubbles] for date: ', selectedDate);

  // initializing covid case count for each county as 0
  countyGeo.forEach(function(county) {
    county.properties.covidCases = 0;
  });

  // loop through covid data and pull out covid
  // cases for each county based on NYT data
  covidData.forEach(function (item) {
    if (item.date === selectedDate) {
      countyGeo.forEach(function(county) {
        if (item.fips === county.id) {
          county.properties.covidCases = item.cases;
          county.properties.county = item.county;
          county.properties.state = item.state;
        } 
      });
    }
  });

  // remove all previous bubbles first
  d3.selectAll('.bubble').remove();

  // The <g> SVG element is a container used to group other SVG elements.
  // render bubbles/circles describing covid case count
  g.append('g')
      .attr('class', 'bubble')
    .selectAll('circle')
      .data(countyGeo
        .sort(function(a, b) { 
          return b.properties.covidCases - a.properties.covidCases; 
        }))
    .enter().append('circle')
      .attr('transform', function(d) { return 'translate(' + path.centroid(d) + ')'; })
      .attr('r', function(d) { 
        return radius(d.properties.covidCases || 0);  
      })
    .append('title')
      .text(function(d) {
        if (d.properties.covidCases) {
          return d.properties.county + ', ' + d.properties.state
            + '\nCases: ' + formatNumber(d.properties.covidCases);
        }
      });
}

/**
 * Render legend in lower right corner
 */
function renderLegend() {
  console.log('[renderLegend]');

  var sampleSizes = [100, 1000, 10000], // sample circles
    legend; 

  legend = g.append('g')
    .attr('class', 'legend')
    .attr('transform', 'translate(' + (width - 50) + ',' + (height - 20) + ')')
    .selectAll('g')
    .data(sampleSizes) 
    .enter().append('g');

  legend.append('circle')
    .attr('cy', function(d) { return -radius(d); })
    .attr('r', radius);

  legend.append('text')
    .attr('y', function(d) { return -2 * radius(d); })
    .attr('dy', '1.3em')
    .text(d3.format('.1s'));
}

/**
 * Render US States outlines
 *
 * @param      {JSON}   us      US TopoJSON
 */
function renderStates(us) {
  console.log('[renderStates]');

  var stateGeo;

  g.selectAll('path')
    .data(topojson.feature(us, us.objects.states).features)
    .enter().append('path')
    .attr('d', path)
    .attr('class', 'feature')
    .on('click', clicked);

  // Returns the GeoJSON MultiLineString geometry
  // https://github.com/topojson/topojson-client/blob/master/README.md#mesh
  // last argument is a filter function for handling interior boundaries
  stateGeo = topojson.mesh(us, us.objects.states, function(a, b) { return a !== b; });

  g.append('path')
    .datum(stateGeo)
    .attr('class', 'border border--state mesh')
    .attr('d', path);
}


/**
 * Simple helper function to display 
 * current date in YYYY-MM-DD format
 *
 * @param      {Date}  d      JavaScript Data object
 * @return     {string}  The formatted date.
 */
function getFormattedDate(d) {
  console.log('[getFormattedDate]', d);

  var dd = d.getUTCDate(),
    mm = d.getUTCMonth() + 1,
    yyyy = d.getFullYear(); 

  if (dd < 10) {
    dd = '0' + dd;
  } 

  if (mm < 10) {
    mm = '0' + mm;
  }

  return yyyy + '-' + mm + '-' + dd; 
}

/**
 * Handler for any map clicks
 *
 * @param      {<type>}  d       { parameter_description }
 * @return     {<type>}  { description_of_the_return_value }
 */
function clicked(d) {
  console.log('[clicked]');

  if (active.node() === this) return reset();
  active.classed('active', false);
  active = d3.select(this).classed('active', true);

  d3.event.stopPropagation();

  var bounds = path.bounds(d),
    dx = bounds[1][0] - bounds[0][0],
    dy = bounds[1][1] - bounds[0][1],
    x = (bounds[0][0] + bounds[1][0]) / 2,
    y = (bounds[0][1] + bounds[1][1]) / 2,
    scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height))),
    translate = [width / 2 - scale * x, height / 2 - scale * y];

  svg.transition()
    .duration(750)
    .call( zoom.transform, d3.zoomIdentity.translate(translate[0],translate[1]).scale(scale) );
}

function reset() {
  active.classed('active', false);
  active = d3.select(null);

  svg.transition()
    .duration(750)
    .call( zoom.transform, d3.zoomIdentity ); // updated for d3 v4
}

function zoomed() {
  g.style('stroke-width', 1.5 / d3.event.transform.k + 'px');
  g.attr('transform', d3.event.transform);
}

// If the drag behavior prevents the default click,
// also stop propagation so we don’t click-to-zoom.
function stopped() {
  if (d3.event.defaultPrevented) d3.event.stopPropagation();
}