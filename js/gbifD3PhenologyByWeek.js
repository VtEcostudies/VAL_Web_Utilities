import { gbifCountsByWeekByTaxonName, gbifCountsByWeekByListTaxonKey } from './gbifCountsByWeek.js';
let exploreUrl;

export async function gbifD3PhenologyByTaxonName(taxonName, htmlId, fileConfig) {
    
    let geoSearchA = fileConfig.predicateToQueries(fileConfig.dataConfig.rootPredicate, true);
    exploreUrl = fileConfig.dataConfig.exploreUrl;

    gbifCountsByWeekByTaxonName(taxonName, geoSearchA).then(pheno => {

        let data = pheno.weekArr;
    
        console.log('Phenology data for', taxonName, data);
    
        createChart(htmlId, data);
    })
}
export async function gbifD3PhenologyByTaxonKey(taxonKey, htmlId, fileConfig) {
    
    exploreUrl = fileConfig.dataConfig.exploreUrl;

    gbifCountsByWeekByListTaxonKey(taxonKey, fileConfig).then(pheno => {

        console.log('gbifD3PhenologyByWeek=>gbifCountsByWeekByListTaxonKey', pheno);

        let data = pheno.weekArr;
    
        console.log('Phenology data for', taxonKey, data);
    
        createChart(htmlId, data, pheno.search);
    })
}
function createChart(htmlId='chart', data, searchTerm=0) {

    // Set the dimensions of the canvas
    const margin = { top: 20, right: 20, bottom: 30, left: 30 };

    let axisOffset = 5; //push x-axes away from y-axis and tallest bar this amount to show a gap
    let width = document.getElementById(htmlId).offsetWidth - margin.left - margin.right;
    let height = 250-margin.top-margin.bottom-axisOffset*2;//document.getElementById(htmlId).offsetHeight - margin.bottom - margin.top - axisOffset*2;

    console.log(width, height);

    // Create the SVG container
    /*
    let svg = d3.select(`#${htmlId}`)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom + axisOffset*2)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    */
    let svg = d3.select(`#${htmlId}`)
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom + axisOffset*2}`)
        .attr("width", "100%")
        .attr("height", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top + axisOffset*2})`);

    // Set the ranges
    const x = d3.scaleBand().range([0, width]).padding(0.1);
    const xM = d3.scaleBand().range([0, width]).padding(0.1);
    const y = d3.scaleLinear().range([height, 0]);

    // Fix the data
    data.forEach(d => {
        d.week = +d.week;
        d.month = +d.month;
        d.count = +d.count;
    });

    // Scale the range of the data
    x.domain(data.map(d => d.week));
    xM.domain(data.map(d => d.month));
    y.domain([0, d3.max(data, d => d.count)]);

    // Add the weeks X Axis
    svg.append("g")
        .attr("transform", `translate(0, ${height + axisOffset})`) //5 px below the chart
        //.attr("transform", `translate(0, ${-axisOffset})`) //5 px above the chart
        //.call(d3.axisTop(x)) //above the line
        .call(d3.axisBottom(x)) //below the line
    /*
        .selectAll("text")
        .attr("transform", "rotate(0)")
        .style("text-anchor", "end");
    */
    // Add the months X Axis
    svg.append("g")
        //.attr("transform", `translate(0, ${height + axisOffset})`) //5 px below the chart
        .attr("transform", `translate(0, ${-axisOffset})`) //5 px above the chart
        .call(d3.axisTop(xM) //above the line
        //.call(d3.axisBottom(xM) //below the line
        .tickFormat(d => {
                // Convert numeric month to month name
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                return monthNames[d - 1]; // Months are one-indexed in JavaScript
            })
        );

    // Add the Y Axis
    svg.append("g")
        .call(d3.axisLeft(y));

    svg.selectAll("centerBar")
        .data(data)
        .enter().append("rect")
        .attr("x", d => x(d.week))
        .attr("width", x.bandwidth())
        .attr("y", d => y(d.count)/2) // divide by 2 pushes axis center up half way
        .attr("height", d => d.count ? height - y(d.count) : 0) //minus constant so bars have margin from axes
        .attr("fill", "steelblue")
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut)
        .on("click", handleClick)
        .style("cursor", "pointer"); // Change cursor on hover to indicate clickability

    // Add the tooltip
    let tooltip = d3.select(`#${htmlId}`).append("div").attr("class", "d3tooltip");;

    // Mouseover event handler
    function handleMouseOver(event, d) {
        d3.select(this)
            .attr("fill", "orange"); // Change color or add other effects on mouseover

        // Display data in the console or update a tooltip
        //console.log("Mouseover: ", d);

        tooltip
            .html(`Week: ${d.week}<br>Month: ${d.month}<br>Count: ${d.count}`)
            .style("left", (event.pageX-50) + "px")
            .style("top", (event.pageY-50) + "px")
            .style("display", "block");
    }
    // Mouseout event handler
    function handleMouseOut(event, d) {
        d3.select(this)
            .attr("fill", "steelblue"); // Change back to the original color on mouseout
        
        tooltip.style("display", "none");
    }
    // Click event handler
    function handleClick(event, d) {
        if (exploreUrl && searchTerm) {
            window.open(`${exploreUrl}?${searchTerm}&month=${d.month}&view=TABLE`);
        }
    }
}
