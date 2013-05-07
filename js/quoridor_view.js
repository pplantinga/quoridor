var SCREEN_WIDTH = window.innerWidth;
var SCREEN_HEIGHT = window.innerHeight - 50;
var X_OFFSET = 55;
var Y_OFFSET = 33;

var container, canvas, ctx, blockWidth, wallWidth;

// Three.js rendering stufs
var camera, scene, projector, pointlight;
var cameraCube, sceneCube;
var webglRenderer;

// Theme stufs
var currentTheme = "canvas";
var themes = { 
	basic:      { cube:'SwedishRoyalCastle', size:9 }, 
	corralidor: { cube:'skybox',             size:9 },
	futuristic: { cube:'Bridge2',            size:9 },
	canvas:     { cube:'none',               size:9 } 
};

// The objects in the scene
var pawns, walls, tempWall, tempPawns, board, geometry; 

var boardSquareWidth = 6.25; // Distance from center to center

var TAU = Math.PI * 2; // CUZ PI IS WRONG!
var theta = 0, phi = TAU / 16, radius = 66, turnIncrement = TAU / 100; // CAMERA LOCATION STUFFS

// Key press stufs
var isLeftDown    = false;
var isUpDown      = false;
var isRightDown   = false;
var isDownDown    = false;
var isZoomInDown  = false;
var isZoomOutDown = false;

var pawn1selected = false;
var pawn2selected = false;

// Our model
var model = new Quoridor_Model( themes[currentTheme].size );

// Picking stufs
var mouse2D, mouse3D, ray;

/**
 * From http://stackoverflow.com/questions/1255512/how-to-draw-a-rounded-rectangle-on-html-canvas
 */
CanvasRenderingContext2D.prototype.roundRect = function ( x, y, w, h, r )
{
  if ( w < 2 * r )
		r = w / 2;
  if ( h < 2 * r )
		r = h / 2;

  this.beginPath();
  this.moveTo( x + r, y );
  this.arcTo( x + w, y,     x + w, y + h, r );
  this.arcTo( x + w, y + h, x,     y + h, r );
  this.arcTo( x,     y + h, x,     y,     r );
  this.arcTo( x,     y,     x + w, y,     r );
  this.closePath();
  return this;
}

jQuery( document ).ready( doc_ready );

function doc_ready()
{
	// Bind Handlers
	jQuery( document ).mousemove( onDocumentMouseMove );
	jQuery( document ).mousedown( onDocumentMouseDown );
	jQuery( document ).bind( 'mousewheel DOMMouseScroll', onDocumentMouseWheel );
	jQuery( document ).keydown( onDocumentKeyDown );
	jQuery( document ).keyup( onDocumentKeyUp );
	jQuery( '#messages-container' ).click( function() { jQuery( '#messages-container' ).fadeOut( 'slow' ) } );

	// "Moves" sidebar
	jQuery( '#moves-table tbody' ).append( "<tr><th class='move-number'></th><th id='name_1'>" + name_1 + "</th><th id='name_2'>" + name_2 + "</th></tr>" );
	
	if ( player == "viewer" )
	{
		var prev = "<a id='prev_link' href='#' title='previous move'>"
				+ "&lt;<div class='triangle left-triangle'></div>"
			+ "</a>";
		var next = "<a id='next_link' href='#' title='next move'>"
				+ "&gt;<div class='triangle right-triangle'></div>"
			+ "</a>";
		jQuery( '#block-quoridor-quoridor-moves' ).append( "<ul id='move-nav'></ul>" );
		jQuery( '#move-nav' ).append( "<li>" + prev + "</li>" ).append( "<li>" + next + "</li>" );
		jQuery( '#prev_link' ).click( get_move );
		jQuery( '#next_link' ).click( get_move );
	}

	// Theme changing buttons
	jQuery( '.menu li a' ).click( toggle );

	post_move( "begin" );

	init();
	animate();
}

function get_move( event ) {
	if ( event.currentTarget.id == 'prev_link' )
		post_move( 'begin', model.turn - 1 );
	else
		post_move( 'begin', model.turn + 1 );
}

