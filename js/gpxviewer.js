var autoPlayId = -1, playing = false;
var minMaxDates; 
var dateList = []; 		// ISO 8601
var lonList = []; 		// decimal degrees
var latList = []; 		// decimal degrees
var eleList = [];		// meters
var courseList = [];	// degrees
var speedList = [];		// m/s
var pdopList = [];
var lineString = [];
var lonScale, latScale, eleScale, speedScale;

var customTimeFormat = d3.time.format.multi([
	[".%L", function(d) { return d.getMilliseconds(); }],
	[":%S", function(d) { return d.getSeconds(); }],
	["%I:%M", function(d) { return d.getMinutes(); }],
	["%I %p", function(d) { return d.getHours(); }],
	["%a %d", function(d) { return d.getDay() && d.getDate() != 1; }],
	["%b %d", function(d) { return d.getDate() != 1; }],
	["%B", function(d) { return d.getMonth(); }],
	["%Y", function() { return true; }]
]);

var margin = {top: 10, right: 10, bottom: 10, left: 10},
	width = 650 - margin.left - margin.right,
	height = 50 - margin.bottom - margin.top,
	currentValue = 0,
	targetValue = 0,
	moving = false, // is it currently moving?
	alpha = 0.2,
	scrubCat = 0, // 0, 1, 2, 3
	scrubSensitivity = [0.1, 0.001, 0.0000625, 0.00000625], //[0.2, 0.002, 0.000125, 0.0000125],
	y0 = 0.0,
	zoomEventXY = [],
	zoomReset = true,
	zoomEventScale,
	handleRadius = 6;
	
var chartWidth, chartHeight, eleChartX, eleChartY, speedChartX, speedChartY;
var pathGeometry;
var projection, path, zoomControl;
var x, brush, slider, handle;
var testDiv, testArea, raster;

function brushed(init) {
	if (d3.event && d3.event.sourceEvent) { // not a programmatic event
		targetValue = x.invert(d3.mouse(this)[0]);
		
		var maxHeight = Math.abs(window.innerHeight - y0) * (2/3);
		//var sensitivityRange = [0.2, 0.00001];
		//var sensitivity = d3.scale.pow().exponent(0.5).domain([0, maxHeight]).range(sensitivityRange)(Math.min(Math.abs(d3.event.sourceEvent.y - y0), maxHeight));
		//var indicator = d3.scale.linear().domain(sensitivityRange).range([handleRadius, 1])(sensitivity);

		var dy = Math.min(Math.abs(d3.event.sourceEvent.y - y0), maxHeight);
		var dPer = dy/maxHeight, dIndicatorRadius = handleRadius;
		scrubCat = 0;
		
		if (dPer >= 0.0 && dPer < 0.25) {
			scrubCat = 0;
			dIndicatorRadius = handleRadius;
		} else if (dPer >= 0.25 && dPer < 0.5) {
			scrubCat = 1;
			dIndicatorRadius = 4.242640687119285;
		} else if (dPer >= 0.5 && dPer < 0.75) {
			scrubCat = 2;
			dIndicatorRadius = 3;
		} else if (dPer >= 0.75 && dPer <= 1.0) {
			scrubCat = 3;
			dIndicatorRadius = 2.1213203435596424;
		}

		handle.transition().duration(200).attr("r", dIndicatorRadius);

		stopPlay();
		move();

		return;
	} else if (init) {
		slider.call(brush.extent([minMaxDates[0], minMaxDates[0]])).call(brush.event);
	}

	currentValue = brush.extent()[0];
	handle.attr("cx", x(currentValue));

	var format = d3.time.format("%d %b %Y %I:%M:%S %p");
	var currentValueRounded = Math.round(currentValue);
	var text1 = format(new Date(currentValueRounded));

	d3.select("div#console").text(text1);
	d3.select("svg#testArea circle.track")
		.attr("transform", function(d) {
			return "translate(" + projection([lonScale(new Date(currentValueRounded)), latScale(new Date(currentValueRounded))]) + ")"
		});		
};

function stopMove() {
	targetValue = currentValue;
};

