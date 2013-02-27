$(document).ready(function () {
  //$("p").text("The DOM is now loaded and can be manipulated.");

  /* {{{ Utility functions  */
  var PI = 3.14159265358979323846264338327950288419
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
    .attr("height", h);

  var sw_lat, sw_lon;
  var json_sensors;
  var time_stamp;

  var min_lon = -93.61245;
  var min_lat =  44.8426;
  var max_lon = -92.92945;
  var max_lat =  45.11559;

  var station = [];
  var reading = [];
  var line_width = 4;
  var lane_offset = line_width;

  var datafile = 'stat_sample_latest.xml';

  
  // Reload interval is in miliseconds
  //setInterval(function() { location.reload()}, 60000);
  setInterval(function() {d3.xml(datafile, load_station);}, 60000);

  //var station_blacklist = ['S1166', 'S1039', 'S1164', 'S1165', 'S400', 'S401'];
  
/*  {{{ old xml way
  d3.xml('metro_config.xml', function(doc, err) {
    sensors = xml2json(doc,"\t"); 
    //sensors = sensors.replace('@','');
    json_sensors = JSON.parse(sensors);

    // Write the file so I can save it
    //$("p").text(JSON.stringify(json_sensors));

    console.log(json_sensors.tms_config.corridor[0]);

    se_lon = json_sensors.tms_config.dms[0]['@lon'];
    nw_lon = json_sensors.tms_config.dms[0]['@lon'];
    se_lat = json_sensors.tms_config.dms[0]['@lat'];
    nw_lat = json_sensors.tms_config.dms[0]['@lat'];

    nw_lon_min = json_sensors.tms_config.dms[0]['@lon'];
    nw_lat_max = json_sensors.tms_config.dms[0]['@lat'];

    for(i=1; i<json_sensors.tms_config.dms.length; i++) {
      // South eastern corner
      if(json_sensors.tms_config.dms[i]['@lon'] > se_lon && json_sensors.tms_config.dms[i]['@lat'] < se_lat) {
        se_lon = json_sensors.tms_config.dms[i]['@lon'];
        se_lat = json_sensors.tms_config.dms[i]['@lat'];
      }
      if(json_sensors.tms_config.dms[i]['@lon'] < nw_lon && json_sensors.tms_config.dms[i]['@lat'] > nw_lat) {
        nw_lon = json_sensors.tms_config.dms[i]['@lon'];
        nw_lat = json_sensors.tms_config.dms[i]['@lat'];
      }

      if(json_sensors.tms_config.dms[i]['@lon'] < nw_lon && json_sensors.tms_config.dms[i]['@lat'] < nw_lat) {
        sw_lon = json_sensors.tms_config.dms[i]['@lon'];
        sw_lat = json_sensors.tms_config.dms[i]['@lat'];
      }
    });
}}} */


  load_metro_config = function(metro, err) {
    //console.log(reading);
 
    se_lon = metro.corridor[0].r_node[0]['@lon'];
    nw_lon = metro.corridor[0].r_node[0]['@lon'];
    se_lat = metro.corridor[0].r_node[0]['@lat'];
    nw_lat = metro.corridor[0].r_node[0]['@lat'];
 
    nw_lon_min = metro.corridor[0].r_node[0]['@lon'];
    nw_lat_max = metro.corridor[0].r_node[0]['@lat'];
 
    //console.log(metro.corridor[0]);
 
    for(i=0; i<metro.corridor.length; i++) {
      route     = metro.corridor[i]['@route'];
      direction = metro.corridor[i]['@dir'];

      if(!(undefined === (metro.corridor[i].r_node))) {
        for(j=0; j<metro.corridor[i].r_node.length; j++) {
          r_node = metro.corridor[i].r_node[j]; 
 
          //if(!(inArray(station_blacklist,r_node['@station_id']))) {
          station.push({lon: r_node['@lon'], lat: r_node['@lat'], id: r_node['@station_id'], route: route+" "+direction,  dir: direction});
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
    /*
      console.log('SE lattitude: '+se_lat);
      console.log('SE longitude: '+se_lon);
      console.log('NW lattitude: '+nw_lat);
      console.log('NW longitude: '+nw_lon);
    */
 
 
    // The default Albers equal-area conic projection has scale 1000, translate
    // [480, 250], rotation [98, 0], center ⟨0°,38°⟩ and parallels [29.5, 45.5],
    // making it suitable for displaying the United States, centered around
    // Hutchinson, Kansas in a 960×500 area.
 
    var projection = d3.geo.albers().origin([nw_lon_min,nw_lat_max]).parallels([sw_lat, nw_lat]).scale(50000).translate([250,600]);
    var xy_station = [];

    //var testroute  = [];
    var route      = [];
 
    // Build the array of x,y points
    
    for(i=0; i<station.length; i++) {
      //console.log(station);
      if(!(undefined === station[i].lon ||  station[i].lat === undefined || station[i].id === undefined)) { 
        //if(station[i].lon >= min_lon && station[i].lon <= max_lon && station[i].lat >= min_lat && station[i].lat <= max_lat) {
          cord    = projection([station[i].lon, station[i].lat]);
          cx = cord[0];
          cy = cord[1];
          if(cx < 0 || cx > w || cy <0 || cy > h) {
            //console.log("Point out of range: "+cx+","+cy);
          }
          else {
            xy_obj = {x: cx, y: cy, id: station[i].id, lat: station[i].lat, lon: station[i].lon, route: station[i].route,  dir: station[i].dir};
            xy_station.push(xy_obj);

/*
            if(station[i].route === "I-494 EB") {
              //testroute.push({x: cx, y:cy});
              testroute.push(xy_obj);
            }
            */
            if(undefined === route[station[i].route]) {
              route[station[i].route] = [];
            }
            route[station[i].route].push(xy_obj);

          }
          //console.log(station[i]);
          /* svg.append("svg:circle").attr("cx", cx)
                                  .attr("cy", cy)
                                  .attr("r", 2); */
        }
      //}
    }
    //console.log(route);
    //console.log("Number of stations: "+station.length);

    // Constructs a new quantize scale with the default domain [0,1] and the
    // default range [0,1]. Thus, the default quantize scale is equivalent to
    // the round function for numbers; for example quantize(0.49) returns 0,
    // and quantize(0.51) returns 1.
    var point_quantize = d3.scale.quantize()
                           .domain([0, 150])
                           .range(d3.range(9).map(function(i) { return "q" + i + "-9"; }));

    var line_quantize  = d3.scale.quantize()
                           .domain([0, 100])
                           .range(d3.range(9).map(function(i) { return "ql" + (8-i) + "-9"; }));

    //console.log(line_quantize(10));
      /* 
    var line = d3.svg.line()
                 .x(function(d) { return d.x; })
                 .y(function(d) { return d.y; });
    */
    svg.selectAll("circle").data(xy_station).enter()
       .append("circle")
       .attr("cx", function(d) { if(d.dir === 'NB' || d.dir === 'EB' ) { d.x += lane_offset} return d.x})
       .attr("cy", function(d) { if(d.dir === 'NB' || d.dir === 'EB' ) { d.y += lane_offset} return d.y})
       .attr("r",2)
       //.style("fill","steelblue")
       //.attr("class", function(d) { if(!(undefined===reading[d.id])) {return point_quantize(reading[d.id].speed); }else{return ".white"}})
       .attr("fill", "white")
       .on("mouseover", function (d) {console.log(d)});


    var alldist = [];
    for(routename in route) {
      testroute = route[routename];
      //console.log("changing routes: "+routename+" number of points: "+testroute.length);
      for(i=1; i<testroute.length; i++) {
        dist = geo_dist(testroute[i-1].lat,testroute[i-1].lon,testroute[i].lat,testroute[i].lon);
        //console.log("dist: "+dist);
        //alldist.push(dist);
        if(dist < 6) {
        svg.append("svg:line").attr("x1", testroute[i-1].x).attr("y1", testroute[i-1].y)
                              .attr("x2", testroute[i].x)  .attr("y2", testroute[i].y)
                              .style("stroke-width",line_width)
                              .attr("class", function() { if(!(undefined===reading[testroute[i].id])) {return line_quantize(reading[testroute[i].id].speed); }else{return ".black"}})
                              //.style("stroke-width",1).style("stroke","steelblue");
        } 
       
        /*svg.append("svg:circle").attr("cx", testroute[i].x)
                                    .attr("cy", testroute[i].y)
                                    .attr("r", 5); */
        //                            console.log(testroute[i-1].route+" "+testroute[i].route);
      }
    }
    //alldist.sort(function(a,b){return a-b});
    //console.log(alldist);

    
    //testroute.append("svg:path").attr("d",line);
    //svg.selectAll("line").data(testroute).enter().append("svg:path").attr("d",line);
    //
    //svg.append("path").datum(testroute).attr("class","line").attr("d",line);
    //console.log(line.interpolate());

    //svg.append(testroute);
    //console.log("NW corner (should be 0,0): "+projection([nw_lon,nw_lat]));
  }


  load_station = function(doc, err) {
    reading_string = xml2json(doc,"\t"); 
    traffic_sample = JSON.parse(reading_string);
    time_stamp     = traffic_sample.traffic_sample['@time_stamp'];
    $('#latest_time').text(time_stamp);

    //console.log("Number of samples: "+traffic_sample.traffic_sample.sample.length);
    for(i=0; i<traffic_sample.traffic_sample.sample.length; i++) {
      ts = traffic_sample.traffic_sample.sample[i];
      reading[ts['@sensor']] = {flow: ts['@flow'], occ: ts['@occ'], speed: ts['@speed']};
      //console.log(ts['@sensor']);
    }
    d3.json('metro_config.json', load_metro_config);
  }

  //d3.xml('stat_sample_0830.xml', load_station);
  d3.xml(datafile, load_station);

 });
