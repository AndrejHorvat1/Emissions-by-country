const width = 960, height = 600;

const svg = d3.select("#map").append("svg")
    .attr("width", width)
    .attr("height", height);

const g = svg.append("g");

const projection = d3.geoMercator()
    .scale(150)
    .translate([width / 2, height / 1.5]);

const path = d3.geoPath().projection(projection);

const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", event => {
        g.attr("transform", event.transform);
    });

svg.call(zoom);

// Color scale
const colorScale = d3.scaleLinear()
    .domain([0, 500, 1000, 3500, 7000, 10000])
    .range(["#ffe6e6", "#ffcccc", "#ff9999", "#ff6666", "#ff3333", "#990000"]);

// Load data
Promise.all([
    d3.json("custom.geo.json"),
    d3.csv("GCB2022v27_MtCO2_flat.csv")
]).then(([geoData, emissionsData]) => {
    const data = processData(emissionsData);
    let selectedCountry = null;

    // Draw the map
    g.selectAll("path")
        .data(geoData.features)
        .enter().append("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", d => {
            const countryData = data[d.properties.name];
            return countryData ? colorScale(countryData[2021].total) : "gray";
        })
        .attr("stroke", "#000")
        .on("click", function(event, d) {
            const countryData = data[d.properties.name];
            if (countryData) {
                selectedCountry = d.properties.name;
                showCountryData(d.properties.name, countryData);
                highlightCountry(d, data, selectedCountry, this);
            } else {
                console.error(`No data for country: ${d.properties.name}`);
            }
        });

    // Slider event

    
    // Initialize the title with the default year
    d3.select("#currentYear").text(`Year: 2021`);
    // Slider event
    d3.select("#yearSlider").on("input", function() {
        const year = +this.value;
        updateMap(year, data);
        d3.select("#currentYear").text(`Year: ${year}`);
        if (selectedCountry) {
            showCountryData(selectedCountry, data[selectedCountry]);
        }

        updatePieChart(data[selectedCountry][year].factors);

    });
    // Play button automation
    let interval;
    d3.select("#playButton").on("click", function() {
        if (this.textContent === "Play") {
            this.textContent = "Pause";
            interval = setInterval(() => {
                let year = +d3.select("#yearSlider").property("value");
                if (year < 2021) {
                    year++;
                } else {
                    year = 2000;
                }
                d3.select("#yearSlider").property("value", year);
                d3.select("#currentYear").text(`Year: ${year}`);
                updateMap(year, data);
                if (selectedCountry) {
                    showCountryData(selectedCountry, data[selectedCountry]);
                }
            }, 1000);
        } else {
            this.textContent = "Play";
            clearInterval(interval);
        }
    });

    // Line chart dropdown change event
    d3.select("#lineChartDropdown").on("change", function() {
        if (selectedCountry) {
            showCountryData(selectedCountry, data[selectedCountry]);
        }
    });
    createLegend();
});

function processData(emissionsData) {
    const data = {};
    const countryNameMap = {
        "USA": "United States of America",
        "Bosnia and Herzegovina": "Bosnia and Herz.",
        "Czech Republic": "Czechia",
        "Central African Republic": "Central African Rep.",
        "South Sudan": "S. Sudan",
        "Democratic Republic of the Congo": "Dem. Rep. Congo",
        "Eritrea": "Eritrea",
        "Dominican Republic": "Dominican Rep.",
        "Viet Nam": "Vietnam",
        "Equatorial Guinea":"Eq. Guinea",
        "Solomon Islands":"Solomon Is.",
        "Brunei Darussalam":"Brunei",
        "Mauritius":"Mauritania",
    };
    emissionsData.forEach(d => {
        const countryName = countryNameMap[d.Country] || d.Country;
        if (!data[countryName]) data[countryName] = {};
        data[countryName][+d.Year] = {
            total: +d.Total,
            factors: {
                coal: +d.Coal,
                oil: +d.Oil,
                gas: +d.Gas,
                cement: +d.Cement,
                flaring: +d.Flaring,
                other: +d.Other
            }
        };
    });
    return data;
}

function updateMap(year, data) {
    g.selectAll("path")
        .attr("fill", d => {
            const countryData = data[d.properties.name];
            return countryData ? colorScale(countryData[year].total) : "gray";
        });

}

function showCountryData(country, countryData) {
    const year = +d3.select("#yearSlider").property("value");
    const total = countryData[year] ? countryData[year].total : 0;
    const factors = countryData[year] ? countryData[year].factors : {coal: 0, oil: 0, gas: 0, cement: 0, flaring: 0, other: 0};
    d3.select("#countryName").text(`Country: ${country}`);
    d3.select("#totalEmissions").text(`Total Emissions: ${total} MtCO2`);

    // Update pie chart
    updatePieChart(factors);

    // Update line chart
    updateLineChart(countryData);
    
    

}

