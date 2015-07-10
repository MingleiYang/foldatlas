// Create the browser controller class
var BrowserController = Class.extend({

	// Constructor
	init: function(config) {
		this.fornaContainer = null;
		this.nucsPerRow = 80;
		this.staticBase = config.staticBaseUrl;
		this.reactivities = {};
		this.drawTranscriptData();
		this.searchController = new SearchController(this);

		$("#title").click($.proxy(function() { this.goHome(); }, this));
	},

	// Jump to a specific transcript page
	selectTranscript: function(transcriptID) {
		this.showLoading();
		this.changeUrl(transcriptID, "/transcript/"+transcriptID)
		$.ajax({
			url: "/ajax/transcript/"+transcriptID,
			context: this
		}).done(function(results) {
			this.hideLoading();
			$("#search").hide()
			$("#d3nome").show();
			$("#transcript-data").empty();
			$("#transcript-data").html(results);
			this.drawTranscriptData();
		});
	},

	showLoading: function() {
		$("#loading-indicator").show()
	},

	hideLoading: function() {
		$("#loading-indicator").hide()
	},

	// Reset to landing page
	goHome: function() {
		this.changeUrl("", "/")
		$("#search").hide()
		$("#d3nome").show();
		$("#loading-indicator").hide();
		$("#transcript-data").empty();
	},

	// HTML5 change URL method
	changeUrl: function(title, url) {
	    if (typeof (history.pushState) != "undefined") {
	        var obj = { Page: "FoldAtlas: "+title, Url: url };
	        history.pushState(obj, obj.Page, obj.Url);
	    } else {
	    	// TODO show a prettier warning
	        alert("Your browser does not support HTML5. Please upgrade it.");
	    }
	},

	getJsonFromElement: function(elementID) {
		var html = $("#"+elementID).html();
		if (html == undefined) { // this means no measurement data to show
			return null;
		}
		var json = $.parseJSON(html);
		return json;
	},

	drawTranscriptData: function(reactivities) {
		var structureData = this.getJsonFromElement("structure-json")

		// TODO better way to detect whether there is stuctural data
		if (structureData) {
			this.structureExplorer = new StructureExplorer(this)
		}

		var measurementData = this.getJsonFromElement("nucleotide-measurement-json")
		if (measurementData) {
			this.drawNucleotideMeasurements(measurementData[1]);
			this.drawNucleotideMeasurements(measurementData[2]);
		}
	},

	drawNucleotideMeasurements: function(experimentData) {
		var detailedID = "nucleotide-measurements-overview_"+experimentData["id"];
		var overviewID = "nucleotide-measurements-detailed_"+experimentData["id"];

		// Add HTML elements
		var buf = 
			"<h2>"+experimentData["description"]+"</h2>"+
			"<svg id=\""+overviewID+"\"></svg>"+
			"<svg id=\""+detailedID+"\"></svg>";
		$("#nucleotide-measurement-charts").append(buf)

		// Draw the charts
		this.drawNucleotideMeasurementsOverview(overviewID, experimentData);
		this.drawNucleotideMeasurementsDetailed(detailedID, experimentData);
	},

	drawNucleotideMeasurementsOverview: function(svgID, experimentData) {
		console.log("drawNucleotideMeasurementsOverview: "+svgID);
	},

	// Visualises the measurement data.
	drawNucleotideMeasurementsDetailed: function(svgID, experimentData) {

		var yLabelText = (experimentData["type"] == "dms_reactivity") 
			? "Reactivity"
			: "Occupancy";

		var data = experimentData["data"]
		if (data == null) { // can happen
			return;
		}

		var nDataRows = data.length;
		var nChartRows = Math.ceil(nDataRows / this.nucsPerRow);

		// Define chart dimensions including axis panelMargins
		var panelMargin = {top: 15, right: 60, bottom: 30, left: 70}
		var panelTotDims = {x: 898, y: 100}

		// dims without margins
		var panelDims = { 
			x: panelTotDims.x - panelMargin.left - panelMargin.right,
			y: panelTotDims.y - panelMargin.bottom - panelMargin.top
		}

		// Total dimensions of chart across all panels and margins.
		var chartDims = {
			x: panelTotDims.x,
			y: panelTotDims.y * nChartRows
		}

		// var	width = panelTotDims.x - panelMargin.left - panelMargin.right,
		// 	height = panelTotDims.y - panelMargin.bottom - panelMargin.top;

		// Init the chart's container element
		var chart = d3.select("#"+svgID)
			.attr("width", chartDims.x)
			.attr("height", chartDims.y)

		var maxY = d3.max(data, function(d) { return d.measurement; });

		// Define the scales
		var yScale = d3.scale.linear()
			// range maps to the pixel dimensions.
		    // domain describes the range of data to show.
		    .range([panelDims.y, 0])
		    .domain([0, maxY]);

		// when there is no measurement data, degrade gracefully
		if (isNaN(yScale.domain()[1])) { 
			
			chart.append("text")
		      .attr("transform", "translate("+(panelTotDims.x / 2)+", "+(panelTotDims.y / 2)+")")
		      .style("text-anchor", "middle")
		      .text("No measurement data");
			return;
		}
		
		for (var rowN = 0; rowN < nChartRows; rowN++) { // each iteration = 1 chart row
			var start = rowN * this.nucsPerRow;
			var end = start + this.nucsPerRow;

			if (end > nDataRows) {
				end = nDataRows;
			}

			var dataSlice = data.slice(start, end);

			var nucsThisRow = end - start;

			// this is for panel positioning.
			panelYOffset = rowN * panelTotDims.y;

			// Shows nucleotide numbers
			var rangeX = parseInt(panelDims.x * ((nucsThisRow - 1) / this.nucsPerRow));

			var xScale = d3.scale.linear()
			    .range([0, rangeX], .1) 
			    .domain([start - 0.5, (end - 1) + 0.5])

		   	// Create axis objects
			var xAxis = d3.svg.axis()
			    .scale(xScale)
			    .orient("bottom")
			    .ticks(nucsThisRow)
				.tickFormat(function(d, i) { return data[d].nuc; }) // tells it to use the nucleotide letter

			var yAxis = d3.svg.axis()
			    .scale(yScale)
			    .orient("left")
	    		.ticks(3); // how many ticks to show.

			// Add x-axis objects to the chart.
			var bgWidth = parseInt(panelDims.x / this.nucsPerRow) + 1;

			chart.append("g")
				.attr("class", "x axis")
				.attr("transform", "translate("+
					panelMargin.left+","+
					(panelYOffset + panelDims.y + panelMargin.top)
				+")")
				.call(xAxis)

				// select the X axis tick element
				.selectAll(".tick")

				// aadd a rect to it, first child means it draws in the background
				.insert("rect", ":first-child")

				// set position and dimensions of rectangle element.
				.attr("transform", "translate("+(-bgWidth / 2)+", "+10+")")
				.attr("width", bgWidth)
				.attr("height", 10)

				// highlight nucleotides with missing reactivities
				.attr("class", function(n, i) {
					return (dataSlice[i].measurement == null) ? 
						"missing-bg" : "not-missing-bg";
				})

			// Add y-axis objects to the chart
			chart.append("g")
				.attr("class", "y axis")
				.attr("transform", "translate("+
					panelMargin.left+","+
					(panelYOffset + panelMargin.top)+
				")")
				.call(yAxis);

			// Add x axis label
		    chart.append("text")
		        .attr("transform", "translate("+
		        	(panelMargin.left + (panelDims.x / 2))+","+
		        	(panelYOffset + panelDims.y + panelMargin.top)+
	        	")")
		        .style("text-anchor", "middle")
		        .attr("dy", "2.7em");
		        // .text("Nucleotide");

			// Add y-axis label
			chart.append("text")
		        .attr("transform", "rotate(-90)")
		        .attr("y", panelMargin.left) // this is actually X direction, because we rotated.
		        .attr("x", (-panelYOffset - (panelMargin.top + (panelDims.y / 2))))
		        .attr("dy", "-2.7em")
		        .style("text-anchor", "middle")
		        .text(yLabelText);

	        // Add length label
	        var panelDimsX = panelDims.x * (nucsThisRow / this.nucsPerRow);
			chart.append("text")
		        .attr("x", panelMargin.left + panelDimsX)
		        .attr("y", panelYOffset + panelMargin.top + panelDims.y)
		        .style("text-anchor", "left")
		        .attr("dy", "1.3em")
		        .text(end);

			// Draw bars
			var barWidth = parseInt(panelDims.x / this.nucsPerRow);
			var bar = chart
				.selectAll("g.nucleotide-measurement-bar r"+rowN)
				.data(dataSlice).enter()
				.append("g")
				.attr("class", "nucleotide-measurement-bar r"+rowN)
				.attr("transform", function(d) { 
					return "translate("+
						(panelMargin.left + xScale(d.position) - (barWidth / 2))+","+
						(panelYOffset + panelMargin.top + yScale(d.measurement))+
					")";
				});

			bar.append("rect")
				.attr("height", function(d) { 
					return yScale(maxY - d.measurement);
				})
				.attr("width", barWidth);


			// Draw line chart
			// var lineGen = d3.svg.line()
			//     .x(function(d) { return panelMargin.left + xScale(d.position); })
			//     .y(function(d) { return panelYOffset + panelMargin.top + yScale(d.measurement); });

	 	// 	chart.append("path")
			// 	.datum(dataSlice) // get data specific to this row
			// 	.attr("class", "line")
			// 	.attr("d", lineGen);
		} // End looping through chart rows
	}
})