function move(sensitivity) {
	if (moving) return false;
	moving = true;
	
	d3.select("button#playpausebtn").attr("disabled", "true");

	d3.timer(function() {
		var sensitivity = scrubSensitivity[scrubCat];
		if (sensitivity > alpha || sensitivity < 0.0) sensitivity = alpha;

		currentValue = Math.abs(currentValue - targetValue) < 1e-3
			? targetValue
			: targetValue * sensitivity + currentValue * (1 - sensitivity);

		// var myDate = new Date( currentValue);
		// console.log(myDate.toGMTString()+"<hr>"+myDate.toLocaleString());

		slider.call(brush.extent([currentValue, currentValue])).call(brush.event);

		var newMoving = Math.round(currentValue/1000) !== Math.round(targetValue/1000);
		if (!newMoving) d3.select("button#playpausebtn").attr("disabled", null);

		return !(moving = newMoving);
	}, 200);
};

function stopPlay() {
	clearTimeout(autoPlayId);
	autoPlayId = -1;
	playing = false;
	moving = false;

	//set play button text to: play
	d3.select("button#playpausebtn").text("Play");
};

function play(immediate = false) {
	autoPlayId = setTimeout(function() {
		if (moving) return false;
		moving = true;
		playing = true;
		
		//set play button text to: pause
		d3.select("button#playpausebtn").text("Pause");

		targetValue = minMaxDates[1];
		var startValue = new Date(brush.extent()[0]);
		var timeNow = new Date();

		d3.timer(function() {
			var lapsed = ( (new Date() - timeNow) * 1000 );
			currentValue = startValue.getTime() + lapsed;
			// var myDate = new Date( currentValue);
			// console.log(myDate.toGMTString()+"<hr>"+myDate.toLocaleString());
			slider.call(brush.extent([currentValue, currentValue])).call(brush.event);

			var newMoving = Math.round(currentValue/1000) < Math.round(targetValue/1000);
			var finished = !moving || !(moving = newMoving) || !playing || autoPlayId == -1;
			if (finished) {
				d3.select("button#playpausebtn").text("Play");
				stopPlay();
			}
			
			return finished;
		});
	}, (immediate) ? 0 : 3000);
};

function leftShiftCorrectly(a, b) {
	return ((a << b) < 0) ? leftShiftCorrectly(a, --b) : (a << b);
}

function setInitialExtent() {
	
	var tWidthAndHeight = getWidthAndHeight(testArea);
	var tWidth = tWidthAndHeight[0];
	var tHeight = tWidthAndHeight[1];

	var b = path.bounds(pathGeometry); // [[left, top],[right, bottom]]
	var s = leftShiftCorrectly((0.95 / Math.max((b[1][0] - b[0][0]) / tWidth, (b[1][1] - b[0][1]) / tHeight)), 10);
		s = Math.pow(2, Math.floor(Math.log(s)/Math.log(2))); // to smallest scale that is a power of 2.
		s = Math.min(s, zoomControl.scaleExtent()[1]); // shouldn't exceed max zoom limits;
		s = Math.max(s, zoomControl.scaleExtent()[0]); // shouldn't exceed min zoom limits;
	var c = projection.scale(s / 2 / Math.PI)(d3.geo.centroid(pathGeometry));

	// useful for zooming/panning to current point
	//var s = 1048576;
	//var c = projection.scale(s / 2 / Math.PI)([lonList[0], latList[0]]);

	var orig = projection([0, 0]);
	var t = [tWidth/2 - (c[0] - orig[0]), tHeight/2 - (c[1] - orig[1])];

	zoomControl.scale(s).translate(t);
};