function updatePieChart(factors) {
    const pieData = Object.keys(factors).map(key => ({
        name: key,
        value: factors[key]
    }));
    const pie = d3.pie().value(d => d.value)(pieData);
    const arc = d3.arc().innerRadius(0).outerRadius(100);

    const svg = d3.select("#pieChart").selectAll("*").remove(); // Clear previous chart

    const g = d3.select("#pieChart")
        .attr("width", 200)
        .attr("height", 200)
        .append("g")
        .attr("transform", "translate(100,100)");

    const colors = d3.schemeCategory10;
    
    g.selectAll("path")
        .data(pie)
        .enter().append("path")
        .attr("d", arc)
        .attr("fill", (d, i) => colors[i]);

    // Add legend
    const legend = d3.select("#pieLegend").selectAll("*").remove(); // Clear previous legend

    const legendGroup = d3.select("#pieLegend")
        .selectAll("div")
        .data(pieData)
        .enter().append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("margin", "4px 0");

    legendGroup.append("div")
        .style("width", "12px")
        .style("height", "12px")
        .style("background-color", (d, i) => colors[i])
        .style("margin-right", "6px");

    legendGroup.append("span")
        .text(d => `${d.name}: ${(d.value / d3.sum(pieData, d => d.value) * 100).toFixed(2)}%`);
}

function updateLineChart(countryData) {
    const metric = d3.select("#lineChartDropdown").property("value");
    const years = Object.keys(countryData).map(d => +d);
    const totals = years.map(d => metric === 'total' ? countryData[d].total : countryData[d].factors[metric]);

    const margin = { top: 20, right: 50, bottom: 30, left: 50 };
    const width = 500 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const xScale = d3.scaleLinear()
        .domain([2000, 2021])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(totals)])
        .range([height, 0]);

    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.total))
        .defined(d => d.year >= 2000);

    const data = years.map(year => ({
        year,
        total: metric === 'total' ? countryData[year].total : countryData[year].factors[metric]
    }));

    const svg = d3.select("#lineChart").selectAll("*").remove(); // Clear previous chart

    const g = d3.select("#lineChart")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

    g.append("g")
        .call(d3.axisLeft(yScale).ticks(5));

    g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5)
        .attr("d", line);

    const focus = g.append("g")
        .attr("class", "focus")
        .style("display", "none");

    focus.append("circle")
        .attr("r", 4.5)
        .attr("fill", "red");

    focus.append("text")
        .attr("x", 9)
        .attr("dy", ".35em");

    // Show focus initially
    focus.style("display", null);

    // Update focus position
    function updateFocus(year) {
        const dataPoint = data.find(d => d.year === year);
        if (dataPoint) {
            const x = xScale(dataPoint.year);
            const y = yScale(dataPoint.total);
            focus.attr("transform", `translate(${x}, ${y})`);

            // Adjust text position within bounds
            const textX = x + 5;
            const textY = y - 10;
            const textWidth = 30; // approximate text width
            const textHeight = 10; // approximate text height

            const boundedTextX = Math.min(Math.max(textX, 0), width - textWidth);
            const boundedTextY = Math.min(Math.max(textY, textHeight), height);

            focus.select("text")
                .text(dataPoint.total.toFixed(2))
                .attr("x", boundedTextX - x)  // relative to the focus group
                .attr("y", boundedTextY - y); // relative to the focus group
        }
    }

    d3.select("#yearSlider").on("input", function() {
        const year = +this.value;
        updateFocus(year);
    });

    const initialYear = +d3.select("#yearSlider").property("value");
    updateFocus(initialYear);
}


function highlightCountry(d, data, selectedCountry, element) {
    const [[x0, y0], [x1, y1]] = path.bounds(d);
    svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(Math.min(8, 0.9 / Math.max((x1 - x0) / width, (y1 - y0) / height)))
            .translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
    );

    g.selectAll("path")
        .attr("stroke", "#000")
        .attr("stroke-width", 1);
    
    //Zoom and red border
    d3.select(element)
        .attr("stroke", "red")
        .attr("stroke-width", 2);
    
    
    d3.select("#yearSlider").on("change", function() {
        const year = +this.value;
        updateMap(year, data);
        d3.select("#currentYear").text(`Year: ${year}`);
        if (selectedCountry) {
            showCountryData(selectedCountry, data[selectedCountry]);
        }
        updatePieChart(data[selectedCountry][year].factors);
    });
    
    
}
let currentYear = 2021;
function setCurrentYear() {
    currentYear = +d3.select("#yearSlider").property("value");
}
function createLegend() {
    const legendData = [
        { color: "#ffe6e6", label: "0-500" },
        { color: "#ffcccc", label: "500-1000" },
        { color: "#ff9999", label: "1000-3500" },
        { color: "#ff6666", label: "3500-7000" },
        { color: "#ff3333", label: "7000-10000" },
        { color: "#990000", label: "10000+" }
    ];

    const legend = d3.select("#legend");

    legendData.forEach(item => {
        const legendItem = legend.append("div").attr("class", "legend-item");
        legendItem.append("div")
            .attr("class", "legend-color")
            .style("background-color", item.color);
        legendItem.append("span")
            .text(item.label);
    });

    
    legend.selectAll(".legend-item")
        .style("display", "inline-block")
        .style("margin-right", "10px"); 
}
