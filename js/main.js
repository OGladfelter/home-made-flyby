var handleFileSelect = function(evt) {
	evt.stopPropagation();
	evt.preventDefault();

	this.classList.remove('dropping'); 

	var files = evt.dataTransfer.files; // FileList object.
	xferFiles(files);
}

var xferFiles = function(files) {
	for (var i = 0, f; f = files[i]; i++) {
		//console.log("Dropzone content-type: " + f.type);

		var reader = new FileReader();

		// Closure to capture the file information.
		reader.onload = (function(theFile) {
			return function(e) {
				var data;
				try {
					data = (new DOMParser()).parseFromString(e.target.result, "text/xml");
				} catch (err) {
					console.log(err);
					alert("a minor data loading hiccup");
					return;
				}
				if (!data) return;
				
				var loadSucess = d3gpx.loadGPXViewer(data);
				
				if (!loadSucess) return;

				//document.title = "d3.gpx - " + theFile.name.split(".")[0];
				document.title = "d3.gpx - " + theFile.name;
				
				var desc = document.getElementById("appTitle").getElementsByClassName("sample")[0];
				//desc.innerHTML = theFile.name.split(".")[0].substr(0,17)+"...";
				desc.innerHTML = theFile.name;
			};
		})(f);

		reader.readAsText(f); // Read in the image file as a data URL.
	}
}

function handleDragEnter(evt) {
	this.classList.add('dropping'); // this / e.target is the current hover target.
}

function handleDragLeave(evt) {
	this.classList.remove('dropping');  // this / e.target is previous target element.
}

function handleDragOver(evt) {
	evt.stopPropagation();
	evt.preventDefault();
	evt.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
}

function loadSampleGPX() {
	d3.xml("data/Same_route_twice_.gpx", function(data) {
		d3.xml("data/Long_run_with_Jake.gpx", function(data2) {
			loadGPXViewer(data, data2);
		});
	});
};

// Setup the dnd listeners.
var dropZone = document.getElementsByClassName('dDataDropZone')[0];
	dropZone.addEventListener('dragover', handleDragOver, false);
	dropZone.addEventListener('drop', handleFileSelect, false);
	dropZone.addEventListener('dragenter', handleDragEnter, false);
	dropZone.addEventListener('dragleave', handleDragLeave, false);

var fileUpload = document.getElementById('dDataFileUpload');
fileUpload.addEventListener("change", function () {
	xferFiles(this.files);
}, false);

loadSampleGPX();