function post_move( a_move, a_turn )
{
	jQuery.post(
		window.location.pathname + "/move",
		{ move: a_move, turn: a_turn },
		response
	);
}

function response( msg )
{
	moves = msg.split( " " );
	
	if ( moves[0] == "begin" )
	{
		// Remove all rows except the first in the moves table
		jQuery( '#moves-table tbody tr:not(:first)' ).remove();

		model = new Quoridor_Model( themes[currentTheme].size );
		if ( moves.length > 1 )
		{
			for ( var i = 1; i < moves.length; i++ )
				view_decode_move( moves[i] );
		}

		if ( model.to_play + 1 != player && player != 'viewer' )
			post_move( 'poll', model.turn + 1 );
	}
	else if ( msg == "no move" )
	{
		setTimeout( function() { post_move( 'poll', model.turn + 1 ) }, 3000 );
	}
	else if ( moves[0] == "start" )
	{
		if ( moves[1] == "wait" )
		{
			setTimeout( function() { post_move( 'poll', "start" ) }, 3000 );
		}
		else
		{
			name_1 = moves[1];
			name_2 = moves[2];
			jQuery( '#moves-table #name_1' ).html( name_1 );
			jQuery( '#moves-table #name_2' ).html( name_2 );
			
			if ( player != model.to_play + 1 )
				setTimeout( function() { post_move( 'poll', 1 ) }, 3000 );
		}
	}
	else if ( !view_decode_move( msg ) )
	{
		setTimeout( function() { post_move( 'poll', model.turn ) }, 3000 );
	}
}

function view_decode_move( move_string )
{
	move = string_to_move( move_string );

	if ( move.o != undefined )
	{
		if ( model.wall( move.x, move.y, move.o ) )
			view_move( true, move.x, move.y, move.o );
		else
			return false;
	}
	else
	{
		if ( model.move( move.x, move.y ) )
			view_move( true, move.x, move.y );
		else
			return false;
	}
}

function init()
{
	container = document.createElement( 'div' );
	document.body.appendChild( container );
		
	if ( currentTheme == "canvas" )
	{
		canvas = document.createElement( 'canvas' );
		if ( canvas.getContext )
			ctx = canvas.getContext( "2d" );
		else
			message( "Your browser doesn't support the canvas element" );
		
		boardSquareWidth = 2/9;
		container.appendChild( canvas );
		return;
	}
	else
	{
		scene = new THREE.Scene();
		sceneCube = new THREE.Scene();

		boardSquareWidth = 6.25;

		// LIGHTS

		var ambient = new THREE.AmbientLight( 0x999999 );
		scene.addLight( ambient );

		var directionalLight = new THREE.DirectionalLight( 0x777777 );
		directionalLight.position.y = 70;
		directionalLight.position.z = 100;
		directionalLight.position.x = -100;
		directionalLight.position.normalize();
		scene.addLight( directionalLight );

		pointLight = new THREE.PointLight( 0xffaa55 );
		pointLight.position.x = 0;
		pointLight.position.y = 10;
		pointLight.position.z = 0;

		// CAMERA
		
		camera = new THREE.Camera( 75, SCREEN_WIDTH / SCREEN_HEIGHT, 1, 1000 );
		camera.position.y = radius * Math.sin( phi );
		camera.position.x = radius * Math.cos( phi ) * Math.sin( theta );
		camera.position.z = radius * Math.cos( phi ) * Math.cos( theta );

		cameraCube = new THREE.Camera( 50, SCREEN_WIDTH / SCREEN_HEIGHT, 1, 100 );

		camera.updateMatrix();

		// ACTION
		
		try
		{
			webglRenderer = new THREE.WebGLRenderer();
			webglRenderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT + 80 );
			webglRenderer.autoClear = false;
			webglRenderer.domElement.style.position = "relative";
			container.appendChild( webglRenderer.domElement );
		}
		catch ( e )
		{
			message( "Your browser doesn't support webGL :(" );
		}

		// PICKING ( not your nose )
		
		projector = new THREE.Projector();
		mouse2D = new THREE.Vector3( 0, 0, 0.5 );
		ray = new THREE.Ray( camera.position, null );

		load();
	}
}

