$(document).ready(function () {
  //$("p").text("The DOM is now loaded and can be manipulated.");

  /* {{{ Utility functions  */
  var PI = 3.14159265358979323846264338327950288419;

  var deg_to_rad = function(deg) {
    return (deg*PI)/180;
  }

  function edist2d(a,b) {
    return Math.sqrt(Math.pow((a.x-b.x),2)+Math.pow((a.y-b.y),2));
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

/*
  var svg = d3.select("#traffic").insert("svg:svg", "h2")
    .attr("width", w)
    .attr("height", h)
    //.call(d3.behavior.zoom().on("zoom", zoom));
    .call(d3.behavior.zoom().on("zoom",zoom));
    */


  var sw_lat, sw_lon;
  var json_sensors;
  var time_stamp;

  /* These just scope the map to the "ring" around the twin cities */
  var min_lon     = -93.61245;
  var min_lat     =  44.8426;
  var max_lon     = -92.92945;
  var max_lat     =  45.11559;

  var station     = [];
  var station_id  = [];
  var reading     = [];
  var route       = [];
  var line_width  = 4;
  var lane_offset = line_width;
  var metro_config_loaded = 0;

  var datafile = 'stat_sample_latest.xml';

  function zoom() {
    trans=d3.event.translate;
    scale=d3.event.scale;
    viz = d3.selectAll("line");
    viz.attr("transform", "translate(" + trans + ")" + " scale(" + scale + ")");
    //console.log(scale);
    //console.log(trans);
  }
  
  /* Force layout code */
  /* {{{ */

  var force = d3.layout.force()
                .charge(0)
                .gravity(0)
                .friction(0.5)
                .theta(10)
                .linkDistance(sensor_link_dist)
                .on("tick", tick)
                .size([w, h]);

  var svg   = d3.select("#forcetraffic").insert("svg:svg", "h2").attr("width", w).attr("height", h)

  var node, link, nodes, links;

  function tick(e) {
    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });
 
    node.attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });

    /* Push east and westbound routes to their original y value; north and southbound routes to their
    original x value */
    nodes.forEach(function(o, i) {
                       var k = .5 * e.alpha;
                    /* 
                       var k = .1 * e.alpha;
                       o.y += (foci[o.id].y - o.y) * k;
                       o.x += (foci[o.id].x - o.x) * k; */
                       //console.log(o.id);
                       //console.log(station_id[o.id]);
                      
                       //if(!(undefined === station_id) && !(undefined === station_id[o.id])) {
                         if(station_id[o.id].dir === 'EB' || station_id[o.id].dir === 'WB') {
                           o.y += (station_id[o.id].y - o.y) *k;
                         }
                         if(station_id[o.id].dir === 'NB' || station_id[o.id].dir === 'SB') {
                           o.x += (station_id[o.id].x - o.x) *k;
                         }
                       //}
                  });
  }

  function update_force() {
    /* Simplest example I could come up with: two nodes, one link
    nodes = [{x:50, y:50, id:1},{x:100,y:100,id:2}];
    links = [{source: nodes[0], target: nodes[1]}];
    */

    console.log(links);
    //console.log("links: "+links);

    force.nodes(nodes).links(links).start();

    link = svg.selectAll("line.link")
          .data(links, function(d) { return d.target.id; });

    link.enter().insert("svg:line", ".node")
      .attr("class", "link")
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; })
      .style("stroke-width",line_width)
      .attr("class", function(d) { 
                                    if(!(undefined===reading[d.source.id])) {
                                      return line_quantize(reading[d.source.id].speed); 
                                    } else {
                                      return ".black";
                                    }
                                 });

    node = svg.selectAll("circle.node")
          .data(nodes, function(d) { return d.id; })
          //.style("fill", "steelblue");

    // Enter any new nodes.
    node.enter().append("svg:circle")
      .attr("class", "node")
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      //.attr("r", function(d) { return Math.sqrt(d.size) / 10 || 4.5; })
      .attr("r", 1)
      .style("fill", "white")
      //.call(force.drag);
 
