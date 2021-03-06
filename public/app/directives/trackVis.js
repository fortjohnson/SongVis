angular.module('trackVis', [])

.directive('trackVis', function(){

	return{
		require: "^ngModel",
		scope:{
			ngModel: "="
		},
		template: '<div class="track"></div> <div id="progress_bar"> <span id="progress"></span> </div>',
		link: function(scope, iElement, iAttrs){

				// Generate SongViz
				scope.$watch('ngModel', function(newVal){
					if(scope.ngModel){
						console.log(iElement);
						width = generateVis(iElement, scope.ngModel);

						// Progress Bar for Audio 
						var media = document.getElementById("audio");  // UPDATE: too implementation specfific.
						var progress_bar = document.getElementById("progress_bar");
						progress_bar.style.width = width +"px";
						progress_bar.style.visibility = "visible";

						function updateProgress() {

				   			var progress = document.getElementById("progress");
			  				var value = 0;
				   			if (media.currentTime > 0) {
				      			value = ((100. / media.duration) * media.currentTime);
				   			}
				   			progress.style.width = value + "%";
						}

						media.addEventListener("timeupdate", updateProgress, false);
					}
				});

			  }
	}
});

var generateVis = function(element, trackData){

	var tMax = [58.175, 318.591, 227.208]
    var tMin = [0, -308.285, -186.254]

    //SVG Width and height
    var w = 1200;//Recommended 600
    var h = 50;
    var sidePadding = 0;
    var bottomPadding = 5;

    //Individual Pitch Box Dimensions
    var rectH = 3; // Makes graph bigger
    var horPitchPadding = 0;  // Horizontal Padding
    var vertPitchPadding = 1;


    // Loudness Dimensions (uses width of Pitch boxes)
    var loudnessMaxH = 12;

    // Loudness scale to convert Echonest Loudness values to Height
    var loudnessMin = -60;
    var loudnessMax = 0;
    var loudnessScale = d3.scale.linear()
                            .domain([loudnessMin, loudnessMax])
                            .range([0, loudnessMaxH]);

    // var hueScale = d3.scale.linear()
    //                     .domain([0, 360])
    //                     .range([0,360]);

    var rgbScale = d3.scale.linear()
                        .domain([0,1])
                        .range([0,255]);

    var colorScale = d3.scale.quantize()
                        .domain([.15, .85])
                        .range(colorbrewer.YlGnBu[81]);

    var transparencyScale = d3.scale.pow().exponent(1.4)

    var darkerScale = d3.scale.linear()
                            .domain([0,1])
                            .range([1, 3]);

    var brighterScale = d3.scale.linear()
                            .domain([0,.7])
                            .range([0,5]);
    

    //Create SVG element for drawing an individual SongVis
    var svg = d3.select(element[0].childNodes[0])
                .append("svg")
                .attr("width", w)
                .attr("height", h);


    // svg.append("rect")
    //     .attr("width", "100%")
    //     .attr("height", "100%")
    //     .attr("fill", d3.rgb(255,245, 245));

    // initialize counter and accumulators to 0
    var barIdx = 0;
    var barBreaks = 0;
    var segIdx= 0
    var numSegments = 0;
    var pitchTots = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    var loudnessTot = 0
    var timbreTots = [0, 0, 0]

    var movingX = sidePadding
    var barScaleFactor = 2.0

    // for(; barIdx<trackData.bars.length; segIdx++){      // For all bars
    for(; segIdx<trackData.segments.length && barIdx<trackData.bars.length; segIdx++){  

        // Get necessary data
        bar = trackData.bars[barIdx];
        barEndTime = bar.start + bar.duration;
        segment = trackData.segments[segIdx];

        if (segment.start < barEndTime){
            // if next segment is within current bar
            // summarize the data

            for(var i=0;i<12;i++){  //update pitch totals for all 12 pitches
                pitchTots[i]+= transparencyScale( segment.pitches[i] )
            }
            loudnessTot += (segment.loudness_start + segment.loudness_max) / 2;  // get average loudness per segment
            timbreTots[0] += segment.timbre[0];
            timbreTots[1] += segment.timbre[1];
            timbreTots[2] += segment.timbre[2];
            numSegments +=1;
        }
        else{

            // add vertical padding for every 4 bars
            var barSpace = 0
            if (barIdx%16 === 0 && barIdx !=0){
                barSpace = 0;
            }

            pitchAvg = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            timbreAvg = [0, 0, 0]
            //generate averages of data
            for(var i=0;i<12;i++){
                pitchAvg[i] = pitchTots[i] / numSegments;
                pitchTots[i] = 0;  // done with value reset to 0
            }

            loudnessAvg = loudnessTot / numSegments;
            loudnessTot = 0  // done with total loud so reset it

            timbreAvg[0] = timbreTots[0] / numSegments;
            timbreAvg[1] = timbreTots[1] / numSegments;
            timbreAvg[2] = timbreTots[2] / numSegments;

            // done with timbre tots reset to 0
            timbreTots[0] = 0;
            timbreTots[1] = 0;
            timbreTots[2] = 0;

            numSegments = 0; // done with summarization reset numSegments
            barIdx += 1;     // and update bar idx


            // Normalize timbre values to convert to values for color
            var rgbVals =  [0, 0, 0];
            for (var i=0; i<3; i++){
                t = timbreAvg[i];
                tNorm = (t - tMin[i]) / (tMax[i] - tMin[i])                
                rgbVals[i] = tNorm
            }

            // Now Draw the 12 boxes representing pitch
            svg.selectAll("rect"+barIdx)
                .data(pitchAvg)
                .enter()
                .append("rect")
                .attr("x", function(d){
                    return movingX + barSpace
                })
                .attr("y", function(d,i){
                    return h - bottomPadding - (i * (rectH + horPitchPadding));
                })
                .attr("width", (bar.duration * barScaleFactor))
                .attr("height", rectH)
                .attr("fill", function(d){

                    var color = colorScale((.15 * rgbVals[0] + .55 * rgbVals[1] + .30 * rgbVals[2]));
                    var colorHSL = d3.hsl(color);

                    return colorHSL.darker(.5);

                })
                .attr("fill-opacity", function(d){
                    return d;
                });

            // Draw the box representing loudness
            svg.selectAll("loudRect"+barIdx)
                .data([loudnessAvg])
                .enter()
                .append("rect")
                .attr("x", function(d){
                    return movingX + barSpace
                })
                .attr("y", function(d){
                    height = loudnessScale(d);
                    return h - bottomPadding - (11 * (rectH + horPitchPadding)) - height;
                })
                .attr("width", (bar.duration * barScaleFactor))
                .attr("height", function(d){
                    return loudnessScale(d);
                })
                .attr("fill", function(d){
                    var color = colorScale((.15 * rgbVals[0] + .55 * rgbVals[1] + .30 * rgbVals[2]));
                    var colorHSL = d3.hsl(color);

                    return colorHSL.darker(.5)
                })
                .attr("fill-opacity", .8);

            movingX += (bar.duration * barScaleFactor) + barSpace


            // Done drawing boxes now store segment info for next bar...
            for(var i=0;i<12;i++){  //update pitch totals for all 12 pitches
                pitchTots[i]+= transparencyScale( segment.pitches[i] )
            }
            loudnessTot += (segment.loudness_start + segment.loudness_max) / 2;  // get average loudness per segment
            timbreTots[0] += segment.timbre[0];
            timbreTots[1] += segment.timbre[1];
            timbreTots[2] += segment.timbre[2];
            numSegments +=1;
        }
    }

    return movingX;
}