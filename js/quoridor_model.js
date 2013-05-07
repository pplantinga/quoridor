/*
 * Peter's quoridor model
 */
var Quoridor_Model = function( boardSize )
{
	this.size = 2 * boardSize - 1;
	this.board = new Array( this.size );
	
	for ( var i = 0; i < this.size; i++ )
	{
		this.board[i] = new Array( this.size );
		for ( var j = 0; j < this.size; j++ )
			this.board[i][j] = 0;
	}
	
	this.locations = [ { x:Math.floor( this.size / 2 ), y:0 }, { x:Math.floor( this.size / 2 ), y:this.size - 1 } ];
	this.board[this.locations[0].x][this.locations[0].y] = 1;
	this.board[this.locations[1].x][this.locations[1].y] = 2;
	this.walls = [10, 10];
	this.wallLocations = [];
	this.wallLocations[0] = new Array( 10 );
	this.wallLocations[1] = new Array( 10 );
	this.potentialMoveOffsets = [[0, 1], [-1, 0], [1, 0], [0, -1]];
	this.to_play = 0;
	this.turn = 0;
	this.won = 0;
}

Quoridor_Model.prototype =
{
	// Make your move
	move: function( new_x, new_y )
	{
		// Convert to board coordinates
		var x = 2 * new_x, y = 2 * new_y;
		
		var old_x = this.locations[this.to_play].x;
		var old_y = this.locations[this.to_play].y;

		// If legal, make the move
		if ( this.isLegalMove( this, old_x, old_y, x, y ) )
		{
			this.board[x][y] = this.to_play + 1;
			this.board[old_x][old_y] = 0;
			this.locations[this.to_play].x = x;
			this.locations[this.to_play].y = y;
			
			return true;
		}

		return false;
	},

	// Returns an array of legal locations the active piece can move to
	listLegalMoves: function()
	{
		var old_x = this.locations[this.to_play].x;
		var old_y = this.locations[this.to_play].y;

		var start_x = Math.max( 0, old_x - 4 );
		var start_y = Math.min( 0, old_y - 4 );
		var end_x = Math.max( 18, old_x + 4 );
		var end_y = Math.max( 18, old_x + 4 );
		
		var moves = new Array();
		for ( var i = start_x; i < end_x; i += 2 )
		{
			for ( var j = start_y; j < end_y; j += 2 )
			{
				if ( this.isLegalMove( this, old_x, old_y, i, j ) )
					moves[moves.length] = { x:i / 2, y:j / 2 };
			}	
		}
		return moves;
	},

	// Check if a move is legal
	isLegalMove: function( board, old_x, old_y, new_x, new_y )
	{
		// Check legality
		if ( this.isOnBoard( new_x ) && this.isOnBoard( new_y ) )
		{
			if ( board.board[ new_x ][ new_y ] == 0 )
			{
				// normal move
				if ( 
					( 
						( new_x == old_x + 2 || new_x == old_x - 2 ) //row is off by one 
						&& 
						new_y == old_y //same column
					||
						( new_y == old_y + 2 || new_y == old_y - 2 ) 
						&& 
						new_x == old_x
					 )
					&& 
					board.board[( new_x + old_x ) / 2][( new_y + old_y ) / 2] != 3 ) //no wall between piece and target 
				{	
					return true;
				}
				// jump in a straight line
				else if ( 
					( 
						( old_x + 4 == new_x || old_x - 4 == new_x ) //If the space in target is two away in the row
						&& 
						old_y == new_y 	//and in the same column
						&&
						board.board[ ( old_x + new_x ) / 2 + 1 ][ old_y ] != 3 //next two: and there's no wall between you and the adjacent piece or adjacent piece and target
						&& 
						board.board[ ( old_x + new_x ) / 2 - 1 ][ old_y ] != 3
					|| 
						( old_y + 4 == new_y || old_y - 4 == new_y ) 
						&& 
						old_x == new_x 	
						&& 
						board.board[ old_x ][ ( old_y + new_y ) / 2 + 1 ] != 3 
						&& 
						board.board[ old_x ][ ( old_y + new_y ) / 2 - 1 ] != 3
					 )
					&& 
					board.board[ ( old_x + new_x ) / 2 ][ ( old_y + new_y ) / 2 ] != 0 ) //and there's a piece between target and active piece
				{
					return true;
				}																															               
				//jump diagonally if blocked by enemy $piece and a wall or another enemy $piece and the edge of the board
				else if ( 
					( old_x + 2 == new_x || old_x - 2 == new_x ) //You're looking at a spot with new_x value offset by one
					&& 
					( old_y + 2 == new_y || old_y - 2 == new_y ) //and it has a new_y value offset by one
					&& 
					( 
						board.board[ new_x ][ old_y ] != 0 //there's a piece adjacent
						&& 
						( !this.isOnBoard( new_x + ( new_x - old_x ) / 2 ) || board.board[x + ( new_x - old_x ) / 2][old_y] == 3 ) //there's a wall on the far side of them, or that goes off the board
						&& 
						board.board[ ( new_x + old_x ) / 2 ][ old_y ] != 3 //there's no wall between you and piece to jump
						&& 
						board.board[ new_x ][ ( new_y + old_y ) / 2 ] != 3 //there's no wall between piece to jump and spot to land
					|| 
						board.board[ old_x ][ new_y ] != 0 
						&& 
						( board.board[ old_x ][ new_y + ( new_y - old_y ) / 2 ] == 3 || !this.isOnBoard( new_y + ( new_y - old_y ) / 2 ) ) 
						&& 
						board.board[ old_x ][ ( new_y + old_y ) / 2 ] != 3 
						&& 
						board.board[ ( new_x + old_x ) / 2 ][ new_y ] != 3
					 )
					)
				{
					return true;
				}
		 	}   
		}
	 	return false; 
	},

  //a function to tell you whether the given value is on the board
	isOnBoard: function( val )
	{
		return val < this.size && val >= 0;
	},

	// Place a wall
	wall: function( new_x, new_y, o )
	{
		// Convert to board coordinates
		var x = new_x * 2 + 1, y = new_y * 2 + 1, xadd = o ? 1 : 0, yadd = o ? 0 : 1;
		
		// If legal, place the wall
		if ( this.isLegalWall( new_x, new_y, o ) )
		{
			var test_board_1 = jQuery.extend( true, {}, this );
			var test_board_2 = jQuery.extend( true, {}, this );

			test_board_1.board[x][y] = 3;
			test_board_1.board[x - xadd][y - yadd] = 3;
			test_board_1.board[x + xadd][y + yadd] = 3; 
			test_board_1.board[this.locations[1].x][this.locations[1].y] = 0;

			test_board_2.board[x][y] = 3;
			test_board_2.board[x - xadd][y - yadd] = 3;
			test_board_2.board[x + xadd][y + yadd] = 3; 
			test_board_2.board[this.locations[0].x][this.locations[0].y] = 0;
			
			if ( this.path_exists( test_board_1, this.locations[0].x, this.locations[0].y, 1 )
				&& this.path_exists( test_board_2, this.locations[1].x, this.locations[1].y, 2 ) )
			{
				this.board[x][y] = 3;
				this.board[x - xadd][y - yadd] = 3;
				this.board[x + xadd][y + yadd] = 3; 

				this.walls[this.to_play]--;
				this.wallLocations[this.to_play][this.walls[this.to_play]] = { x:new_x, y:new_y, o:o };
				return true;
			}
		}
		return false;
	},

	// Check if a wall is legal
	isLegalWall: function( new_x, new_y, o )
	{
		// Convert to board coordinates
		var x = new_x * 2 + 1,
		    y = new_y * 2 + 1,
		 xadd = o ? 1 : 0,
		 yadd = o ? 0 : 1;

		// Check legality
		return x < this.size && y < this.size && x >= 0 && y >= 0 && this.walls[this.to_play] > 0
			&& this.board[x][y] != 3 && this.board[x - xadd][y - yadd] != 3 && this.board[x + xadd][y + yadd] != 3;
	},

	// Return the location of the piece in coordinates the view understands
	getLocation: function( piece, axis )
	{
		return this.locations[piece][axis] / 2;
	},

	// Return the number of walls the current player has left
	wallsLeft: function()
	{
		return this.walls[this.to_play];
	},

	path_exists: function( test_board, x, y, piece )
	{
		if ( y == 0 && piece == 2 || y == 16 && piece == 1 )
			return true;
		
		test_board.board[x][y] = piece;
		
		if ( test_board.isLegalMove( test_board, x, y, x, y - 2 ) )
			if ( this.path_exists( test_board, x, y - 2, piece ) )
				return true;

		if ( test_board.isLegalMove( test_board, x, y, x, y + 2 ) )
			if ( this.path_exists( test_board, x, y + 2, piece ) )
				return true;

		if ( test_board.isLegalMove( test_board, x, y, x - 2, y ) )
			if ( this.path_exists( test_board, x - 2, y, piece ) )
				return true;
		
		if ( test_board.isLegalMove( test_board, x, y, x + 2, y ) )
			if ( this.path_exists( test_board, x + 2, y, piece ) )
				return true;

		return false;
	}
}