function load()
{
	// begin CubeMap stuffz
	var path = "/quoridor/cube/" + themes[currentTheme].cube + "/";
	var format = '.jpg';
	var urls = [
			path + 'px' + format, path + 'nx' + format,
			path + 'py' + format, path + 'ny' + format,
			path + 'pz' + format, path + 'nz' + format
		];

	var reflectionCube = THREE.ImageUtils.loadTextureCube( urls );

	THREE.SceneUtils.addPanoramaCubeWebGL( sceneCube, 10, reflectionCube );

	// Load objects via ajax
	var loader = new THREE.JSONLoader();

	loader.load( { model: "/quoridor/obj/" + currentTheme + "/pawn.js", callback: function( geometry ) { addPawns( geometry ); } } );
	loader.load( { model: "/quoridor/obj/" + currentTheme + "/wall.js", callback: function( geometry ) { addWalls( geometry ); } } );
	loader.load( { model: "/quoridor/obj/" + currentTheme + "/board.js", callback: function( geometry ) { 
		board = addObject( geometry, "board", new THREE.MeshFaceMaterial(), board, 0 ); } } );
}

/*
 * adds the pawn objects to the scene after initialization
 */
function addPawns( geometry )
{
	pawns = new Array();
	pawns[0] = addObject( geometry, "pawn1", new THREE.MeshLambertMaterial( {color: 0xFFFFFF} ), pawns[0], TAU/2 );
	pawns[1] = addObject( geometry, "pawn2", new THREE.MeshLambertMaterial( {color: 0x660066} ), pawns[1], 0 );
	placePawn( pawns[0], model.getLocation( 0, 'x' ), model.getLocation( 0, 'y' ) );
	placePawn( pawns[1], model.getLocation( 1, 'x' ), model.getLocation( 1, 'y' ) );
	
	tempPawns = new Array();
	for ( var i = 0; i < 5; i++ )
	{
		tempPawns[i] = addObject( geometry, "tempPawn" + i, new THREE.MeshBasicMaterial( {color: 0xffcc66, opacity: 0.5} ), tempPawns[i], 0 );
		hidePawn( tempPawns[i] );
	}
}

// Hides a pawn by displaying it really far away
function hidePawn( pawn )
{
	placePawn( pawn, 1000, 1000 ); 
}

/*
 * creates an array of 20 walls and puts them at the starting location
 */
function addWalls( geometry )
{
	walls = new Array();
	for ( var j = 0; j < 2; j++ )
	{
		walls[j] = new Array();
		for ( var k = 0; k < 10; k++ )
		{
			walls[j][k] = addObject( geometry, "wall", new THREE.MeshFaceMaterial(), walls[j][k], 0 );

			if ( model.wallLocations[j][k] )
			{
				placeWall(
					walls[j][k],
					model.wallLocations[j][k].x,
					model.wallLocations[j][k].y,
					model.wallLocations[j][k].o
				);
			}
			else
			{
				placeWall(
					walls[j][k],
					k - 1,
					( j * 11 ) - 2,
					0
				);
			}
		}
	}

	tempWall = addObject( geometry, "tempWall", new THREE.MeshBasicMaterial( {color: 0xffcc66, opacity: 0.5} ), tempWall, 0 );
	placeWall( tempWall, 1000, 1000, 0 );
}

/*
 * Adjusts a pawn's x and z coordinates based on board coordinates
 * coord is a 2 element array with values from 0-8 representing the x and z position on the board respectively
 */
function placePawn( pawn, x, y )
{
	pawn.position.x = boardSquareWidth * ( x - 4 );
	pawn.position.z = boardSquareWidth * ( y - 4 );
	pawn.rotation.y = model.to_play || pawn.name == "pawn2" ? 0 : TAU / 2;
}

/* 
 * Adjusts a wall's x and z coordinates based on board coordinates
 * coord is a 2 element array with values from 0-8 representing the x and z position on the board respectively
 * orient tells if it is horizontal or vertical, 0 for horizontal 1 for vertical
 */