/**
 * SearchController handles interactivity for the search module shown on the landing page.
 */
var SearchController = Class.extend({

	// Constructor
	init: function(browserController) {
		this.browserController = browserController;
		this.tabElements = []

		$("#search-button").click($.proxy(function(ev) {
			ev.preventDefault()
			this.browserController.changeUrl("Search", "/search");
			$("#transcript-data").empty();
			$("#search").show()
			$("#d3nome").hide();
		}, this));
		this.initTabs();
		this.transcriptIDSearchController = new TranscriptIDSearchController(this.browserController);
		this.coverageSearchController = null; // initialises when tab is selected
	},

	initTabs: function() {
		this.initTab($("#search-tab-transcript-id"));
		this.initTab($("#search-tab-coverage"), $.proxy(function() {
			if (this.coverageSearchController == null) {
				this.coverageSearchController = new CoverageSearchController(this.browserController);
			}
		}, this));
	},

	initTab: function(element, tabClickCallback) {
		this.tabElements.push(element);
		element.click($.proxy(function(element) {
			$("#transcript-data").html("")
			var clickedElement = $(element);

			for (var i = 0; i < this.tabElements.length; i++) {
				var currElement = this.tabElements[i];
				var currPanelElement = $("#"+currElement.data("ui-id"));

				if (clickedElement.attr("id") != currElement.attr("id")) {
					currElement.removeClass("active")
					currPanelElement.hide()

				} else {
					currElement.addClass("active")
					currPanelElement.show()
				}
			}
			if (typeof(tabClickCallback) !== "undefined") {
				tabClickCallback()
			}
		}, this, element))
	}
})


