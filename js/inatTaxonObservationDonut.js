/*
To-do:
- allow for other ways to scope the view of iNat data, other than by project
- possible but unknown options:
  - by geo bounding box
  - by state or other locale name
  - by gadmGid

  https://www.inaturalist.org/pages/api+reference#get-observations

  swlat
      Southwest latitude of a bounding box query.
      Allowed values: -90 to 90 
  swlng
      Southwest longitude of a bounding box query.
      Allowed values: -180 to 180 
  nelat
      Northeast latitude of a bounding box query.
      Allowed values: -90 to 90 
  nelng
      Northeast longitude of a bounding box query.
      Allowed values: -180 to 180 
  list_id
      Restrict results to observations of taxa on the specified list. Limited to lists with 2000 taxa or less.
      Allowed values: iNat list ID 
*/
export async function inatTaxonObsDonut(taxonName, taxonRank='species', htmlId, commonName=false, inatProject=false) {
  let promise = inatTaxonObsData(taxonName, taxonRank, inatProject).then(inat => {
    d3.select(htmlId).remove();
    //oldDonut(inat.objIds, inat.objObs, htmlId, taxonName, commonName);
    createPie(inat, htmlId);
    return inat;
  }).catch(err => {
    console.log('inatTaxonObservationDonut=>inatTaxonObsDonut ERROR', err);
    console.dir(err); //this shows you the error structure
    return Promise.reject({'message':err.message});
  })
  return promise;
}
export async function inatTaxonObsData(taxonName, taxonRank='species', inatProject=false) {

  //console.log('inatTaxonObsData', taxonName, taxonRank, inatProject);

  const apiUrl = 'https://api.inaturalist.org/v1/observations';
  const webUrl = 'https://inaturalist.org/observations';
  const project = inatProject ? `?project_id=${inatProject}` : '?'; //'?project_id=vermont-atlas-of-life';
  const research = '&quality_grade=research';
  const needs_id = '&quality_grade=needs_id';
  const casual = '&quality_grade=casual';
  const tParam = {'NeedsID':needs_id, 'Research':research, 'Casual':casual};
  const tName = `&taxon_name=${taxonName}`;
  const tRank = ['SUBSPECIES', 'VARIETY'].includes(taxonRank) ? `&rank=${taxonRank.toLowerCase()}` : '';
  const lrank = `&lrank=${taxonRank.toLowerCase()}`;
  const limit = `&per_page=0`;

  //iNat needs rank param to count just subsp. obs. However to include sub-taxa counts for upper taxa, don't include the rank param.
  const qTotalObs = encodeURI(apiUrl + project + tName + tRank + limit);
  const qNeedsID = encodeURI(apiUrl + project + needs_id + tName + tRank + limit);
  const qResearch = encodeURI(apiUrl + project + research + tName + tRank + limit);
  const qCasual = encodeURI(apiUrl + project + casual + tName + tRank + limit);
  const qSppCount = encodeURI(apiUrl + '/species_counts' + project + tName + tRank);

  let prom1 = Promise.all([
      fetch(qTotalObs),
      fetch(qResearch),
      fetch(qNeedsID),
      fetch(qCasual),
      fetch(qSppCount)]
    )
    let prom2 = prom1.then((responses) => {
      // Get a JSON object from each response
      return Promise.all(responses.map(async res => {
        let json = await res.json();
        console.log(`inatTaxonObsDonut::fetchAll(${taxonName  }) JSON RESULT FOR URL:`, res.url, json);
        return json;
      }));
    })
    let prom3 = prom2.then((data) => {
      var data2 = data.map(function (d) {return d.total_results})
      
      let obsData = {'totalObs':data2[0], 'totalSpp':data2[4]};
      let idsData = {'Research':data2[1], 'NeedsID':data2[2], 'Casual':data2[3]};
      return {'objIds':idsData, 'objObs':obsData};
    })
    let prom4 = prom3.then(inat => {
      /*
      Convert inat.objIds eg. { NeedsID:365, Research:199, Casual:6 } to:
      arrIds[
          { type: "NeedsID", value: 365, url: "https://www.inaturalist.org/observations?project_id=vermont-atlas-of-life&quality_grade=needs_id&taxon_name=Phyciodes tharos&rank=species" }
          { type: "Research", value: 199, url: "https://www.inaturalist.org/observations?project_id=vermont-atlas-of-life&quality_grade=research&taxon_name=Phyciodes tharos&rank=species" }
          { type: "Casual", value: 6, url: "https://www.inaturalist.org/observations?project_id=vermont-atlas-of-life&quality_grade=casual&taxon_name=Phyciodes tharos&rank=species" }
      ]
      */
      let arrIds = [];
      for (const [key, val] of Object.entries(inat.objIds)) {
          arrIds.push({'type':key, 'value':val, 'url':webUrl+project+tParam[key]+tName+tRank});
      }
      inat.arrIds = arrIds;
      return inat; //this returns data for return below
    })
    .catch(err => {
      console.log('ERROR inatTaxonObsDonut ERROR', err);
      return Promise.reject({'message':err.message}); //this returns error for return below
    });
    return prom4;
  }