/* {{{ Documentation */
    /* Nodes is an array of objects containing at least: x,y,id 
    example:
    id: 1
    index: 0
    name: "AgglomerativeCluster"
    px: 478.7564812153557
    py: 463.16888091941263
    size: 3938
    weight: 1
    x: 478.7916912241655
    y: 463.934875540248
    */
    /* Links is an array, each entry has a source and a target like this (ids correspond to nodes I believe):
        source: Object
        children: Array[4]
        id: 5
        index: 4
        name: "cluster"
        px: 662.3936746727816
        py: 218.51112936937892
        weight: 5
        x: 662.4949599545262
        y: 218.2288376740375
        */
        /* }}} */
  }
  /* }}} */

  // Reload interval is in miliseconds
  //setInterval(function() {d3.xml(datafile, load_station);}, 60000);

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
            //station.push({lon: r_node['@lon'], lat: r_node['@lat'], id: r_node['@station_id'], route: thisroute+" "+direction,  dir: direction});

            station_obj = {lon: r_node['@lon'], lat: r_node['@lat'], id: r_node['@station_id'], slim:r_node['@s_limit'], route: thisroute+" "+direction,  dir: direction};
            station.push(station_obj);

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
            xy_obj = {x: cx, y: cy, id: station[i].id, slim: station[i].slim, lat: station[i].lat, lon: station[i].lon, route: station[i].route,  dir: station[i].dir};
            xy_station.push(xy_obj);

            station_id[station[i].id] = xy_obj;
           
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

  function sensor_link_dist (link, link_index) {
    aspeed  = 1;
    bspeed  = 1;

    if(!(undefined === reading[link.source.id])) {
      if(!(undefined === reading[link.source.id].speed) && !("UNKNOWN" === reading[link.source.id].speed)) {
        aspeed = reading[link.source.id].speed/station_id[link.source.id].slim;
      }
    }
    if(!(undefined === reading[link.target.id])) {
      if(!(undefined === reading[link.target.id].speed) && !("UNKNOWN" === reading[link.target.id].speed)) {
        bspeed = reading[link.target.id].speed/station_id[link.target.id].slim;
      }
    }

    link_speed = (aspeed+bspeed)/2;
    link_dist  = edist2d(station_id[link.target.id],station_id[link.source.id]);

    link_dist  = link_dist/link_speed;

    console.log(link_dist);
    return link_dist;
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
    //d3.selectAll("svg").remove();

    /*
    svg = d3.select("body").insert("svg", "h2")
      .attr("width", w)
      .attr("height", h)
      .call(d3.behavior.zoom().on("zoom", zoom));
      */

    nodes = [];
    links = [];

    node_num = 0;
    for(routename in route) {
      testroute = route[routename];
      //console.log("changing routes: "+routename+" number of points: "+testroute.length);

      x = testroute[0].x;
      y = testroute[0].y;

      nodes.push({x:testroute[0].x, y:testroute[0].y, id:testroute[0].id});
      node_num++;

      for(i=1; i<testroute.length; i++) {
        dist = geo_dist(testroute[i-1].lat,testroute[i-1].lon,testroute[i].lat,testroute[i].lon);
        nodes.push({x:testroute[i].x, y:testroute[i].y, id:testroute[i].id});
        if(dist < 6) {

          links.push({source: nodes[node_num-1], target: nodes[node_num]});
          /*

          svg.append("svg:line").attr("x1", testroute[i-1].x).attr("y1", testroute[i-1].y)
                                .attr("x2", testroute[i].x)  .attr("y2", testroute[i].y)
                                .style("stroke-width",line_width)
                                .attr("class", function() { 
                                  if(!(undefined===reading[testroute[i].id])) {
                                    return line_quantize(reading[testroute[i].id].speed); 
                                  } else {
                                    return ".black";
                                  }});
                                */
                              //.style("stroke-width",1).style("stroke","steelblue");

        } 
        node_num++;
      }
    }
    //console.log("nodes inside: "+nodes);
    update_force();
  }


  function load_station (doc, err) {
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
