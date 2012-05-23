

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


function load_annotation_form(container, tablename, count) {
	var url ='/annotate/get/'
	$.post(url, {'table' : tablename}, function(resp) {
		var loctypes = resp[0],
			cols = resp[1],
			annos = resp[2];

		// construct a form
		var form = $("<form/>").attr({action : '/annotate/update/', method : 'post'});
		cols.forEach(function(col) {
			var sel = $("<select/>").addClass('input').attr('name', '_col_' + col)
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
				.append($("<div class='span3'/>").css('text-align', 'right').append(sel))
				.append($("<div class='span5'/>").append(txt));
			form.append(row);


		});

		// add user input (in case state/country not set
		var span = $("<div>Custom State/City</div>").css("text-align", "right")
		var input = $("<input name='_userinput_'>");
		if (annos['_userinput_'])
			input.text(annos['_userinput_']['col']);
		var row = $("<div class='row'/>")
			.append($("<div class='span3'/>").append(span))
			.append($("<div class='span5'/>").append(input));
		form.append(row);		

		form.append($("<input type='hidden' name='table'/>").val(tablename))
		form.append($("<div class='row'><div class='span3'>&nbsp;</div><div class='span5'><input type='submit' class='btn' value='update annotations'/></div></div>"))

		// description
		var infobox = $("<div class='span8'/>")
		var info = $("<p>Use this form to manually specify if any of the columns are location related (an address, zipcode etc).</p>" + 
		" <p>After this form is submitted, EasyData will geocode the table.  You can use the textbox to specify if" +
		"all of the rows in the table belong in a particular area (e.g., new york).  EasyData will then restrict" +
		"geocoding to that area.  </p><p>Set a column's value to 'address' to force EasyData to geocode that column " +
		"(weird restriction, I know)</p>")

		infobox
			.append(info)
			.append($("<div/>").text("Geocoding this table may take up to " + parseInt(count * 0.05) + " seconds"));
		infobox = $("<div class='row'/>").append(infobox).css("display", "none");
		var helptext = $("<small>toggle help</small>").click(function() {infobox.toggle()});


		var div = $("<div/>")
			.append($("<h3/>").text("Pick location columns").append(helptext))
			.append(infobox)
			.append(form);
		container.append(div);
	}, 'json')


}

function set_address(tablename, col) {
	var url = '/annotate/address/';
	$.post(url, {'table' : tablename, "colname" : col}, function(resp) {
		
	}, 'json');
}

function get_correlations(offset, limit) {
	offset = offset? offset : 0;
	limit = limit? limit : 6;
	var url = '/json/data/corr/';
	var tables = d3.keys(selectedmaptables)
		.filter(function(d) { return selectedmaptables[d] });
	tables = JSON.stringify(tables);
	console.log(['getting correlations', tables, selectedmaptables])




	$("#corrplot").empty()


	$.post(url, {tables : tables, offset : offset, limit : limit}, function(resp) {
		if (resp) {


			resp.forEach(function(arr){
				var left = arr[0],
					right = arr[1],
					data = arr[2];
				plot_correlation(left, right, data);
				
			})



			var prev = $("<a href='#' class='link'/>")
				.text("prev")
				.css('margin-right', "10px")
				.css('color', function() { return (offset > 0)? '' : "#999"})
				.on('click', function() {
					if (offset > 0) {
						get_correlations(offset - limit, limit);
					}
				})

			var next = $("<a href='#' class='link'/>")
				.text("next");

			next.click(function() {
				get_correlations(offset + limit, limit);
			})
			var links = $("#corrplot_links");
			links
				.empty()
				.append(prev)
				.append(next);				
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
		y = d3.scale.linear().domain([miny, maxy]).range([h-p-10, p]);
	

	var span = $("<div></div>").addClass("span3");
	console.log($("#corrplot"));
	$("#corrplot").append(span);
	console.log(span.get());

	var svg = d3.selectAll(span.get()).append("svg")
			.attr("width", w+"px")
			.attr("height", h+"px")
	svg.append("text")
			.attr("text-anchor", "center")
			.attr("x", p)
			.attr("y", h-10)
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
	console.log(['rendering map data', tablename, metadata['stdmeters']])

	var tnames = $("#map-tablenames");
	var showing = false;
	var el = $("<div></div>")
		.addClass("tablename")
		.text(tablename + "("+metadata['nlatlons']+"/"+metadata['nrows']+")")
		.css('color', '#999');
	tnames.append(el);


	var loc_cols = {};
	(metadata['loc_cols'] || []).forEach(function(d) { loc_cols[d] = 1;})
	var newdiv = $("<div/>")
		.css('overflow-x', 'scroll');
	var newtable = $("<table></table>")
		.addClass("table-striped table table-bordered  table-condensed");
	render_rows(newtable, tablename, rows, loc_cols);


	newdiv
		.append($("<h2/>").text(tablename))
		.append(newtable);
	$("#mapdata").append(newdiv);
	newdiv.hide();	

	load_annotation_form(newdiv, tablename, metadata['nrows']);


	var zoom = 18; 
	var zoom_mpp = 0.597164; // meters / pixel
	var meterspp = Math.max(metadata['stdmeters'] / 5.0, 100) / 10.;
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
		if (el.hasClass('selected')) {
			el.removeClass('selected')
			markers.forEach(function(m) {m.setMap(null);})
			newdiv.hide();
			el.css('color', '#999');
			selectedmaptables[tablename] = false;
		} else {
			el.addClass('selected');
			markers.forEach(function(m) {m.setMap(map);})
			newdiv.show();
			el.css('color', metadata['color']);
			selectedmaptables[tablename] = true;
			if (center) {
				console.log(['set center', center.toString()]);
				map.setZoom(zoom);
				map.setCenter(center);			
			}

		}
		get_correlations();

	})

	mapmarkers.push(markers);

}


function render_map_row_marker(row, metadata) {
	var lat = row['lat'],
		lon = row['lon'],
		//latlon = row['_latlon']
		meters = metadata['stdmeters'] / 6.0;
	if (!lat || !lon) return;
	if (!meters) meters = 50;

	var center = new google.maps.LatLng(lat, lon);
	var opts = {
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

		load_annotation_form(newdiv, tablename, metadata['nrows']);

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
			.text(String)
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