/*
    arrIds[
        { type: "NeedsID", value: 365, url: "https://www.inaturalist.org/observations?project_id=vermont-atlas-of-life&quality_grade=needs_id&taxon_name=Phyciodes tharos&rank=species" }
        { type: "Research", value: 199, url: "https://www.inaturalist.org/observations?project_id=vermont-atlas-of-life&quality_grade=research&taxon_name=Phyciodes tharos&rank=species" }
        { type: "Casual", value: 6, url: "https://www.inaturalist.org/observations?project_id=vermont-atlas-of-life&quality_grade=casual&taxon_name=Phyciodes tharos&rank=species" }

*/
function createPie(inat, htmlId) {
  let objObs = inat.objObs;
  let data = inat.arrIds;

  // Set up SVG dimensions
    const width = 300;
    const height = 250;
    const radius = Math.min(width, height) / 2;

    // Specify the size of the hole in the middle of the donut chart
    const innerRadius = radius * 0.9;

    // Create SVG container
    const svg = d3.select(`#${htmlId}`)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

    // Define color scale
    var color = d3.scaleOrdinal(d3.schemeCategory10);
    // set the color scale
    color = d3.scaleOrdinal()
        .domain(Object.keys(data))
        .range([
            d3.interpolateViridis(0.2),
            d3.interpolateViridis(0.5),
            d3.interpolateViridis(0.8)]);

    // Define arc
    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(radius);

    // Define pie layout
    const pie = d3.pie()
        .value(d => d.value);

    // Draw donut chart
    const arcs = svg.selectAll("arc")
        .data(pie(data))
        .enter()
        .append("g");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", (d, i) => color(i))
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut)
        .on("click", handleClick)
        .style("cursor", "pointer");

    // add text to center of the donut plot above a count
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr('font-size', '2em')
        .attr('y', -40)
        .text(`Observations:`);

    // add text to center of the donut plot below a label
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr('font-size', '4em')
        .attr('y', 20)
        .text(objObs.totalObs.toLocaleString());
    
    // Add one dot in the legend for each name.
    svg.selectAll("mydots")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", -42)
        .attr("cy", (d,i) => 50 + i*15) // 100 is where the first dot appears. 25 is the distance between dots
        .attr("r", 5)
        .style("fill", d => color(d.value))

    // Add labels next to dots
    svg.selectAll("mylabels")
        .data(data)
        .enter()
        .append("text")
        .attr("x", -35)
        // 100 is where the first dot appears. 25 is the distance between dots
        .attr("y", (d,i) => 55 + i*15)
        .style("fill", d => color(d.value))
        .text(d => `${d.type} (${d.value})`)
        .attr("text-anchor", "left")
        .style("alignment-baseline", "middle")
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut)
        .on("click", handleClick)
        .style("cursor", "pointer");

    // Add the tooltip
    const tooltip = d3.select(`#${htmlId}`)
        .append("div")
        .attr("class", "d3tooltip");

    // Mouseover event handler
    function handleMouseOver(event, d) {
        d3.select(this)
            .attr("fill", "orange"); // Change color or add other effects on mouseover
        
        let data; if (d.data) {data = d.data;} else {data = d;}
        tooltip
            .html(`${data.type}: ${data.value}`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px")
            .style("display", "block");
    }

    // Mouseout event handler
    function handleMouseOut(event, d) {
        // Remove the tooltip
        tooltip.style("display", "none");

        let data; if (d.data) {data = d.data;} else {data = d;}

        d3.select(this)
            .attr("fill", color(data.value)); // Change back to the original color on mouseout    
    }

    // Click event handler
    function handleClick(event, d) {
        // Open the URL in a new tab/window
        let data; if (d.data) {data = d.data;} else {data = d;}
        window.open(data.url, "_blank");
    }
}

