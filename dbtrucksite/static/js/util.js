

Array.prototype.clone = function() {return this.slice(0);};
function clone(o) {
	var ret = {};
	d3.keys(o).map(function(key) {
		ret[key] = o[key].clone();
	})
	return ret;
}





function error(msg) {
	div = $("<div/>").attr({'class':"alert alert-error"})
	a = $("<a/>").addClass('close').attr('data-dismiss', 'alert').text('x')
	div.append(a).text(msg);
	$("#messagebox").append(div);
}




function get_tables(url, cb) {
	var params = {};
	$.post(url, params, function(resp) {
		var c = d3.scale.category10().domain([0,1,2,3,4,5,6,7,8,9]);
		if (resp) {
			var i = 0;
			resp.forEach(function(arr) {
				var tablename = arr[0];
				var data = arr[1];
				var metadata = arr[2];
				metadata['idx'] = i;
				metadata['color'] = c(i % 10);
				cb(tablename, data, metadata);
				i += 1;
			});
		}
	}, 'json')	
}




function render_map_location_table(tablename, rows, metadata) {
	if (rows.length == 0) {
		return;
	}

	var tnames = $("#map-tablenames");
	var showing = false;
	var el = $("<div></div>").addClass("tablename").text(tablename);
	tnames.append(el);


	var loc_cols = {};
	(metadata['loc_cols'] || []).forEach(function(d) { loc_cols[d] = 1;})
	var newdiv = $("<div/>").css('overflow-x', 'scroll');
	var newtable = $("<table></table>").addClass("table-striped table table-bordered  table-condensed");
	render_rows(newtable, rows, loc_cols);


	var form = $("<form action='/createloc/' method='POST'></form>");		
	var submit = $("<input type='submit'/>").val("Get location data!")
	var hidden = $("<input type='hidden' name='tablename' />").val(tablename);
	var input = $("<input name='locdata' />")
	if (metadata['needdata'])
		form.append(input)
	form.append(hidden).append(submit);
	

	newdiv.append($("<h2/>").text(tablename)).append(newtable).append(form);
	$("#mapdata").append(newdiv);
	newdiv.hide();	


	var zoom = 18; 
	var zoom_mpp = 0.597164; // meters / pixel
	var meterspp = Math.max(meters_from_stats(metadata['stats']) / 5.0, 100) / 10.;
	while (zoom_mpp / 2 < meterspp) {
		zoom -= 1;
		zoom_mpp *= 2;
	}


	var center = ll = ur = null;
	if (metadata['stats']) {
		var stats = metadata['stats'];
		center = new google.maps.LatLng(stats[5], stats[6]);
		ll = new google.maps.LatLng(stats[1], stats[3]);
		ur = new google.maps.LatLng(stats[2], stats[4]);
	}


	console.log(["adding circles", metadata['color']])
	var markers = rows.map(function(row) {return render_map_row_marker(row, metadata);});
	markers = markers.filter(function(d) {return d;})
	console.log(markers);
	el.click(function() {
		if (center) {
			console.log(['set center', center.toString()]);
			map.setZoom(zoom);
			map.setCenter(center);			
		}
		if (el.hasClass('selected')) {
			el.removeClass('selected')
			markers.forEach(function(m) {m.setVisible(false);})
			newdiv.hide();
		} else {
			el.addClass('selected');
			markers.forEach(function(m) {m.setVisible(true);})
			newdiv.show();
		}

	})

}

function meters_from_stats(stats) {
	if (!stats || stats.length < 8) {
		return 100;
	}
	var latstd = stats[7], 
		lonstd = stats[8],
		lat = stats[5],
		lon = stats[6],
		pi = 3.141592658;

	var R = 6371; // km
	var dLat = (latstd) * (pi/180);
	var dLon = (lonstd) * (pi/180);
	var lat1 = lat1 * (pi/180);
	var lat2 = lat2 * (pi/180);

	var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
	        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat) * Math.cos(lat); 
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
	var d = R * c;	
	return d;
}