var TranscriptIDSearchController = Class.extend({
	init: function(browserController) {
		this.browserController = browserController;

		var handle = $.proxy(function() {
			var term = $("#search-transcript-id-text").val();
			this.searchTranscriptID(term)
		}, this)

		$("#search-transcript-id-submit").click(handle);
		$('#search-transcript-id-text').on("keypress", $.proxy(function(e) {
        	if (e.keyCode == 13) handle()
        }, this));
	},

	searchTranscriptID: function(term) {
		this.browserController.showLoading();
		$.ajax({
			url: "/ajax/search-transcript/"+term,
			context: this
		}).done(function(results) {
			this.browserController.hideLoading();
			results = $.parseJSON(results);		
			if (results.length <= 0) {
				$("#transcript-data").html("<div class=\"message\">No transcripts found matching \""+term+"\"</div>")

			} else {
				var exactMatch = false;
				for (var i = 0; i < results.length; i++) {
					if (results[i] == term) {
						// found exact match
						this.browserController.selectTranscript(term);
						return;
					}
				}
				this.browserController.selectTranscript(results[0]);
			}

			// selectTranscript(transcriptID)
			// $("#loading-indicator").hide();
			// $("#transcript-data").empty();
			// $("#transcript-data").html(results);
			// this.drawTranscriptData();
		});
	}
});