function placeWall( wall, x, y, orient )
{
	wall.position.x = boardSquareWidth * ( x - 3.5 );
	wall.position.z = boardSquareWidth * ( y - 3.5 );
	wall.rotation.y = orient * TAU / 4;
}

// adds obj to the scene rotated in the direction of ry, rz with material
function addObject( geometry, name, material, obj, ry )
{
	for ( var i in geometry.materials )
	{
		if ( geometry.materials[i][0].map )
		{
			geometry.materials[i][0].map.wrapS = THREE.RepeatWrapping;
			geometry.materials[i][0].map.wrapT = THREE.RepeatWrapping;
		}
	}
	
	obj = new THREE.Mesh( geometry, material );
	obj.name = name;
	obj.rotation.y = ry;
	obj.overdraw = true;
	obj.updateMatrix();
	scene.addObject( obj );
	return obj;
}

function onDocumentMouseMove( event )
{
	event.preventDefault();
	
	if ( model.won != 0 || model.to_play + 1 != player )
		return;

	if ( currentTheme != 'canvas' )
	{
		// translates screen coordinates to some other kind
		mouse2D.x = ( event.offsetX / SCREEN_WIDTH ) * 2 - 1;
		mouse2D.y = - ( event.offsetY / SCREEN_HEIGHT ) * 2 + 1;
	}
	else
	{
		// Don't show by default
		tempWall = { x: 1000, y: 1000, o: 0 };
	}

	if ( currentTheme == "canvas" && !pawn1selected && !pawn2selected )
	{
		pos = get_board_pos( event );
		var x = posToElement( pos.x ),
		    y = posToElement( pos.y );

		if ( x != model.getLocation( model.to_play, 'x' ) || y != model.getLocation( model.to_play, 'y' ) )
		{
			tempWall.x = posToWallElement( pos.x );
			tempWall.y = posToWallElement( pos.y );
			tempWall.o = findOrientation( pos.x, pos.y );
		}
	}

	if ( currentTheme != "canvas" && !pawn1selected && !pawn2selected )
	{
		// render temporary walls
		var intersects = ray.intersectScene( scene );
		if ( intersects.length > 0 )
		{
			for ( var i in intersects )
			{
				if ( intersects[i].object.name == "pawn1" && model.to_play == 0 || intersects[i].object.name == "pawn2" && model.to_play == 1 )
				{
					placeWall( tempWall, 1000, 1000, 0 );
					break;
				}

				if ( intersects[i].object.name == "board" )
				{
					var wallx = posToWallElement( intersects[i].point.x );
					var wally = posToWallElement( intersects[i].point.z );
					var o = findOrientation( intersects[i].point.x, intersects[i].point.z );
			
					if ( model.isLegalWall( wallx, wally, o ) )
						placeWall( tempWall, wallx, wally, o );
					else
						placeWall( tempWall, 1000, 1000, 0 );
				
					break;
				}
			}
		}
	}
}

