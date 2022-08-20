const primaryColor = '#0024d9';
const secondaryColor = 'red';

function readGPXdata(fileName1, fileName2) {
	d3.xml("data/" + fileName1 + ".gpx").then((xml) => {

        var data = [];
        var coords = [];
        d3.select(xml).selectAll("trk").selectAll("trkseg").selectAll("trkpt").each(function() {
            var lat = parseFloat(d3.select(this).attr("lat"));
            var lon = parseFloat(d3.select(this).attr("lon"));
            var latLon = [lat, lon];
            var timeStamp = !d3.select(this).select("time").node() ? null : new Date(d3.select(this).select("time").text());
            
            data.push({'runner':'oliver', 'latLon':latLon, 'timeStamp':timeStamp});
            coords.push([lat, lon]);
        });

		d3.xml("data/" + fileName2 + ".gpx").then((xml2) => {

            var data2 = [];
            var coords2 = [];
            d3.select(xml2).selectAll("trk").selectAll("trkseg").selectAll("trkpt").each(function() {
                var lat = parseFloat(d3.select(this).attr("lat"));
                var lon = parseFloat(d3.select(this).attr("lon"));
                var latLon = [lat, lon];
                var timeStamp = !d3.select(this).select("time").node() ? null : new Date(d3.select(this).select("time").text());
                
                data2.push({'runner':'tom', 'latLon':latLon, 'timeStamp':timeStamp});
                coords2.push([lat, lon]);
            });

			mapGPXfiles(data, data2, coords, coords2);
		});
	});
};

function mapGPXfiles(data, data2, coords, coords2) {

    // set up the plot space
    let box = document.getElementById('flybyMap');
    let width = box.offsetWidth;

    // set the dimensions and margins of the graph
    var margin = {top: 10, right: 20, bottom: 20, left: 20};
    width = width - margin.left - margin.right;
    var height = width - margin.top - margin.bottom;

    // leaflet stuff - create lines, generate map, add lines to map, set map to correct bounds
    var polyline = L.polyline(coords, {
        color: primaryColor,
        weight: 2,
        smoothFactor: 1,
        opacity: 0.8
    });
    var polyline2 = L.polyline(coords2, {
        color: secondaryColor,
        weight: 2,
        smoothFactor: 1,
        opacity: 0.8
    })

    var map = L.map('flybyMap');
    L.tileLayer('https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    polyline.addTo(map);
    polyline2.addTo(map);

    bounds = L.latLngBounds(coords.concat(coords2));
    map.fitBounds(bounds);
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    map.dragging.disable();
    document.querySelector(".leaflet-control-zoom").style.display = 'none';

    // plot the 'current point' circle
	// grab SVG from the map object
	var svg = d3.select("#flybyMap").select("svg"),
	g = svg.append("g");

    var oliverCircle = g.append("circle")
        .style("stroke", "black")  
        .style("opacity", 0.6) 
        .style("fill", primaryColor)
        .attr("r", 10)
        .attr('cx', map.latLngToLayerPoint(data[0].latLon).x)
        .attr('cy', map.latLngToLayerPoint(data[0].latLon).y);

    var tomCircle = g.append("circle")
        .style("stroke", "black")  
        .style("opacity", 0.6) 
        .style("fill", secondaryColor)
        .attr("r", 10)
        .attr('cx', map.latLngToLayerPoint(data2[0].latLon).x)
        .attr('cy', map.latLngToLayerPoint(data2[0].latLon).y);

    // between both activities, get the earliest and latest timestamps
    const minMaxTimeStamps = d3.extent(data.concat(data2), function(d) { return d.timeStamp; });

    // used for moving the circle around
	var latScale = d3.scaleTime().domain(data.map(function (d) {return d.timeStamp.getTime() / 1000})).range(data.map(function (d) {return d.latLon[0]})).clamp(true);
    var lonScale = d3.scaleTime().domain(data.map(function (d) {return d.timeStamp.getTime() / 1000})).range(data.map(function (d) {return d.latLon[1]})).clamp(true);
	var latScale2 = d3.scaleTime().domain(data2.map(function (d) {return d.timeStamp.getTime() / 1000})).range(data2.map(function (d) {return d.latLon[0]})).clamp(true);
	var lonScale2 = d3.scaleTime().domain(data2.map(function (d) {return d.timeStamp.getTime() / 1000})).range(data2.map(function (d) {return d.latLon[1]})).clamp(true);

    var dur = 100;

    // this is not very performant
    for (var i = minMaxTimeStamps[0].getTime() / 1000, z = 0; i < minMaxTimeStamps[1].getTime() / 1000; i+=4, z++) {
        var latLon1 = [latScale(i), lonScale(i)];
        var layerPoint1 = map.latLngToLayerPoint(latLon1);
        var latLon2 = [latScale2(i), lonScale2(i)];
        var layerPoint2 = map.latLngToLayerPoint(latLon2);
        oliverCircle
            .transition()
            .duration(dur)
            .delay(dur / 5 * z)
            .attr('cx', layerPoint1.x)
            .attr('cy', layerPoint1.y);
        tomCircle
            .transition()
            .duration(dur)
            .delay(dur / 5 * z)
            .attr('cx', layerPoint2.x)
            .attr('cy', layerPoint2.y);
    }
}

readGPXdata("A_grueling_recovery_run", "TomMarch");