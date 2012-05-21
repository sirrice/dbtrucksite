

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


function load_annotation_form(container, tablename) {
	var url ='/annotate/get/'
	$.post(url, {'table' : tablename}, function(resp) {
		var loctypes = resp[0],
			cols = resp[1],
			annos = resp[2];
		if (tablename == 'tacobell')
			console.log(annos);
		// construct a form
		var form = $("<form/>").attr({action : '/annotate/update/', method : 'post'});
		cols.forEach(function(col) {
			var sel = $("<select/>").addClass('input-xlarge').attr('name', '_col_' + col)
			var found = false;
			loctypes.forEach(function(loctype) {
				var opt = $("<option />").val(loctype).text(loctype);
				if (annos[col] && loctype  == annos[col]['loctype']) {
					console.log([col, annos[col], loctype])
					opt.attr('selected', 'selected');
					found = true;
				}
				sel.append(opt);
			});
			var opt = $("<option />").val('').text('---');
			if (!found) {
				opt.attr('selected', 'selected');
			}
			sel.append(opt);
			var txt = $("<span/>").text(col);

			var row = $("<div class='row'/>")
				.append($("<div class='span4'/>").css('text-align', 'right').append(sel))
				.append($("<div class='span5'/>").append(txt));
			form.append(row);


		});

		// add user input (in case state/country not set
		var span = $("<div>Custom State/City</div>").css("text-align", "right")
		var input = $("<input name='_userinput_'>");
		if (annos['_userinput_'])
			input.text(annos['_userinput_']['col']);
		var row = $("<div class='row'/>")
			.append($("<div class='span4'/>").append(span))
			.append($("<div class='span5'/>").append(input));
		form.append(row);		

		form.append($("<input type='hidden' name='table'/>").val(tablename))
		form.append($("<div class='row'><div class='span4'>&nbsp;</div><input type='submit' class='btn' value='update annotations'/></div>"))

		var div = $("<div/>").append($("<h3/>").text("Pick location columns")).append(form);
		container.append(div);
	}, 'json')


}

function set_address(tablename, col) {
	var url = '/annotate/address/';
	$.post(url, {'table' : tablename, "colname" : col}, function(resp) {
		
	}, 'json');
}

function get_correlations() {
	var url = '/json/data/corr/'
	$.post(url, {}, function(resp) {
		if (resp) {
			resp.forEach(function(arr){
				var left = arr[0],
					right = arr[1],
					data = arr[2];
				plot_correlation(left, right, data);
				
			})
		}
	}, 'json');
}

function plot_correlation(left, right, data) {
	console.log(["correlation", left, right])
	var ldata = data.map(function(d) {return d[0]}),
		rdata = data.map(function(d) {return d[1]});
	var minx = d3.min(ldata),
		maxx = d3.max(ldata),
		miny = d3.min(rdata),
		maxy = d3.max(rdata),
		w = 200,
		h = 200,
		p = 40;


	var x = d3.scale.linear().domain([minx, maxx]).range([p, w-p]),
		y = d3.scale.linear().domain([miny, maxy]).range([p, h-p]);
	

	var container = $("<div></div>").addClass("row");
	var span = $("<div></div>").addClass("span3");
	console.log($("#corrplot"));
	$("#corrplot").append(container);
	container.append(span);
	console.log(span.get());

	var svg = d3.selectAll(span.get()).append("svg")
			.attr("width", w+"px")
			.attr("height", h+"px")
	svg.append("text")
			.attr("text-anchor", "center")
			.attr("x", p)
			.attr("y", h+10)
			.text(left)
	svg.append("text")
			.attr("transform", "rotate(-90) translate(-"+(h-p)+", 20)")
			.text(right)

	svg.selectAll("circle")
			.data(data)
		.enter().append("circle")
			.attr("cx", function(d) {return x(d[0]);})
			.attr("cy", function(d) {return y(d[1]);})
			.attr("r", 2)
			.attr("fill", "steelblue");
	
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
	var el = $("<div></div>").addClass("tablename").text(tablename).css('color', metadata['color']);
	tnames.append(el);


	var loc_cols = {};
	(metadata['loc_cols'] || []).forEach(function(d) { loc_cols[d] = 1;})
	var newdiv = $("<div/>").css('overflow-x', 'scroll');
	var newtable = $("<table></table>").addClass("table-striped table table-bordered  table-condensed");
	render_rows(newtable, tablename, rows, loc_cols);


	newdiv.append($("<h2/>").text(tablename)).append(newtable);
	$("#mapdata").append(newdiv);
	newdiv.hide();	

	load_annotation_form(newdiv, tablename);


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
	var markers = metadata['latlons'].map(function(row) {return render_map_row_marker(row, metadata);});
	markers = markers.filter(function(d) {return d;})
	console.log(markers.length + " markers");
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
	var lat = row['lat'],
		lon = row['lon'],
		//latlon = row['_latlon']
		meters = Math.max(meters_from_stats(metadata['stats']) / 5.0, 50);
	if (!lat || !lon) return;
	//if (!latlon) { return ;}
	//latlon = latlon.substring(1, latlon.length-1).split(',');
	//var lat = parseFloat(latlon[0]),
	//	lon = parseFloat(latlon[1]);


	var center = new google.maps.LatLng(lat, lon);
	var opts = {
//	    strokeColor: d3.rgb(metadata['color']).darker().hsl().toString(),
//	    strokeOpacity: 0.8,
	    strokeWeight: 0,
	    fillColor: metadata['color'],
	    fillOpacity: 0.65,
	    map : map,
	    center: center,
	    radius: meters,
	    visible: false
	};

  var circle = new google.maps.Circle(opts);
  return circle;
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
		render_rows(newtable, tablename, rows, loc_cols);


		

		newdiv.append($("<h2/>").text(tablename)).append(newtable);
		tcont.append(newdiv);
		newdiv.hide();

		load_annotation_form(newdiv, tablename);

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

function render_rows(container, tablename, rows, loc_cols) {
	// render rows in container
	// each row is a dictionary of attr -> value
	// value is already stringified
	// add header
	var cols = d3.keys(rows[0]);

	var dc = d3.select(container.get()[0]);
	var header = dc.append("tr");
	var body = dc.append('tbody');

	var setaddr = $("<span class='link'>set as address</span>");

	header.selectAll('th')
			.data(cols)
		.enter().append('th')
			/*.html(function(d) {
				return "<div>"+d+"</div><div><span class='setaddress'>set to address</span>";
			})*/
			.attr('class', 'header')
			/*.on('click', function(col, i) {
				set_address(tablename, col);
			});*/

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



