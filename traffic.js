$(document).ready(function () {
  //$("p").text("The DOM is now loaded and can be manipulated.");

  /* {{{ Utility functions  */
  var PI = 3.14159265358979323846264338327950288419;

  var deg_to_rad = function(deg) {
    return (deg*PI)/180;
  }
  
  var geo_dist = function(lat1,lon1,lat2,lon2) {
    R    = 6371; // km
    dLat = deg_to_rad(lat2-lat1);
    dLon = deg_to_rad(lon2-lon1);
    lat1 = deg_to_rad(lat1);
    lat2 = deg_to_rad(lat2);
    
    a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
    c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    d = R * c;
    return d;
  }

  var inArray = function(array, value) {
    var i = array.length;
    while (i--) {
        if (array[i] === value) {
            return true;
        }
    }
    return false;
  }
  /* }}} */
  var w = 800, h = 600;

  var svg = d3.select("body").insert("svg:svg", "h2")
    .attr("width", w)
    .attr("height", h)
    //.call(d3.behavior.zoom().on("zoom", zoom));
    .call(d3.behavior.zoom().on("zoom",zoom));


  function zoom() {
      trans=d3.event.translate;
      scale=d3.event.scale;
      viz = d3.selectAll("line");
      viz.attr("transform", "translate(" + trans + ")" + " scale(" + scale + ")");
      //console.log(scale);
      //console.log(trans);
  }

  var sw_lat, sw_lon;
  var json_sensors;
  var time_stamp;

  /* These just scope the map to the "ring" around the twin cities */
  var min_lon     = -93.61245;
  var min_lat     =  44.8426;
  var max_lon     = -92.92945;
  var max_lat     =  45.11559;

  var station     = [];
  var reading     = [];
  var route       = [];
  var line_width  = 4;
  var lane_offset = line_width;
  var metro_config_loaded = 0;

  var datafile = 'stat_sample_latest.xml';

  
  // Reload interval is in miliseconds
  setInterval(function() {d3.xml(datafile, load_station);}, 60000);

  load_metro_config = function(metro, err) {
  /* {{{ */
    if(metro_config_loaded === 0) {
      se_lon = metro.corridor[0].r_node[0]['@lon'];
      nw_lon = metro.corridor[0].r_node[0]['@lon'];
      se_lat = metro.corridor[0].r_node[0]['@lat'];
      nw_lat = metro.corridor[0].r_node[0]['@lat'];
  
      nw_lon_min = metro.corridor[0].r_node[0]['@lon'];
      nw_lat_max = metro.corridor[0].r_node[0]['@lat'];
  
      //console.log(metro.corridor[0]);
  
      for(i=0; i<metro.corridor.length; i++) {
        thisroute = metro.corridor[i]['@route'];
        direction = metro.corridor[i]['@dir'];
 
        if(!(undefined === (metro.corridor[i].r_node))) {
          for(j=0; j<metro.corridor[i].r_node.length; j++) {
            r_node = metro.corridor[i].r_node[j]; 
  
            //if(!(inArray(station_blacklist,r_node['@station_id']))) {
            station.push({lon: r_node['@lon'], lat: r_node['@lat'], id: r_node['@station_id'], route: thisroute+" "+direction,  dir: direction});
            //}
         
            // South eastern corner
            if(r_node['@lon'] > se_lon && r_node['@lat'] < se_lat) {
              se_lon = r_node['@lon'];
              se_lat = r_node['@lat'];
            }
            if(r_node['@lon'] < nw_lon && r_node['@lat'] > nw_lat) {
              nw_lon = r_node['@lon'];
              nw_lat = r_node['@lat'];
            }
           
            if(r_node['@lon'] < nw_lon && r_node['@lat'] < nw_lat) {
              sw_lon = r_node['@lon'];
              sw_lat = r_node['@lat'];
            }
          }
        }
      }
  
      // The default Albers equal-area conic projection has scale 1000, translate
      // [480, 250], rotation [98, 0], center ⟨0°,38°⟩ and parallels [29.5, 45.5],
      // making it suitable for displaying the United States, centered around
      // Hutchinson, Kansas in a 960×500 area.
  
      var projection = d3.geo.albers().origin([nw_lon_min,nw_lat_max]).parallels([sw_lat, nw_lat]).scale(50000).translate([250,600]);
      var xy_station = [];
 
  
      // Build the array of x,y points
      
      for(i=0; i<station.length; i++) {
        //console.log(station);
        if(!(undefined === station[i].lon ||  station[i].lat === undefined || station[i].id === undefined)) { 
          //if(station[i].lon >= min_lon && station[i].lon <= max_lon && station[i].lat >= min_lat && station[i].lat <= max_lat) 
          cord    = projection([station[i].lon, station[i].lat]);
          cx = cord[0];
          cy = cord[1];
          if(cx < 0 || cx > w || cy <0 || cy > h) {
            //console.log("Point out of range: "+cx+","+cy);
          }
          else {
            if(station[i].dir === 'NB' || station[i].dir === 'EB') {
              cx += lane_offset;
              cy += lane_offset;
            }
            xy_obj = {x: cx, y: cy, id: station[i].id, lat: station[i].lat, lon: station[i].lon, route: station[i].route,  dir: station[i].dir};
            xy_station.push(xy_obj);
           
            if(undefined === route[station[i].route]) {
              route[station[i].route] = [];
            }
            route[station[i].route].push(xy_obj);
          }
        }
      }
        metro_config_loaded = 1;
    }
    redraw();
    /* }}} */
  }

  var point_quantize = d3.scale.quantize()
                         .domain([0, 150])
                         .range(d3.range(9).map(function(i) { return "q" + i + "-9"; }));
  
  /* 8-i is what inverts the colors so bigger speed corresponds to a darker color */ 
  var line_quantize  = d3.scale.quantize()
                         .domain([0, 100])
                         .range(d3.range(9).map(function(i) { return "ql" + (8-i) + "-9"; }));

  /* Draw the lines between the sensors with appropriate color from 'reading' array */
  var redraw = function() {

    /* Crucial: get rid of everything so we don't just keep adding elements that we have to track */
    d3.selectAll("svg").remove();

    svg = d3.select("body").insert("svg", "h2")
      .attr("width", w)
      .attr("height", h)
      .call(d3.behavior.zoom().on("zoom", zoom));

    for(routename in route) {
      testroute = route[routename];
      //console.log("changing routes: "+routename+" number of points: "+testroute.length);
      for(i=1; i<testroute.length; i++) {
        dist = geo_dist(testroute[i-1].lat,testroute[i-1].lon,testroute[i].lat,testroute[i].lon);
        if(dist < 6) {
          svg.append("svg:line").attr("x1", testroute[i-1].x).attr("y1", testroute[i-1].y)
                                .attr("x2",   testroute[i].x)  .attr("y2", testroute[i].y)
                                .style("stroke-width",line_width)
                                .attr("class", function() { 
                                  if(!(undefined===reading[testroute[i].id])) {
                                    return line_quantize(reading[testroute[i].id].speed); 
                                  } else {
                                    return ".black";
                                  }});
                              //.style("stroke-width",1).style("stroke","steelblue");
        } 
      }
    }
  }


  load_station = function(doc, err) {
    reading_string = xml2json(doc,"\t"); 
    traffic_sample = JSON.parse(reading_string);
    time_stamp     = traffic_sample.traffic_sample['@time_stamp'];
    $('#latest_time').text(time_stamp);

    for(i=0; i<traffic_sample.traffic_sample.sample.length; i++) {
      ts = traffic_sample.traffic_sample.sample[i];
      reading[ts['@sensor']] = {flow: ts['@flow'], occ: ts['@occ'], speed: ts['@speed']};
      //console.log(ts['@sensor']);
    }
    d3.json('metro_config.json', load_metro_config);
  }

  /* Top level call here */
  d3.xml(datafile, load_station);

});