// figures out what is underneath where you clicked, and puts those in order in the intersector variable
function onDocumentMouseDown( event )
{
	event.preventDefault();

	if ( model.won != 0 || model.to_play + 1 != player )
		return;

	if ( currentTheme == "canvas" )
	{
		// need another transform
		pos = get_board_pos( event );
		var x = posToElement( pos.x ),
		    y = posToElement( pos.y ),
		    o = findOrientation( pos.x, pos.y ),
		wallx = posToWallElement( pos.x ),
		wally = posToWallElement( pos.y );

		if ( x == model.getLocation( 0, 'x' ) && y == model.getLocation( 0, 'y' ) && model.to_play == 0 )
		{
			pawn1selected = !pawn1selected;
			return;
		}
		else if ( x == model.getLocation( 1, 'x' ) && y == model.getLocation( 1, 'y' ) && model.to_play == 1 )
		{
			pawn2selected = !pawn2selected;
			return;
		}

		if ( pawn1selected || pawn2selected )
		{
			if ( model.move( x, y ) )
				view_move( false, x, y );
		}
		else if ( model.wall( wallx, wally, o ) )
		{
			view_move( false, wallx, wally, o );
		}
		
		return;
	}
	
	mouse3D = projector.unprojectVector( mouse2D.clone(), camera );
	ray.direction = mouse3D.subSelf( camera.position ).normalize();

	var intersects = ray.intersectScene( scene );
	
	if ( intersects.length > 0 )
	{
		if ( intersects[0].object.name == "pawn1" && model.to_play == 0 )
		{
			pawn1selected = !pawn1selected;
		}
		else if ( intersects[0].object.name == "pawn2" && model.to_play == 1 )
		{
			pawn2selected = !pawn2selected;
		}

		if ( pawn1selected || pawn2selected )
		{
			placeWall( tempWall, 1000, 1000, 0 );
			displayTempPawns();
		}
		else
		{
			hideTempPawns();
		}

		for ( var i in intersects )
		{
			if ( intersects[i].object.name == "board" || intersects[i].object.name.substring( 0, 8 ) == "tempPawn" )
			{
				intersector = intersects[i];
				break;
			}
		}
		
		if ( intersector )
		{
			var x = posToElement( intersector.point.x ),
			    y = posToElement( intersector.point.z ),
					o = findOrientation( intersector.point.x, intersector.point.z ),
			wallx = posToWallElement( intersector.point.x ),
			wally = posToWallElement( intersector.point.z );

			if ( pawn1selected || pawn2selected )
			{
				if ( model.move( x, y ) )
					view_move( false, x, y );
			}
			else if ( model.wall( wallx, wally, o ) )
			{
				view_move( false, wallx, wally, o );
			}
		} 
	}
}

function view_move( begin, x, y, o )
{
	// on move
	if ( o == undefined )
	{
		if ( currentTheme != 'canvas' )
		{
			placePawn( pawns[model.to_play], x, y );
			hideTempPawns();
		}

		if ( y == 0 && model.to_play == 1 || y == 8 && model.to_play == 0 )
		{
			/* Let user know if they won */
			model.won = ( model.to_play + 1 );
			message( "Player " + ( model.to_play + 1 ) + " Wins!" );
		}
	}
	// on wall
	else
	{
		if ( currentTheme != 'canvas' )
			placeWall( walls[model.to_play][model.wallsLeft()], wallx, wally, o );
	}

	/* append string to table of moves */
	var move_string = move_to_string( x, y, o );
	var move = ( model.turn - model.turn % 2 ) / 2 + 1;
	
	if ( model.to_play == 1 )
	{
		var append_element = jQuery( '<td class="player-2">' + move_string + '</td>' ).hide();
		jQuery( '#move-' + move ).append( append_element );
		append_element.fadeIn();
	}
	else
	{
		var append_element = jQuery( '<tr id="move-' + move + '"><td class="move-number">' + move + '.</td><td class="player-1">' + move_string + '</td></tr>' ).hide();
		jQuery( '#moves-table tbody' ).append( append_element );
		append_element.fadeIn( 'slow' );
		
		// Scroll to bottom after appending the element
		var div = document.getElementById( 'sidebar-1' );
		div.scrollTop = div.scrollHeight;
		//jQuery( '#sidebar-1' ).animate( { scrollTop: jQuery('#sidebar-1').attr("scrollHeight") }, 'slow' );
	}

	/* Send move to server if we're not getting it from the server */
	if ( !begin )
	{
		post_move( move_string );

		// Start polling for the opponent's move
		post_move( 'poll', model.turn + 1 );
	}

	model.turn = model.turn + 1;
	model.to_play = ( model.to_play + 1 ) % 2;
	pawn1selected = pawn2selected = false;
	if ( model.to_play == 0 )
		document.title = name_1 + "'s turn | Quoridor";
	else	
		document.title = name_2 + "'s turn | Quoridor";
}

function get_board_pos( event )
{
	var board_x = ( ( event.offsetX - X_OFFSET + SCREEN_HEIGHT / 2 - SCREEN_WIDTH / 2 ) / SCREEN_HEIGHT ) * 2 - 1;
	var board_y = ( ( event.offsetY - Y_OFFSET ) / SCREEN_HEIGHT ) * 2 - 1;
	return { x: board_x, y: board_y };
}

