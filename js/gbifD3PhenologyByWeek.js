import { gbifCountsByWeekByTaxonName, gbifCountsByWeekByListTaxonKey } from './gbifCountsByWeek.js';
let exploreUrl;

export async function gbifD3PhenologyByTaxonName(taxonName, htmlId, fileConfig) {
    
    let geoSearchA = fileConfig.predicateToQueries(fileConfig.dataConfig.rootPredicate, true);
    exploreUrl = fileConfig.dataConfig.exploreUrl;

    gbifCountsByWeekByTaxonName(taxonName, geoSearchA).then(pheno => {

        //console.log('gbifD3PhenologyByWeek=>gbifCountsByWeekByListTaxonName', pheno);

        let data = pheno.weekArr;
    
        console.log('Phenology data for', taxonName, data);
    
        createChart(htmlId, data); //we don't allow drill-down search for taxonName view of data!?!
    })
}
export async function gbifD3PhenologyByTaxonKey(taxonKey, htmlId, fileConfig) {
    
    exploreUrl = fileConfig.dataConfig.exploreUrl;

    gbifCountsByWeekByListTaxonKey(taxonKey, fileConfig).then(pheno => {

        //console.log('gbifD3PhenologyByWeek=>gbifCountsByWeekByListTaxonKey', pheno);

        let data = pheno.weekArr;
    
        console.log('Phenology data for', taxonKey, data);
    
        createChart(htmlId, data, pheno.search);
    })
}
function createChart(htmlId='chart', data, searchTerm=0) {

    let yMax = d3.max(data, d => d.count)

    // Set the dimensions of the canvas
    const margin = { top: 20, right: 20, bottom: 40, left: 30 + (String(yMax).length-3)*7 };

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
        //d.month0 = Array.isArray(d.month) ? +d.month[0] : +d.month;
        d.month1 = Array.isArray(d.month) ? (2 == d.month.length ? +d.month[1] : 0) : 0; 
        d.month = Array.isArray(d.month) ? +d.month[0] : +d.month;
        d.count = +d.count;
    });

    // Scale the range of the data
    x.domain(data.map(d => d.week));
    xM.domain(data.map(d => d.month));
    y.domain([0, d3.max(data, d => d.count)]);

    // Add the weeks X Axis
    const xWeek = svg.append("g")
        .attr("transform", `translate(0, ${height + axisOffset})`) //5 px below the chart
        //.attr("transform", `translate(0, ${-axisOffset})`) //5 px above the chart
        //.call(d3.axisTop(x)) //above the line
        .call(d3.axisBottom(x)) //below the line
    
        .selectAll(".tick text") //'.tick text' and just 'text' both work, here
        .attr("transform", "rotate(-70) translate(-12,-10)") //rotate week numbers and shift to match tickmarks
        //.style("text-anchor", "end"); //this moves the text to the end of the tickmark, but only for non-transformed text
    
    // Add the months X Axis
    const xMonth = svg.append("g")
        //.attr("transform", `translate(0, ${height + axisOffset})`) //5 px below the chart
        .attr("transform", `translate(0, ${-axisOffset})`) //5 px above the chart
        .call(d3.axisTop(xM) //above the line
        //.call(d3.axisBottom(xM) //below the line
        .tickFormat(d => {
                // Convert numeric month to month name
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                return monthNames[d - 1]; // Months are one-indexed in JavaScript
            })
        )
    xMonth.selectAll(".tick line") //select month top tick marks
        .attr("transform", `translate(${width/30}, 0)`) //shift the month x-axis tick-marks to the right
        .attr("y2", height+axisOffset*2) // Adjust the length of the tick lines
        .classed("upper-tick", true); // Apply custom class so we can style just these tick lines
    xMonth.selectAll(".tick text") //select month top text labels
        .attr("transform", `translate(-${width/90}, 0)`) //shift the month x-axis labels to the left
        .classed("upper-text", true); // Apply custom class so we can style just these tick lines

    //add 'Week' text label to lower axis
    svg.append("text")
        .attr("x", width/2-20) // Adjust the x-coordinate
        .attr("y", height + margin.bottom - 5) // Adjust the y-coordinate
        .text('Week')
        .style("font-size", "10px");

    // Create Y Axis with only whole number tickmarks
    let yAxis;
    if (yMax > 10) {
        yAxis = d3.axisLeft(y); //auto-range tick values, auto-format large numbers
    } else {
        yAxis = d3.axisLeft(y)
            .tickValues(d3.range(yMax+1)) //only allow tick divisions at whole numbers
            .tickFormat(d3.format(".0f")); //specify whole number values at ticks w/o decimals
    }
    // Add the Y Axis
    svg.append("g")
        .attr("class", "y-axis")
        .call(yAxis);

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

        let month = d.month1 ? `${d.month},${d.month1}` : d.month;

        tooltip
            .html(`Week: ${d.week}<br>Month: ${month}<br>Count: ${d.count}`)
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
        let monthFilter = d.month1 ? `month=${d.month}&month=${d.month1}` : `month=${d.month}`;
        if (exploreUrl && searchTerm) {
            window.open(`${exploreUrl}?${searchTerm}&${monthFilter}&view=TABLE`);
        } else {
            alert('Phenology links to GBIF Occurrences only available for queries by taxonKey.')
        }
    }
}
