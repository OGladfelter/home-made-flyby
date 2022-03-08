function loadSampleGPX() {
	d3.xml("data/Same_route_twice_.gpx", function(data) {
		d3.xml("data/Long_run_with_Jake.gpx", function(data2) {
			loadGPXViewer(data, data2);
		});
	});
};

loadSampleGPX();