function redraw() {
	var zoomBehaviour = true; // true is zoom, false is pan
	if (d3.event) {
		if (zoomEventScale == d3.event.scale) { // panning
			zoomBehaviour = false;
			zoomReset = false;
		} else { // zooming
			zoomBehaviour = true;
			zoomReset = true;
		}
		
		if (zoomReset) {
			zoomEventXY = d3.event.translate;
			zoomReset = false;
		}
		
		zoomEventScale = d3.event.scale;
	}

	var tiles = d3.geo.tile()
					.size(getWidthAndHeight(testArea))
					.scale(zoomControl.scale())
					.translate(zoomControl.translate())
					();

	projection.scale(zoomControl.scale() / 2 / Math.PI).translate(zoomControl.translate());
	
	//console.log(zoomControl.scale() + " ----- " + zoomControl.translate() + " ----- " + projection.scale() + " ----- " + projection.translate());
	
	if (zoomBehaviour || !(d3.event)) {
		testArea.select("path.trackpath").attr("d", path).attr("transform", null);
	} else {
		var x = d3.event.translate[0] - zoomEventXY[0];
		var y = d3.event.translate[1] - zoomEventXY[1];
		var asd = testArea.select("path.trackpath").attr("transform");
		testArea.select("path.trackpath").attr("transform", "translate(" + [x, y] + ")");
	}
	
	
	var currentValueRounded = Math.round(brush.extent()[0]);
	testArea.select("circle.track")
		.attr("transform", function(d) {
			return "translate(" + projection([lonScale(new Date(currentValueRounded)), latScale(new Date(currentValueRounded))]) + ")"
		});
	
		
		
	var image = raster.attr("transform", "scale(" + tiles.scale + ")translate(" + tiles.translate + ")")
						.selectAll("image")
						.data(tiles, function(d) { return d; });

	image.exit().remove();

	image.enter().append("image") // examples.map-9ijuk24y // examples.map-vyofok3q
			.attr("xlink:href", function(d) { return `https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/${d[2]}/${d[0]}/${d[1]}.png`})
			.attr("width", 1)
			.attr("height", 1)
			.attr("x", function(d) { return d[0]; })
			.attr("y", function(d) { return d[1]; });
};

function getWidthAndHeight(element) {
	return [parseInt(element.style("width"), 10), parseInt(element.style("height"), 10)];
};

function pause() {
	//console.log("pause...");
	stopPlay();
}