var CoverageSearchController = Class.extend({
	init: function(browserController) {
		this.browserController = browserController;

		// initialise pagination
		this.browserController.showLoading();
		$.ajax({
			url: "/ajax/get-coverage-page-count", context: this

		}).done(function(pageNum) {
			this.browserController.hideLoading();
			// insert pagination HTML
			var buf = 
				"<div id=\"pagination-container\">" +
				"	<div id=\"search-coverage-paginator\" class=\"pagination\">" +
                "   	<a href=\"#\" class=\"first\" data-action=\"first\">&laquo;</a>" +
                "    	<a href=\"#\" class=\"previous\" data-action=\"previous\">&lsaquo;</a>" +
                "    	<input type=\"text\" readonly=\"readonly\" data-max-page=\""+pageNum+"\" />" +
                "    	<a href=\"#\" class=\"next\" data-action=\"next\">&rsaquo;</a>" +
                "    	<a href=\"#\" class=\"last\" data-action=\"last\">&raquo;</a>" +
                "	</div>" +
                "</div>" +
				"<div id=\"search-coverage-data\"><!-- filled by paginator AJAX --></div>";
            $("#search-coverage").html(buf);

            // initialise the paginator JS
            $('#search-coverage-paginator').jqPagination({

            	// page change callback
			    paged: $.proxy(function(pageNum) {
			    	this.search(pageNum);
		    	}, this) 
			});

            // retrieve the first page of results.
			this.search(1);
		});
	},

	// Grabs transcript coverage data via AJAX and displays it in a div
	search: function(pageNum) {
		this.browserController.showLoading();
		$.ajax({
			url: "/ajax/search-coverage/"+pageNum,
			context: this
		}).done($.proxy(function(results) {
			this.browserController.hideLoading();
			$("#search-coverage-data").empty();
			$("#search-coverage-data").html(results);

			$(".transcript-id-link").each($.proxy(function(key, element) {
				element = $(element)
				element.click($.proxy(function(ev) {
					ev.preventDefault()
					element = $(ev.target)
					var transcript_id = element.html()
					this.browserController.selectTranscript(transcript_id)
				}, this));
			}, this));
		}, this));
	}
});