function onDocumentMouseWheel( event )
{
  var rolled = event.wheelDelta ? - event.wheelDelta / 40 : event.detail;
  if ( radius > 5 || rolled > 0 )
  		radius += rolled;
}

function displayTempPawns()
{
	var moves = new Array();
	moves = model.listLegalMoves();
	for ( var i = 0; i < moves.length; i++ )
	{
		if ( currentTheme == "canvas" )
			paintPawn( 'lightgray', 'gray', moves[i].x, moves[i].y )
		else
			placePawn( tempPawns[i], moves[i].x, moves[i].y );
	}
}

//hide all of the temporary pawns
function hideTempPawns()
{
	for ( var i = 0; i < tempPawns.length; i++ )
	{
		hidePawn( tempPawns[i] );
	}
}

function posToElement( pos )
{
	return Math.floor( pos / boardSquareWidth + 4.5 );//for great justice.
}

function posToWallElement( pos )
{
	return Math.floor( pos / boardSquareWidth + 4 );//for great justice.
}

//Given an x, y as world coordinates, decides if a wall placed at this location would be better as horizontal or vertical
function findOrientation( x, y )
{
	return Math.floor( ( x - y + boardSquareWidth * 9 ) / boardSquareWidth ) % 2 != Math.floor( ( x + y + boardSquareWidth * 9 ) / boardSquareWidth ) % 2;
}

// looks for keys that are really sad ( depressed )
function onDocumentKeyDown( event )
{
	switch ( event.keyCode )
	{
		case 33:
			isZoomInDown  = true; break;
		case 34:
			isZoomOutDown = true; break;
		case 37: 
		case 65:
			isLeftDown    = true; break;
		case 38:
		case 87:
			isUpDown      = true; break; 	
		case 39:
		case 68:
			isRightDown   = true; break; 
		case 40:	
		case 83:
			isDownDown    = true; break;
	}
}

// hopes that keys are less sad
function onDocumentKeyUp( event )
{
	switch ( event.keyCode )
	{
		case 33:
			isZoomInDown  = false; break;
		case 34:
			isZoomOutDown = false; break;
		case 37: 
		case 65:
			isLeftDown    = false; break;
		case 38:
		case 87:
			isUpDown      = false; break; 	
		case 39:
		case 68:
			isRightDown   = false; break; 
		case 40:	
		case 83:
			isDownDown    = false; break;
	}
}

//draws the next frame just about as fast as it can
function animate()
{
	window.setTimeout( animate, 50 );
	render();
}

