var MediaHunt = {};

//Configure here!

MediaHunt.threshold = 25;
MediaHunt.CartoDbUserName = "davidjonas";
MediaHunt.CartoDbTableName = "media_points";

//-------End of configuration---------


MediaHunt.lat = 0;
MediaHunt.lon = 0;
MediaHunt.gotPosition = false;
MediaHunt.points = [];
MediaHunt.distances = [];
MediaHunt.playing = false;

MediaHunt.init = function ()
{
    $(".title").fadeIn(2000);
    window.scrollTo(0,1);
    if (navigator.geolocation)
    {
        MediaHunt.posId = navigator.geolocation.watchPosition(MediaHunt.handleLocation, MediaHunt.posError ,{ maximumAge: 3000, timeout: 5000, enableHighAccuracy: true });
    }
    else
    {
        $(".title").text("Geolocation is not supported by this browser.");
        $(".title").slabText();
    }
};

MediaHunt.posError = function (error)
{
    //alert('There was an error gathering your location data. Sorry! : ' + error.message);
}

MediaHunt.startGame = function ()
{
    $(".title").fadeOut(500);
    setTimeout(function () {
        MediaHunt.showMap();
        MediaHunt.getPointsFromCartoDb();
    }, 500)
}

MediaHunt.getPointsFromCartoDb = function ()
{
    var sql = "SELECT name, description, ST_AsGeoJSON(the_geom) as location FROM "+MediaHunt.CartoDbTableName;
    $.getJSON("http://"+MediaHunt.CartoDbUserName+".cartodb.com/api/v2/sql?q=" + sql, function(data){
		var rows = data["rows"];
                $.each(rows, function (index, row) {
                        MediaHunt.points.push(row);
                })
	});
}

MediaHunt.showMap = function ()
{
    var user  = MediaHunt.CartoDbUserName;
    var table = MediaHunt.CartoDbTableName;
    var lat   = MediaHunt.lat;
    var lng   = MediaHunt.lon;
    var zoom  = 18;
    var mapdiv = $('<div id="map"></div>').css({'width':'100%', 'height':$(document).height()});
    $('body').append(mapdiv);
    
    // Define the initial options
    var cartodbMapOptions = {
      zoom: zoom,
      center: new google.maps.LatLng( lat, lng ),
      disableDefaultUI: true,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    }
    
    // Initialize the map
    MediaHunt.map = new google.maps.Map(document.getElementById("map"),cartodbMapOptions);
    
    // Define the map styles
    var map_style = [{
      stylers: [{ saturation: -65 }, { gamma: 1.52 }] }, {
      featureType: "administrative", stylers: [{ saturation: -95 }, { gamma: 2.26 }] }, {
      featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] }, {
      featureType: "administrative.locality", stylers: [{ visibility: 'off' }] }, {
      featureType: "road", stylers: [{ visibility: "simplified" }, { saturation: -99 }, { gamma: 2.22 }] }, {
      featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }, {
      featureType: "road.arterial", stylers: [{ visibility: 'off' }] }, {
      featureType: "road.local", elementType: "labels", stylers: [{ visibility: 'off' }] }, {
      featureType: "transit", stylers: [{ visibility: 'off' }] }, {
      featureType: "road", elementType: "labels", stylers: [{ visibility: 'off' }] }, {
      featureType: "poi", stylers: [{ saturation: -55 }]
    }];
    
    // Set the style
    MediaHunt.map.setOptions({ styles: map_style });
    
    // Define the layer
    var cartoDBLayer = {
      getTileUrl: function(coord, zoom) {
        return "https://" + user + ".cartodb.com/tiles/" + table + "/" + zoom + "/" + coord.x + "/" + coord.y + ".png";
      },
      tileSize: new google.maps.Size(256, 256)
    };
    
    // Add the CartoDB tiles
    MediaHunt.map.overlayMapTypes.insertAt(0, new google.maps.ImageMapType(cartoDBLayer));
    
    var latlon = new google.maps.LatLng(lat, lng);
    MediaHunt.marker = new google.maps.Marker({position:latlon,map:MediaHunt.map,title:"You are here."});
    MediaHunt.marker.setIcon('geomarker.png');
}

MediaHunt.handleLocation = function (position)
{
    MediaHunt.lat = position.coords.latitude;
    MediaHunt.lon = position.coords.longitude;
    
    if (MediaHunt.gotPosition == false)
    {
        MediaHunt.startGame();
        MediaHunt.gotPosition = true;
    }
    else
    {
        MediaHunt.updatePosition();
    }
    MediaHunt.recalculateDistances();
}

MediaHunt.updatePosition = function ()
{
    MediaHunt.marker.setMap(null);
    var latlon = new google.maps.LatLng(MediaHunt.lat, MediaHunt.lon);
    MediaHunt.marker = new google.maps.Marker({position:latlon,map:MediaHunt.map,title:"You are here."});
    MediaHunt.marker.setIcon('geomarker.png');
}

MediaHunt.recalculateDistances = function ()
{
    //var sql = "SELECT name, description, ST_AsGeoJSON(the_geom) as location FROM media_points WHERE ST_distance_sphere(the_geom, ST_Point("+MediaHunt.lat+", "+MediaHunt.lon+")) < 20 LIMIT 1";
    
    var sql = "SELECT name, description, ST_AsGeoJSON(the_geom) as location FROM "+MediaHunt.CartoDbTableName+" WHERE ST_Intersects( the_geom, ST_Buffer( ST_SetSRID('POINT(" + MediaHunt.lon + " " + MediaHunt.lat + ")'::geometry , 4326),"+MediaHunt.getRadDeg(MediaHunt.threshold)+"))";
    
    $.getJSON("http://"+MediaHunt.CartoDbUserName+".cartodb.com/api/v2/sql?q=" + sql, function (data)
	      {
		    if (data.rows.length != 0)
		    {
			MediaHunt.playMedia(data.rows[0])
		    }
	      })
}

MediaHunt.playMedia = function (point)
{
    //alert("Great!!! You found "+ point.name);
    if (!MediaHunt.playing)
    {
	MediaHunt.playing = true;
	var container = $('<div id="media" style="z-index:999;"></div>');
	$('body').prepend(container);
	var closer = $('<div id="close">Close</div>')
	$(closer).click(MediaHunt.stopMedia);
	var emb = $('<iframe style="position: absolute; top:10%; left:10%;" width="80%" height="80%" src="http://www.youtube.com/embed/'+point.description+'?autoplay=1" frameborder="0" allowfullscreen></iframe>');
	$(container).append(closer);
	$(container).append(emb);
    }
}

MediaHunt.stopMedia = function ()
{
    $('#media').remove();
    MediaHunt.playing = false;
}

MediaHunt.getRadDeg = function(dist)
{
    var brng = 180 * Math.PI / 180;
    var distance = dist/6371000;
    var lat1 = MediaHunt.lat * Math.PI / 180;
    var lon1 = MediaHunt.lon * Math.PI / 180;

    var lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance) + 
               Math.cos(lat1) * Math.sin(distance) * Math.cos(brng));

    var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distance) * Math.cos(lat1), Math.cos(distance) - 
               Math.sin(lat1) * Math.sin(lat2));

    if (isNaN(lat2) || isNaN(lon2)) return null;

    return MediaHunt.lat - (lat2 * 180 / Math.PI);
}


MediaHunt.resize = function () {
    $('#map').css({'width':'100%', 'height':$(document).height()});
}

$(function (){
    MediaHunt.init();
    window.onresize = function(event) {
        MediaHunt.resize(event);
    }
});