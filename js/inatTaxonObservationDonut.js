import { getInatSpecies } from './inatSpeciesData.js';
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
export async function inatTaxonObsDonut(taxonName, taxonRank='species', htmlId, inatProject=false) {
  let promise = inatTaxonObsDataByName(taxonName, taxonRank, inatProject).then(inat => {
    d3.select(htmlId).remove();
    makeDonut(inat, htmlId);
    return inat;
  }).catch(err => {
    console.log('inatTaxonObservationDonut=>inatTaxonObsDonut ERROR', err);
    //console.dir(err); //this shows you the error structure
    showError(err, htmlId);
    return Promise.reject({'message':err.message});
  })
  return promise;
}

export async function inatTaxonObsDataByName(taxonName, taxonRank=false, inatProject=false) {
  let iSpc = getInatSpecies(taxonName, taxonRank).then(spc => {
      console.log('inatTaxonObservationDonut=>inatTaxonObsDataByName=>getInatSpecies', spc);
      let iObs = inatTaxonObsDataById(spc.id, spc.rank, inatProject).then(obs => {
        console.log('inatTaxonObservationDonut=>inatTaxonObsDataByName=>inatTaxonObsDataById', obs);
        return obs;
      }).catch(err => {
        return Promise.reject({'message':err.message})
      })
      return iObs;
    }).catch(err => {
      return Promise.reject({'message':err.message})
    })
  return iSpc;
}

export async function inatTaxonObsDataById(taxonId, taxonRank='species', inatProject=false) {

  //console.log('inatTaxonObsData', taxonName, taxonRank, inatProject);

  const apiUrl = 'https://api.inaturalist.org/v1/observations';
  const webUrl = 'https://inaturalist.org/observations';
  const project = inatProject ? `?project_id=${inatProject}` : '?'; //'?project_id=vermont-atlas-of-life';
  const research = '&quality_grade=research';
  const needs_id = '&quality_grade=needs_id';
  const casual = '&quality_grade=casual';
  const tParam = {'NeedsID':needs_id, 'Research':research, 'Casual':casual};
  const taxId = `&taxon_id=${taxonId}`;
  const tRank = ['SUBSPECIES', 'VARIETY'].includes(taxonRank) ? `&rank=${taxonRank.toLowerCase()}` : '';
  const lrank = `&lrank=${taxonRank.toLowerCase()}`;
  const limit = `&per_page=0`;

  //iNat needs rank param to count just subsp. obs. However to include sub-taxa counts for upper taxa, don't include the rank param.
  const qTotalObs = encodeURI(apiUrl + project + taxId + limit);
  const qNeedsID = encodeURI(apiUrl + project + needs_id + taxId + limit);
  const qResearch = encodeURI(apiUrl + project + research + taxId + limit);
  const qCasual = encodeURI(apiUrl + project + casual + taxId + limit);
  const qSppCount = encodeURI(apiUrl + '/species_counts' + project + taxId);

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
        console.log(`inatTaxonObsDonut::fetchAll(${taxonId}) JSON RESULT FOR URL:`, res.url, json);
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
          arrIds.push({'type':key, 'value':val, 'url':webUrl+project+tParam[key]+taxId+tRank, 'api':apiUrl+project+tParam[key]+taxId+tRank});
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

function showError(err, htmlId) {
  let eleDiv = document.getElementById(htmlId);
  eleDiv.innerHTML = `<p>${err.message}</p>`
}
/*
    arrIds[
        { type: "NeedsID", value: 365, url: "https://www.inaturalist.org/observations?project_id=vermont-atlas-of-life&quality_grade=needs_id&taxon_name=Phyciodes tharos&rank=species" }
        { type: "Research", value: 199, url: "https://www.inaturalist.org/observations?project_id=vermont-atlas-of-life&quality_grade=research&taxon_name=Phyciodes tharos&rank=species" }
        { type: "Casual", value: 6, url: "https://www.inaturalist.org/observations?project_id=vermont-atlas-of-life&quality_grade=casual&taxon_name=Phyciodes tharos&rank=species" }

*/
function makeDonut(inat, htmlId) {
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
        //.domain(Object.keys(data))
        .domain(data)
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
        .style("fill", (d, i) => color(i))

    // Add labels next to dots
    svg.selectAll("mylabels")
        .data(data)
        .enter()
        .append("text")
        .attr("x", -35)
        // 100 is where the first dot appears. 25 is the distance between dots
        .attr("y", (d,i) => 55 + i*15)
        .style("fill", (d, i) => color(i))
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
            .style("left", (event.pageX-50) + "px")
            .style("top", (event.pageY-50) + "px")
            .style("display", "block");
    }

    // Mouseout event handler
    function handleMouseOut(event, d) {
        // Remove the tooltip
        tooltip.style("display", "none");

        let data; let index; if (d.data) {data = d.data;} else {data = d;}
        index=inat.arrIds.findIndex(o => {return data.type==o.type})

        //console.log(index);

        d3.select(this)
            .attr("fill", color(index)); // Change back to the original color on mouseout    
    }

    // Click event handler
    function handleClick(event, d) {
        // Open the URL in a new tab/window
        let data;
        //console.log(data);
        if (d.data) {
          data = d.data;
          //location.assign(data.url, "_blank");
          window.open(data.url, "_blank");
        } else {
          data = d;
          //location.assign(data.api, "_blank");
          //window.open(data.api, "_blank");
          window.open(data.url, "_blank");
        }
    }
}