//does camera stuff
//also uses an alternate camera to produce a view of the cubemap that can be used for reflections and whatnot
//does the rendering
function render()
{
	SCREEN_WIDTH = window.innerWidth;
	SCREEN_HEIGHT = window.innerHeight - 50;

	if ( currentTheme == "canvas" )
	{
		canvas.width = SCREEN_WIDTH;
		canvas.height = SCREEN_HEIGHT + 50 + Y_OFFSET;
		blockWidth = SCREEN_HEIGHT / ( themes[currentTheme].size * 4/3 );
		wallWidth = SCREEN_HEIGHT / themes[currentTheme].size - blockWidth - 3;
	
		ctx.clearRect( 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT );
		
		for ( var i = 0; i < 9; i++ )
		{
			for ( var j = 0; j < 9; j++ )
			{
				ctx.fillStyle = "white";
				ctx.roundRect(
					X_OFFSET + SCREEN_HEIGHT * i / 9 + SCREEN_WIDTH / 2 - SCREEN_HEIGHT / 2 - 1,
					Y_OFFSET + SCREEN_HEIGHT * j / 9 + wallWidth / 2,
					blockWidth + 2,
					blockWidth + 2,
					5
				).fill();
				
				if ( j == 0 || j == 8 )
					ctx.fillStyle = "#888";
				else
					ctx.fillStyle = "#666";
				
				ctx.roundRect(
					X_OFFSET + SCREEN_HEIGHT * i / 9 + SCREEN_WIDTH / 2 - SCREEN_HEIGHT / 2,
					Y_OFFSET + SCREEN_HEIGHT * j / 9 + wallWidth / 2 + 1,
					blockWidth,
					blockWidth,
					5
				).fill();
				
				ctx.fillStyle = "white";
				ctx.font = "15px not_just_groovy";
				if ( i == 0 )
				{
					ctx.fillText(
						j + 1,
						X_OFFSET + SCREEN_WIDTH / 2 - SCREEN_HEIGHT / 2 + wallWidth / 2,
						Y_OFFSET + SCREEN_HEIGHT * j / 9 + blockWidth
					);
				}

				if ( j == 8 )
				{
					ctx.fillText(
						number_to_letter( i ),
						X_OFFSET + SCREEN_HEIGHT * i / 9 + blockWidth + SCREEN_WIDTH / 2 - SCREEN_HEIGHT / 2 - wallWidth,
						Y_OFFSET + SCREEN_HEIGHT - wallWidth
					);
				}
			}
		}

		paintWalls();
		paintPawns();
	}
	else
	{
		//adjust camera position based on keyboard keys
		if ( isZoomInDown && radius > 2 )
			radius--;
		if ( isZoomOutDown )
			radius++;
		if ( isLeftDown )
			theta -= turnIncrement;
		if ( isUpDown && phi < TAU / 4 - turnIncrement )
			phi += turnIncrement;
		if ( isRightDown )
			theta += turnIncrement;
		if ( isDownDown && phi > turnIncrement )
			phi -= turnIncrement;

		camera.position.y = radius * Math.sin( phi );
		camera.position.x = radius * Math.cos( phi ) * Math.sin( theta );
		camera.position.z = radius * Math.cos( phi ) * Math.cos( theta );

		camera.updateMatrix();

		cameraCube.target.position.x = - camera.position.x;
		cameraCube.target.position.y = - camera.position.y;
		cameraCube.target.position.z = - camera.position.z;


		mouse3D = projector.unprojectVector( mouse2D.clone(), camera );
		ray.direction = mouse3D.subSelf( camera.position ).normalize();

		if ( webglRenderer != undefined )
		{
			webglRenderer.clear();
			webglRenderer.enableDepthBufferWrite( false );
			webglRenderer.render( sceneCube, cameraCube );
			webglRenderer.enableDepthBufferWrite( true );
			webglRenderer.render( scene, camera );
		}
	}
}

/*
* This function paints all the walls
*/
function paintWalls()
{
	for ( var i = 0; i < 2; i++ )
	{
		if ( i == 0 )
			var color = "#923";
		else
			var color = "#293";

		for ( var j = 0; j < 10; j++ )
			if ( model.wallLocations[i][j] )
				paintWall( color, model.wallLocations[i][j].x, model.wallLocations[i][j].y, model.wallLocations[i][j].o );
			else
				paintWall( color, i * 11 - 2, j - 1, 1 );
	}

	if ( tempWall )
	{
		if ( !pawn1selected && !pawn2selected && model.isLegalWall( tempWall.x, tempWall.y, tempWall.o ) )
		paintWall( "#964", tempWall.x, tempWall.y, tempWall.o );
	}
}

/*
* This function paints a wall
*/
function paintWall( color, x, y, o )
{
	ctx.fillStyle = color;
	if ( o )
	{
		ctx.fillRect(
			X_OFFSET + SCREEN_HEIGHT * x / 9 + SCREEN_WIDTH / 2 - SCREEN_HEIGHT / 2,
			Y_OFFSET + SCREEN_HEIGHT * y / 9 + blockWidth + wallWidth / 2 + 2,
			2 * blockWidth + wallWidth + 3,
			wallWidth
		);
	}
	else
	{
		ctx.fillRect(
			X_OFFSET + SCREEN_HEIGHT * x / 9 + SCREEN_WIDTH / 2 - SCREEN_HEIGHT / 2 + blockWidth + 2,
			Y_OFFSET + SCREEN_HEIGHT * y / 9 + wallWidth / 2,
			wallWidth,
			2 * blockWidth + wallWidth + 3
		);
	}
}