function render_map_row_marker(row, metadata) {
	var lat = row['latitude'],
		lon = row['longitude'],
		meters = Math.max(meters_from_stats(metadata['stats']) / 5.0, 100);
	if (!lat || !lon) { return ;}


	var center = new google.maps.LatLng(lat, lon);
	var opts = {
	    strokeColor: d3.rgb(metadata['color']).darker().hsl().toString(),
	    strokeOpacity: 0.8,
	    strokeWeight: 2,
	    fillColor: metadata['color'],
	    fillOpacity: 0.35,
	    map : map,
	    center: center,
	    radius: meters,
	    visible: false
	};

  var circle = new google.maps.Circle(opts);

  var elcont = $("#row-data");
  var el = $("<table></table>").addClass("table-striped table table-bordered  table-condensed");
  elcont.append(el);

  var del = d3.selectAll(el.get()).append("tbody");
  var nonnullentries = d3.entries(row).filter(function(d){return d.value != null && d.value != 'null';});
  nonnullentries = nonnullentries.map(function(d) {return [d.key, d.value];})
  var trs = del.selectAll("tr")
  		.data(nonnullentries)
  	.enter().append("tr");
  trs.selectAll('td')
  		.data(function(d) { return d})
  	.enter().append("td")
  		.text(String);
  
  elcont.empty();
  
  google.maps.event.addListener(circle, 'click', function() {
  	elcont.empty()
  	elcont.append(el);
  })
  return circle;

}



function gen_render_text_table(tablenamesid, dataid) {
	function _render_text_table(tablename, rows, metadata) {
		// add tablename to table list
		// instrument clicking on tablename to do things
		// construct render rows
		if (rows.length == 0) {
			return;
		}
		var loc_cols = {};
		(metadata['loc_cols'] || []).forEach(function(d) { loc_cols[d] = 1;})
		console.log(loc_cols);

		var tnames = $(tablenamesid);
		var tcont = $(dataid)
		var showing = false;
		var el = $("<div></div>").addClass("tablename").text(tablename + " ("+metadata['nrows']+")");
		tnames.append(el);

		var newdiv = $("<div/>").css('overflow-x', 'scroll');
		var newtable = $("<table></table>").addClass("table-striped table table-bordered  table-condensed");
		render_rows(newtable, rows, loc_cols);


		var form = $("<form action='/createloc/' method='POST'></form>");		
		var submit = $("<input type='submit'/>").val("Get location data!")
		var hidden = $("<input type='hidden' name='tablename' />").val(tablename);
		var input = $("<input name='locdata' />")
		if (metadata['needdata'])
			form.append(input)
		form.append(hidden).append(submit);
		

		newdiv.append($("<h2/>").text(tablename)).append(newtable).append(form);
		tcont.append(newdiv);
		newdiv.hide();

		el.click(function() {
			newdiv.toggle();
			if (el.hasClass('selected'))
				el.removeClass('selected')
			else
				el.addClass('selected');

		})
	}
	return _render_text_table;
}

function render_rows(container, rows, loc_cols) {
	// render rows in container
	// each row is a dictionary of attr -> value
	// value is already stringified
	// add header
	var cols = d3.keys(rows[0]);

	var dc = d3.select(container.get()[0]);
	var header = dc.append("tr");
	var body = dc.append('tbody');

	header.selectAll('th')
			.data(cols)
		.enter().append('th')
			.text(String)
			.attr('class', 'header');

	var rowsarr = rows.map(function(row) {
		return cols.map(function(col) {return [col, row[col]];});
	});

	var trs = body.selectAll("tr")
			.data(rowsarr)
		.enter().append('tr')

	trs.selectAll('td')
			.data(function(d) {return d;})
		.enter().append('td')
			.html(function(d) {return d[1]})
			.attr("style", function(d) { return (loc_cols[d[0]])? "background: steelblue; color:white;" : "" });
}



function render_schema(selector,schema) {
	$(selector).empty();
	var fsdiv = d3.select(selector);
	var container = fsdiv.append('div').attr('class', 'row');
	container.append('div').attr('class', 'span2').html('&nbsp;');
	var tabcont = container.append('div').attr('class', 'span8')
	container.append('div').attr('class', 'span2')
	var tables = tabcont.selectAll("table")
			.data(d3.entries(schema))
		.enter().append("table")
			.attr('class', 'table-striped table table-bordered  table-condensed')

	var tbodys = tables.append('tbody');

	
	var ths = tbodys.data(d3.entries(schema)).append('tr').append('th')
			.attr('colspan', '2')
			.text(function(d) {return d.key})
			.style("text-align", "center")

	var trs = tbodys.selectAll('tr')
			.data(function(d) {return d.value})
		.enter().append("tr")

	var tds = trs.selectAll("td")
			.data(function(d,i) {return d})
		.enter().append('td')
			.attr('width', '50%')
			.text(String)
			.style("font-size", "smaller");						
}

