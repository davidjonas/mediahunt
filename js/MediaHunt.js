//Encapsulating all the functionality in one javascript object so that
//it avoids clashing with existing frameworks or any other js code on the same page.
var MediaHunt = {};

//Configure here!

//Threshold or distance in meters from a point to obtain the media.
MediaHunt.threshold = 25;
//Your CartoDB username
MediaHunt.CartoDbUserName = "davidjonas";
//Your cartoDB table name
MediaHunt.CartoDbTableName = "media_points";

//-------End of configuration---------

//Creating some variables global to the MediaHunt
MediaHunt.lat = 0;
MediaHunt.lon = 0;
MediaHunt.gotPosition = false;
//I am storing the points here to debug and perform caching for possible future extra features. Like moving points.
MediaHunt.points = [];
//The distances are not being stored right now for the same reason as the points.
MediaHunt.distances = [];
//This flags if the user is seeing a video right now.
MediaHunt.playing = false;

//This initializes the page by asking the browser for location and registering the callbacks.
MediaHunt.init = function ()
{
    $(".title").fadeIn(2000);
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

//In case of geolocation error. This runs. Disabled for now.
MediaHunt.posError = function (error)
{
    //alert('There was an error gathering your location data. Sorry! : ' + error.message);
}

//Here we got the position and we are ready to show the map and start the game.
//We let the title fade out for half a second and then show the map
MediaHunt.startGame = function ()
{
    $(".title").fadeOut(500);
    setTimeout(function () {
	//This scrolls the window down one pixel. Which makes the address bar disapear in most android devices.
	//TODO: This is still not working in some situations but it's not critical. 
	window.scrollTo(0,1);
        MediaHunt.showMap();
        MediaHunt.getPointsFromCartoDb();
    }, 500)
}

//This stores all the points on the db locally. this is not used for anything right now. See declaration of MediaHunt.points for more info
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

//Straigt up CartoDB code to show the map.
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

//This gets called whenever the location of the user is updated.
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

//We have a new position, lets update everything.
MediaHunt.updatePosition = function ()
{
    MediaHunt.marker.setMap(null);
    var latlon = new google.maps.LatLng(MediaHunt.lat, MediaHunt.lon);
    MediaHunt.marker = new google.maps.Marker({position:latlon,map:MediaHunt.map,title:"You are here."});
    MediaHunt.marker.setIcon('geomarker.png');
}

//Here we use CartoDB's PostGIS to retrieve all the points that are closer than MediaHunt.threshold
MediaHunt.recalculateDistances = function ()
{
    //TODO: This should check if MediaHunt.getRadDeg(dist) returns null. Then handle the error.
    var sql = "SELECT name, description, ST_AsGeoJSON(the_geom) as location FROM "+MediaHunt.CartoDbTableName+" WHERE ST_Intersects( the_geom, ST_Buffer( ST_SetSRID('POINT(" + MediaHunt.lon + " " + MediaHunt.lat + ")'::geometry , 4326),"+MediaHunt.getRadDeg(MediaHunt.threshold)+"))";
    
    $.getJSON("http://"+MediaHunt.CartoDbUserName+".cartodb.com/api/v2/sql?q=" + sql, function (data)
	      {
		    if (data.rows.length != 0)
		    {
			MediaHunt.playMedia(data.rows[0])
		    }
	      })
}

//Play a video!!
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

//Close the modal dialog with the video
MediaHunt.stopMedia = function ()
{
    $('#media').remove();
    MediaHunt.playing = false;
}

//Here is where it gets complicated...
//To ask postGIS to calculate distance between two points we need to convert our threshold distance in meters
//to an angle in radians. This is because the distance calculation is to be calculated on earth's spherical globe
//so we need to do some math.
MediaHunt.getRadDeg = function(dist)
{
    //this would make the maths more clear if it was:
    //var brng = 180 * Math.PI / 180;
    //But obviously it is clearly always equal to PI so lets optimize:
    var brng = Math.PI;
    //dividing the distance by the (aproximated) radius of the planet; 
    var distance = dist/6371000;
    var lat1 = MediaHunt.lat * Math.PI / 180;
    var lon1 = MediaHunt.lon * Math.PI / 180;

    var lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance) + 
               Math.cos(lat1) * Math.sin(distance) * Math.cos(brng));

    var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distance) * Math.cos(lat1), Math.cos(distance) - 
               Math.sin(lat1) * Math.sin(lat2));

    //if something went wrong, return null.
    if (isNaN(lat2) || isNaN(lon2)) return null;

    return MediaHunt.lat - (lat2 * 180 / Math.PI);
}

//Handle screen resising (and orientation changes) to keep the application running in full window without any scrolling.
MediaHunt.resize = function () {
    $('#map').css({'width':'100%', 'height':$(document).height()});
}

//Finally we set everything up to 
$(function (){
    window.onresize = MediaHunt.resize;
    MediaHunt.init();
});