function oldDonut(idsData, obsData, htmlId, taxonName, commonName=false) {
  var width = 300, height = 300, margin = 10;

  // The radius of the pieplot is half the width or half the height (smallest one). I subtract a bit of margin.
  var radius = Math.min(width, height)/1.75 - margin; //Math.min(width, height) / 2 - margin;

  // append the svg object to the div called '#htmlId'
  var svg = d3.select("#" + htmlId)
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
    //.attr("transform", "translate(" + 3*width/4 + "," + height/2 + ")");

  // set the color scale
  var color = d3.scaleOrdinal()
    .domain(Object.keys(idsData))
    .range([d3.interpolateViridis(0.2),
      d3.interpolateViridis(0.5),
      d3.interpolateViridis(0.8)]);

  // Compute the position of each group on the pie:
  var pie = d3.pie()
    .sort(null) // Do not sort group by size
    .value(d => d.value);

  // The arc generator
  var arc = d3.arc()
    .innerRadius(radius * 0.7) // This is the size of the donut hole
    .outerRadius(radius * 0.8)

  // Another arc that won't be drawn. Just for labels positioning
  var outerArc = d3.arc()
    .innerRadius(radius * 0.9)
    .outerRadius(radius * 0.9)

  //console.log('idsData', idsData);
  let d3entries = [];
  for (const [key, val] of Object.entries(idsData)) {
    //console.log('my.entries', key, val);
    d3entries.push({'key':key, 'value':val});
  }

  //let obe = Object.entries(idsData); console.log('Object.entries', obe);
  //let d3e = d3.entries(idsData); console.log('d3.entries', d3e);
  console.log('my.entries', d3entries);

  //var data_ready = pie(Object.entries(idsData))
  //console.log('pie(Ojbect.entries)', data_ready);
  //var data_ready = pie(d3.entries(idsData))
  //console.log('pie(d3.entries)', data_ready)
  var data_ready = pie(d3entries)

  // Build the pie chart: Basically, each part of the pie is
  // a path that we build using the arc function.
  var path = svg.selectAll('allSlices').data(data_ready)

  //this is the "update" selection:
  var pathUpdate = path.attr("d", arc);

  // add text to center of the donut plot above a count
  svg.append("text")
    .attr("text-anchor", "middle")
    .attr('font-size', '2em')
    .attr('y', -40)
    //.text(`Species:`);
    .text(`Observations:`);

  // add text to center of the donut plot below a label
  svg.append("text")
    .attr("text-anchor", "middle")
    .attr('font-size', '4em')
    .attr('y', 20)
    .text(obsData.totalObs.toLocaleString());
/*
  // add taxonName text outside the donut plot
  svg.append("text")
    .append("text")
    .attr("x", 0)
    .attr("y", -60)
    .attr("text-anchor", "middle")
    .style("font-size", "4em")
    .text(commonName ? commonName : taxonName);
*/
  // Add one dot in the legend for each name.
  svg.selectAll("mydots")
    .data(data_ready)
    .enter()
    .append("circle")
    .attr("cx", -10)
    .attr("cy", function(d,i){ return 50 + i*15}) // 100 is where the first dot appears. 25 is the distance between dots
    .attr("r", 5)
    .style("fill", function(d){ return color(d.data.key)})

  // Add one dot in the legend for each name.
  svg.selectAll("mylabels")
    .data(data_ready)
    .enter()
    .append("text")
    .attr("x", -5)
    // 100 is where the first dot appears. 25 is the distance between dots
    .attr("y", function(d,i){ return 55 + i*15})
    .style("fill", function(d){ return color(d.data.key)})
    .text(function(d){ return d.data.key})
    .attr("text-anchor", "left")
    .style("alignment-baseline", "middle")

  var pathEnter = path.enter()
    .append('path')
    .attr('d', arc)
    .attr('fill', function(d){ return(color(d.data.key)) })
    .attr("stroke", "white")
    .style("stroke-width", "2px")
    .style("opacity", 0.7)
/*

  var tooltip = d3.select(`#${htmlId}`)
    .append('div')
    .attr('class', 'd3tooltip');

  tooltip.append('div')
    .attr('class', 'label')
    .style('font-weight','bold');

  tooltip.append('div')
    .attr('class', 'count');

  tooltip.append('div')
    .attr('class', 'percent');

  pathEnter.on('mouseover', function(d) {               
    var total = d3.sum(data_ready.map(function(d) {   
      return d.value;                              
    }));                                           
    var percent = Math.round(1000 * d.data.value / total) / 10;
    tooltip.select('.label').html(d.data.key);   
    tooltip.select('.count').html(d.data.value.toLocaleString());   
    tooltip.select('.percent').html(percent + '%');
    tooltip.style('display', 'block');             
  });

  pathEnter.on('mouseout', function() {                 
    tooltip.style('display', 'none');              
  });

  pathEnter.on('mousemove', function(d) {               
    let pos = d3.select(this).node().getBoundingClientRect();
    d3.select('#'+htmlId)
      .style('left', `${pos['x']}px`)
      .style('top', `${(window.pageYOffset  + pos['y'] - 100)}px`);
  });
*/
}