/*
* This function paints the two pieces
*/
function paintPawns()
{
	paintPawn( '#923', '#F46', model.getLocation( 0, 'x' ), model.getLocation( 0, 'y' ) );
	paintPawn( '#293', '#4F6', model.getLocation( 1, 'x' ), model.getLocation( 1, 'y' ) );
	if ( pawn1selected || pawn2selected )
		displayTempPawns();
}

/*
* this paints one piece
*/
function paintPawn( color1, color2, x, y )
{
	var screen_x = X_OFFSET + SCREEN_HEIGHT * x / 9 + SCREEN_WIDTH / 2 - SCREEN_HEIGHT / 2 + blockWidth / 2;
	var screen_y = Y_OFFSET + SCREEN_HEIGHT * y / 9 + blockWidth * 2 / 3;
	var screen_r = blockWidth / 2 - 5;
	var radial_gradient = ctx.createRadialGradient( screen_x, screen_y, 0, screen_x, screen_y, screen_r );
	radial_gradient.addColorStop( 1, color1 );
	radial_gradient.addColorStop( 0, color2 );
	
	ctx.fillStyle = radial_gradient;
	ctx.beginPath();
	ctx.arc( screen_x, screen_y, screen_r, 0, TAU, false );
	ctx.fill();
}

/* Translation functions */
function string_to_move( move_string )
{
	var move = {
		x: letter_to_number( move_string.charAt( 0 ) ),
		y: parseInt( move_string.charAt( 1 ) ) - 1
	};

	if ( move_string.length == 3 )
		move.o = move_string.charAt( 2 ) == 'h';

	return move;
}

function move_to_string( x, y, o )
{
	var move_part = number_to_letter( x ) + ( y + 1 );
	
	if ( o !== undefined )
	{
		if ( o )
			return move_part + 'h';
		else
			return move_part + 'v';
	}
	else
	{
		return move_part;
	}
}

function letter_to_number( letter )
{
	switch ( letter )
	{
		case 'a':
			return 0;
		case 'b':
			return 1;
		case 'c':
			return 2;
		case 'd':
			return 3;
		case 'e':
			return 4;
		case 'f':
			return 5;
		case 'g':
			return 6;
		case 'h':
			return 7;
		case 'i':
			return 8;
	}
}

function number_to_letter( num )
{
	switch ( num )
	{
		case 0:
			return 'a';
		case 1:
			return 'b';
		case 2:
			return 'c';
		case 3:
			return 'd';
		case 4:
			return 'e';
		case 5:
			return 'f';
		case 6:
			return 'g';
		case 7:
			return 'h';
		case 8:
			return 'i';
	}
}

// switch the themes if the theme buttons get clicked
function toggle( event )
{
	if ( event.currentTarget.id == "help" )
	{
		helpPage();
		return;
	}

	if ( event.currentTarget.id != "new" )
	{
		jQuery( '.active' ).removeClass( "active" );
		jQuery( event.currentTarget ).addClass( "active" );
		currentTheme = event.currentTarget.id;
	}
	else
	{
		// if they hit the "new game" button, restart the model
		model = new Quoridor_Model( themes[currentTheme].size );
		animate();
	}

	// remove the old div
	document.body.removeChild( container );

	// restart the div
	init();
}

function helpPage()
{
	message( "<h1>Hello there captain!</h1>"
		+ "<h3>Rules:</h3>"
		+ "Every turn a player may either move his pawn one space or place a wall. "
		+ "The goal is to reach the other side before your opponent reaches yours. "
		+ "You aren't allowed to block either player from reaching the other side."
		+ "<h3>Movement:</h3>"
		+ "To move a piece, click on it, and then on the destination square. "
		+ "To place a wall, click on the place that you want it. "
		+ "To rotate the camera use WASD or the arrow keys. "
		+ "To zoom use the mouse wheel or 'page up' and 'page down'." );
}

function message( message )
{
	jQuery( '#messages' ).html( message );
	jQuery( '#messages-container' ).fadeIn();
}