function loadGPXViewer(data) {
	dateList = [];
	lonList = [];
	latList = [];
	eleList = [];
	courseList = [];
	speedList = [];
	pdopList = [];
	lineString = [];


	stopPlay();
	stopMove();
	
		
		
	// Load GPX data
	var trkPtData = d3.select(data).selectAll("trk").selectAll("trkseg").selectAll("trkpt").each(function() {
		var lat = parseFloat(d3.select(this).attr("lat"));
		var lon = parseFloat(d3.select(this).attr("lon"));
		
		latList.push(lat);
		lonList.push(lon);
		lineString.push([lon, lat]);
		
		dateList.push((!d3.select(this).select("time").node()) ? null : new Date(d3.select(this).select("time").text()));
		eleList.push((!d3.select(this).select("ele").node()) ? null : parseFloat(d3.select(this).select("ele").text()));
		courseList.push((!d3.select(this).select("course").node()) ? null : parseFloat(d3.select(this).select("course").text()));
		speedList.push((!d3.select(this).select("speed").node()) ? null : parseFloat(d3.select(this).select("speed").text()));
		pdopList.push((!d3.select(this).select("pdop").node()) ? null : parseFloat(d3.select(this).select("pdop").text()));
	});

	if (lineString.length <= 1) {
		alert("GPX file should contain at least a track, made of at least one segment containing waypoints.");
		return false;
	}

	d3.select("body").selectAll("div#gpxCtr *, div#appTitle div#playbackControl").remove();


	minMaxDates = d3.extent(dateList);//[dateList[0], dateList[dateList.length-1]];
	console.log("dates #: " + dateList.length + " \t longitudes #: " + lonList.length + " \t latitudes #: " + latList.length + " \t elevation #: " + eleList.length + " \t speed #: " + speedList.length);
	
	lonScale = d3.time.scale().domain(dateList).range(lonList).clamp(true);
	latScale = d3.time.scale().domain(dateList).range(latList).clamp(true);
	
	pathGeometry = { "type": "LineString", "coordinates": lineString };
	
	
	
	// Map projection stuffs
	projection = d3.geo.mercator().scale((1 << 10) / 2 / Math.PI);
	
	path = d3.geo.path().projection(projection);
	
	//http://stackoverflow.com/questions/20409484/d3-js-zoomto-point-in-a-2d-map-projection
	zoomControl = d3.behavior.zoom()
						.scaleExtent([1 << 10, 1 << 26])
						.scale(projection.scale() * 2 * Math.PI)
						.translate([window.innerWidth / 2, window.innerHeight / 2])
						.on("zoom", redraw);

		
		
	// Timeline, brush, labels and stuffs
	x = d3.time.scale()
		.domain(minMaxDates)
		.range([0, width])
		.clamp(true);
		
	brush = d3.svg.brush()
		.x(x)
		.extent([0, 0])
		.on("brush", brushed)
		.on("brushstart", function() {
			if (d3.event && d3.event.sourceEvent) { // not a programmatic event
				y0 = d3.event.sourceEvent.y;
			}
		})
		.on("brushend", function() {
			if (d3.event && d3.event.sourceEvent) { // not a programmatic event
				if (scrubCat != 0) stopMove();
				handle.transition().duration(200).attr("r", handleRadius);
			}
		});


	
	
	var appTitleControlContainer = d3.select("div#appTitle").append("div").attr("id", "playbackControl");
	var gpxContainer = d3.select("body div#gpxCtr");
	
	
	
	// Controls	
	var div = appTitleControlContainer.append("div").attr("id", "console")
					.style("font-size", "smaller")
					.style("font-weight", "normal")
					.style("position", "absolute")
					.style("line-height", "45px")
					.style("right", "10px")
					.style("top", "0px")
					.style("padding-right", "10px");

	var playButton = appTitleControlContainer.append("button")
					.attr("id", "playpausebtn")
					.style("right", (width + margin.left + margin.right + 10 + 170 + 10) + "px")
					.text("Play")
					.on("click", function(d) {
						if (playing || autoPlayId != -1) { //pause
							stopPlay();
						} else { //play
							play(true);
						}
					});

	var svg = appTitleControlContainer.append("svg")
					.attr("id", "timeslider")
					.attr("width", width + margin.left + margin.right + 10)
					.attr("height", height + margin.top)
					.style("position", "absolute")
					//.style("right", margin.right+"px")
					.style("right", "170px")
					.style("top", "0px")
					.append("g")
						.attr("transform", "translate(" + margin.left + "," + 0 + ")");

	var axisLines = svg.append("g")
						.attr("class", "axisLine")
						.attr("transform", "translate(0," + ((height / 2) + 3) + ")")
						.style("font-size", "0 pt")
						.call(d3.svg.axis()
								.scale(x)
								.tickFormat(customTimeFormat)
								.tickValues(null));
	axisLines.selectAll("text").remove();
	axisLines.selectAll("path").remove();

	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + (height / 2) + ")")
		.style("font-size", "6 pt")
		//.style("font-weight", "bold")
		.style("fill", "#fff")
		.call(d3.svg.axis()
			.scale(x)
			.tickFormat(customTimeFormat)
			.tickPadding(12)
			.tickSize(0))
		.select(".domain")
		.style("stroke", "#111")
		//.style("stroke-opacity", 0.5)
		.select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
		.attr("class", "halo")
		.style("stroke-opacity", 1.0)
		.style("stroke", "#fff");

	slider = svg.append("g")
		.attr("class", "slider")
		.call(brush);

	slider.selectAll(".extent,.resize").remove();
	slider.select(".background").attr("height", height).attr("fill", "#111").style("cursor", "ew-resize");

	handle = slider.append("circle")
		.attr("class", "handle")
		.attr("transform", "translate(0," + (height / 2) + ")")
		.attr("r", handleRadius)
		.style("fill", "#fff");
	
	
	
	// Map area
	testDiv = gpxContainer.append("div").style("width", "100%").style("height", "100%");
	
	testArea = testDiv.append("svg")
					.attr("id", "testArea")
					.style("height", "100%")
					.style("width", "100%")
					//.attr("width", width + margin.left)
					//.attr("height", testMapHeight)
					//.style("border", "1px solid black")
					.call(zoomControl);

	raster = testArea.append("g"); // Base map
	
	testArea.append("path")
		.datum(pathGeometry)
		.attr("class", "trackpath")
		.attr("d", path)
		.attr("fill", "none")
		.attr("stroke", "rgb(222,45,38)")
		.attr("stroke-width", 1);

	testArea.append("circle")
			.attr("class", "track")
			.attr("id", "testTrack")
			.attr("r", 4)
			.style("fill", "rgb(222,45,38)")
			.style("stroke-width", 1)
			.style("stroke", "rgb(0,0,0)");

	// do not shift this order!
	setInitialExtent(); 							// fit initial view to all gps data
	redraw(); 										// initialise basemap, path and point
	// play();										// auto play gps track recording
	//setTimeout(function() { brushed(true); }, 200);	// initialise position of brush

	return true;
}