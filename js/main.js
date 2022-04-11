function loadSampleGPX(fileName1, fileName2) {
	d3.xml("data/" + fileName1 + ".gpx", function(data) {
		d3.xml("data/" + fileName2 + ".gpx", function(data2) {
			loadGPXViewer(data, data2);
		});
	});
};

//loadSampleGPX("You_know_you_ve_made_it_when_your_phone_autocorrects_l_to_LVRC_", "With_Lakeview_Run_Club_Ryan");
loadSampleGPX("A_grueling_recovery_run", "TomMarch");
//loadSampleGPX("OliverFeb", "TomFeb");