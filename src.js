( function() {
	var canvas;
	var ctx;
	var width = 0;
	var height = 0;

	var distThreshold = 50;						//tolerance for fixing on mPoints
	var analysisThreshold = 10;					//tolerance for grouping of measurePoints
	var settleThreshold = 3;					//aufsummierte bewegung in den letzten 10 moves
	var mult = 3;
	var analysisRadius = distThreshold*1.4;		//radius to search for buddies
	var globalIntervalHandler = false;

	var raster = 40;
	var mPoints = [];
	var points = [];
	var ballungsZentren = {};

	var colors = [ 'rgba(0,0,255,0.4)', 'rgba(255,0,255,0.4)', 'rgba(0,255,255,0.4)', 'rgba(255,0,0,0.4)', 'rgba(0,255,0,0.4)', 'rgba(255,255,0,0.4)' ];

	$(document).ready( function() {
		canvas = $('#haufenCanvas');
		ctx = canvas[0].getContext("2d");
		width = canvas[0].width;
		height = canvas[0].height;

		ctx.fillStyle = 'rgb(0,0,0)';
		ctx.strokeStyle = 'rgb(0,0,0)';
		ctx.beginPath();
		
		$(canvas).click( function(e) {
			var x = e.pageX - this.offsetLeft;
			var y = e.pageY - this.offsetTop;

			points.push( new mPoint( x, y ) );
			redrawPoints();
		} );
		$('#step').click( function() { step( true ); } );
		$('#start').click( function() {
			globalIntervalHandler = window.setInterval( function() {
				if ( !step( true ) ) {
					window.clearInterval( globalIntervalHandler );
					analysis();
					finalize();
				}
			} , 100 );
		} );
		$('#startNoAnim').click( function() {
			while ( step( false ) ) { }
			
			analysis();
			finalize();
		} );
		
		$( 'input[name=raster]' ).val( raster );
		$( 'input[name=distThreshold]' ).val( distThreshold );
		$( 'input[name=settleThreshold]' ).val( settleThreshold );
		$( 'input[name=mult]' ).val( mult );
		$( 'input[name=analysisThreshold]' ).val( analysisThreshold );
		$( 'input[name=analysisRadius]' ).val( analysisRadius );
		
		$('#anwenden').click( function() {
			raster = 			parseInt( $( 'input[name=raster]' ).val() );
			distThreshold = 	parseInt( $( 'input[name=distThreshold]' ).val() );
			settleThreshold = 	parseInt( $( 'input[name=settleThreshold]' ).val() );
			mult = 				parseInt( $( 'input[name=mult]' ).val() );
			analysisThreshold = parseInt( $( 'input[name=analysisThreshold]' ).val() );
			analysisRadius = 	parseInt( $( 'input[name=analysisRadius]' ).val() );
			
			configAnwenden();
		} );
		
		$('#export').click( function() {
			var tmp = {};
			tmp.raster = raster;
			tmp.distThreshold = distThreshold;
			tmp.settleThreshold = settleThreshold;
			tmp.mult = mult;
			tmp.analysisThreshold = analysisThreshold;
			tmp.analysisRadius = analysisRadius;
			tmp.points = points;
			
			$('textarea[name=exportConfig]').val( tmp.toJSONString() );
		} );
		
		$('#load').click( function() {
			var tmp = $('textarea[name=loadConfig]').val();
			tmp = tmp.parseJSON();
			
			raster = tmp.raster;
			distThreshold = tmp.distThreshold;
			settleThreshold = tmp.settleThreshold;
			mult = tmp.mult;
			analysisThreshold = tmp.analysisThreshold;
			analysisRadius = tmp.analysisRadius;
			points = tmp.points;
			
			$( 'input[name=raster]' ).val( raster );
			$( 'input[name=distThreshold]' ).val( distThreshold );
			$( 'input[name=settleThreshold]' ).val( settleThreshold );
			$( 'input[name=mult]' ).val( mult );
			$( 'input[name=analysisThreshold]' ).val( analysisThreshold );
			$( 'input[name=analysisRadius]' ).val( analysisRadius );
			
			configAnwenden();
		} );	
		
		$('#ausb').click( function() {
			clear();
			redrawPoints();
		} );
		
		$('#exportBallen').click( function() {
			var tmpO = [];
			$.each( ballungsZentren, function( k ) {
				if ( !ballungsZentren.hasOwnProperty( k ) ) return;
				
				var tmp = [];
				var z = ballungsZentren[ k ];
				for( var i = 0; i < z.length; i++ ) {
					tmp.push( { "x":z[i].x,"y":z[i].y } );
				}
				tmpO.push( tmp );
			} );
			$('textarea[name=exportBallen]').val( tmpO.toJSONString() );
		} );
		
		deployMPoints();
	} );

	function configAnwenden() {
		ballungsZentren = {};
		deployMPoints();
		clear();
		redrawMPoints();
		redrawPoints();
	}

	function redraw(iPoints,col,size) {
		ctx.beginPath();
		ctx.strokeStyle = col;
		ctx.fillStyle = col;
		for( var i = 0; i < iPoints.length; i++ ) {
			ctx.moveTo(iPoints[i].x,iPoints[i].y);
			ctx.arc(iPoints[i].x, iPoints[i].y, size, 0, Math.PI * 2, true);
		}
		ctx.fill();
	}
	function finalize() {
		clear();
		redrawPoints();
		
		var colorCounter = 0;

		$.each( ballungsZentren, function( k ) {
			if ( !ballungsZentren.hasOwnProperty( k ) ) return;
			
			var z = ballungsZentren[ k ];
			var c = colors[ colorCounter++ % colors.length ];
			ctx.beginPath();
			ctx.strokeStyle = c;
			ctx.fillStyle = c;
			for( var i = 0; i < z.length; i++ ) {
				ctx.moveTo(z[i].x,z[i].y);
				ctx.arc(z[i].x, z[i].y, analysisRadius, 0, Math.PI * 2, true);
			}
			ctx.fill();
		} );
	}
	function redrawPoints() {
		redraw(points,'#000',2);
	}
	function redrawMPoints() {
		redraw(mPoints,'rgba(255,0,0,1)',3);
	}
				
	function clear() {
		ctx.clearRect (0, 0,  width, height);
	}









	function deployMPoints() {
		mPoints = [];
		for( var x = 0; x <= width; x += raster ) {
			for( var y = 0; y <= height; y += raster ) {
				mPoints.push( new mPoint( x, y ) );
			}
		}
	}

	function step( animate ) {
		if ( points.length <= 0 ) {
			alert('null, keine punkte');
			return false;
		}

		var changedAtAll = false;
		var ret;
		var p;
		
		for( var i = 0; i < mPoints.length; i++ ) {
			p = mPoints[i];
			
			if ( ( p.poked && !p.moved ) || p.settled ) {
				continue;
			}
			
			ret = calcMPoint( mPoints[i] );
			if ( ret == 1 ) {
				changedAtAll = true; 
			}
		}
		
		if ( animate ) {
			clear();
			redrawPoints();
			redrawMPoints();
		}
		
		return changedAtAll;
	}
	function calcMPoint( point ) {
		point.poke();

		var vektor = {"x":0,"y":0};
		var distance = 0;
		var impact = 0;
		var hum = false;
		for( var i = 0; i < points.length; i++ ) {
			distance = point.distance( points[i] );
			impact = 0;
			if ( distance <= distThreshold ) {
				uv = point.unitVector( points[i] );
				impact = 1 - ( ( distThreshold - distance ) / distThreshold );
				
				vektor.x = vektor.x - uv.x*impact*mult;
				vektor.y = vektor.y - uv.y*impact*mult;
				
				hum = true;
			}
		}
		if ( hum ) {
			point.setCoords( point.x + vektor.x, point.y + vektor.y );
			return 1;
		} else {
			return -2;
		}
	}









	function analysis() {
		var p;
		var coll = [];
		var found = false;
		
		//gather points that are quite near to each other, they count as one.
		//write into coll
		for( var i = 0; i < mPoints.length; i++ ) {
			found = false;
			p = mPoints[i];
			if ( !p.settled ) continue;

			for( var x = 0; x < coll.length; x++ ) {
				if ( p.distance( coll[x] ) <= analysisThreshold ) {
					coll[x].counter++;
					found = true;
				}
			}
			if ( !found ) {
				coll.push( new mPoint( Math.round( p.x ), Math.round( p.y ), 1 ) );
			}
		}
		
		//we got some centers now.513
		//gather corresponding centers now
		
		for( var i = 0; i < coll.length; i++ ) {
			if ( coll[i].groupToken == "" ) {
				coll[i].groupToken = i;
				analysis_searchBuddies( coll, coll[i] );
			}
		}

		for( var i = 0; i < coll.length; i++ ) {
			if ( !ballungsZentren[ coll[i].groupToken ] ) {
				ballungsZentren[ coll[i].groupToken ] = [];
			}
			ballungsZentren[ coll[i].groupToken ].push( coll[i] );
		}
	}



	function analysis_searchBuddies( points, point ) {
		for( var i = 0; i < points.length; i++ ) {
			if ( point.distance( points[i] ) < analysisRadius && points[i].groupToken != point.groupToken ) {
				points[i].groupToken = point.groupToken;
				analysis_searchBuddies( points, points[i] );
			}
		}
	}










	function mPoint( x, y, c, t ) {
		if ( !c ) c = 0;
		if ( !t ) t = '';

		this.x = x;
		this.y = y;
		this.counter = c;
		this.groupToken = t;
		
		this.settled = false;
		this.poked = false;
		this.moved = false;
		
		this.history = [ {"x":9999,"y":9999},{"x":9999,"y":9999},{"x":9999,"y":9999},{"x":9999,"y":9999},{"x":9999,"y":9999},{"x":9999,"y":9999},{"x":9999,"y":9999},{"x":9999,"y":9999},{"x":9999,"y":9999},{"x":9999,"y":9999} ];
		this.historyC = 0;
		
		this.vector = function ( point ) {
			return { "x": this.x-point.x, "y": this.y-point.y };
		}
		
		this.distance = function( point ) {
			var d = this.vector( point );
			return Math.sqrt( Math.pow( d.x, 2 ) + Math.pow( d.y, 2 ) );
		}
		
		this.unitVector = function( point ) {
			var d = this.vector( point );
			var distance = this.distance( point );

			if ( distance == 0 ) {
				return { "x": 0, "y": 0 };
			}
			
			return { "x": d.x/distance, "y": d.y/distance };
		}
		
		this.setCoords = function( x, y ) {
			var v = this.vector( new mPoint( x, y ) );
			this.history[ this.historyC++ % this.history.length ] = v;

			if ( Math.abs( this.getHistoryMovement() ) < settleThreshold ) {
				this.settled = true;
			} else {
				this.moved = true;
				this.x = x;
				this.y = y;
			}
		}
		
		this.poke = function() {
			this.poked = true;
		}
		
		this.getHistoryMovement = function() {
			var x = 0;
			var y = 0;
			for( var i = 0; i < this.history.length; i++ ) {
				x += this.history[ i ].x;
				y += this.history[ i ].y;
			}
			
			return ( new mPoint(0,0).distance( new mPoint(x,y) ) );
		}
	}
}());