// Class that handles PCA and structure plotting
var StructureExplorer = Class.extend({
	init: function(browserController) {
		this.browserController = browserController;
		this.experimentIDs = [3, 4];
		this.structureData = this.browserController.getJsonFromElement("structure-json")
		this.drawStructurePcas();
		this.initialiseRnaDiagram();
		this.drawMfe();
	},

	// Set up the forna container - this plots the RNA
	// Also set up button event handlers
	initialiseRnaDiagram: function() {
		if (this.fornaContainer == null) {
			this.fornaContainer = new FornaContainer(
				"#forna-container", {
					'applyForce': true,
					'initialSize': [650, 650]
				}
			);
			this.fornaContainer.setFriction(0.5);
			this.fornaContainer.setCharge(-0.3);
			this.fornaContainer.setGravity(0);
			this.fornaContainer.setPseudoknotStrength(0);
			this.fornaContainer.stopAnimation();
			this.addDmsColours();
		}

		$("#forna-interact-enable").click($.proxy(function(ev) {
			ev.preventDefault();
			this.fornaContainer.startAnimation()
			$("#forna-interact-disable").show()
			$("#forna-interact-enable").hide()
		}, this));

		$("#forna-interact-disable").click($.proxy(function(ev) {
			ev.preventDefault();
			this.fornaContainer.stopAnimation()
			$("#forna-interact-enable").show()
			$("#forna-interact-disable").hide()
		}, this));

		$("#show-dms").click($.proxy(function(ev) {
			ev.preventDefault();
			this.addDmsColours();
		}, this))

		$("#show-ribosome-profiling").click($.proxy(function(ev) {
			ev.preventDefault();
			this.addRibosomeProfilingColours();
		}, this))
	},

	// DMS colours work great
	addDmsColours: function() {
		var measurements = this.getNucleotideMeasurementsFlat(1);

		// manipulate forna into displaying the colours
		this.fornaContainer.addCustomColors({
			color_values: { "": measurements },
			domain: [0, 1],
			range: ["#4f4", "#f44"]
		});
		this.fornaContainer.changeColorScheme("custom");
	},

	// with ribosome, problem is that some colours are really hard to make out.
	// maybe use a log scale to solve this (flatten things out a bit)
	// or a user adjustable threshold scale
	addRibosomeProfilingColours: function() {
		var measurements = this.getNucleotideMeasurementsFlat(2);

		// find max measurement value - use that for max domain
		var max = 0;
		for (var i = 0; i < measurements.length; i++) {
			if (measurements[i] > max) {
				max = measurements[i];
			}
		}

		this.fornaContainer.addCustomColors({
			color_values: { "": measurements },
			domain: [0, max],
			range: ["#fff", "#f00"]
		});
		this.fornaContainer.changeColorScheme("custom");
	},

	getNucleotideMeasurementsFlat: function(experimentID) {
		// get the reactivities as a flat array
		var data = this.browserController
			.getJsonFromElement("nucleotide-measurement-json")[experimentID].data;

		var measurements = [null]; // first element must be ignored
		for (var i = 0; i < data.length; i++) {
			measurements[i + 1] = data[i].measurement;
		}
		return measurements;
	},

	// Find the structure with the MFE and draw it.
	drawMfe: function() {
		var inVivoExperimentID = 4;
		var lowestEntry = null;
		var structureData = this.structureData[inVivoExperimentID].data

		// Find the in vivo structure with the MFE	
		for (var j = 0; j < structureData.length; j++) {
			var currentEntry = structureData[j];
			if (	lowestEntry == null || 
					currentEntry["energy"] < lowestEntry["energy"]) {

				lowestEntry = currentEntry;
			}
		}
		this.drawStructureDiagram(lowestEntry);
	},

	drawStructurePcas: function() {
		this.drawStructurePca(this.structureData[3], "pca-container-in-silico");
		this.drawStructurePca(this.structureData[4], "pca-container-in-vivo");
	},

	// Draws a PCA structure scatter plot
	// http://bl.ocks.org/weiglemc/6185069
	drawStructurePca: function(dataIn, elementID) {
		var svgID = elementID+"-svg";
		var experimentID = dataIn["id"]
		var padding = 0.05; // % margin around the PCA points
		var buf = "<svg id=\""+svgID+"\" class=\"structure-pca-chart\"></svg>";

		$("#"+elementID).html(buf)

		dataValues = dataIn["data"];

		var margin = {top: 10, right: 10, bottom: 20, left: 20};
		var totDims = {x: 250, y: 250};
		var panelDims = {
			x: totDims.x - margin.left - margin.right,
			y: totDims.y - margin.left - margin.right
		};

		var energyValue = function(d) { return d.energy; };

		// setup x 
		var xValue = function(d) { return d.pc1; };
		var minX = d3.min(dataValues, xValue);
		var maxX = d3.max(dataValues, xValue);
		var rangeX = maxX - minX;
		var padX = rangeX * padding;
		var xScale = d3.scale.linear()
			.range([0, panelDims.x])
			.domain([
				minX - padX,
				maxX + padX
			]);

		var xMap = function(d) { return xScale(xValue(d)); };
		var xAxis = d3.svg.axis().scale(xScale).orient("bottom");

		// setup y
		var yValue = function(d) { return d.pc2; };
		var minY = d3.min(dataValues, yValue);
		var maxY = d3.max(dataValues, yValue);
		var rangeY = maxY - minY;
		var padY = rangeY * padding;
	    var yScale = d3.scale.linear()
	    	.range([panelDims.y, 0])
	    	.domain([
				minY - padY,
				maxY + padY
			])

	    var yMap = function(d) { return yScale(yValue(d));};
	    var yAxis = d3.svg.axis().scale(yScale).orient("left");

	    // Set up a colour scale. it's a bit crap since there are only 9? colours
	    // TODO moar colours
		var numColors = 9;
		var heatmapColour = d3.scale.quantize()
		  	.domain([
		  		d3.min(dataValues, energyValue),
		  		d3.max(dataValues, energyValue),
		  	])
		  	.range(colorbrewer.RdYlGn[numColors]);

		// grab the tooltip element
		var tooltip = d3.select("#structure-pca-chart-tooltip");

		// add the graph canvas to the body of the webpage
		var svg = d3.select("#"+svgID)
		    .attr("width", totDims.x)
		    .attr("height", totDims.y)
		  .append("g")
		    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		// x-axis
		svg.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + panelDims.y + ")")
			.call(xAxis)
		  .append("text")
			.attr("class", "label")
			.attr("x", panelDims.x)
			.attr("y", -6)
			.style("text-anchor", "end")
			.text("PC 1");

		// y-axis
		svg.append("g")
			.attr("class", "y axis")
			.call(yAxis)
	      .append("text")
			.attr("class", "label")
			.attr("transform", "rotate(-90)")
			.attr("y", 6)
			.attr("dy", ".71em")
			.style("text-anchor", "end")
			.text("PC 2");

		var showTooltip = function(d) {
			tooltip.transition()
				.duration(0)
				.style("opacity", 1);
			tooltip.html("<i class=\"fa fa-fire\"></i> "+energyValue(d)+" kcal/mol")
				.style("left", (d3.event.pageX) + "px")
				.style("top", (d3.event.pageY) + "px");
		}

		// draw dots
		svg.selectAll(".dot")
			.data(dataValues)
		  .enter().append("circle")
			.attr("class", "dot")
			.attr("r", 5)
			.attr("cx", xMap)
			.attr("cy", yMap)
			.style("fill", function(d) { return heatmapColour(d.energy); }) 
			
			.on("mousemove", showTooltip)
			.on("mouseover", showTooltip)
			.on("mouseout", function(d) {
				tooltip.transition()
					.duration(200)
					.style("opacity", 0);
			})
			.on("click", $.proxy(function(d) {
				this.drawStructureDiagram(d);
			}, this));

		// add the tooltip area to the webpage (whocares.jpeg)
		// var tooltip = d3.select("body").append("div")
		//     .attr("class", "tooltip")
		//     .style("opacity", 0);

	},

	drawStructureDiagram: function(d) {
		var structureID = d["id"];

		$("#forna-energy").html(d["energy"]);

		this.browserController.showLoading();
		$.ajax({
			url: "/ajax/structure-plot/"+structureID, 
			context: this
		}).done(function(data) {

			// This data includes sequence string, dot bracket structure
			// and 2d diagram coords.
			data = JSON.parse(data);

			g = new RNAGraph(data["sequence"], data["structure"], "rna")
		        .elementsToJson()
		        .addPositions('nucleotide', data["coords"])
		        .addLabels(1) // 1 = start
		        .reinforceStems()
		        .reinforceLoops()
		        .connectFakeNodes();

		    this.fornaContainer.clearNodes();// remove the previous diagram
			this.fornaContainer.addRNAJSON(g, true); // generate new diagram
			this.browserController.hideLoading();
		});
	}
})




// $("#chromosome-selector").change(function() {
// 	// TODO reload the page .. difficult / impossible to change the chromosome 
// 	// ... 
// });