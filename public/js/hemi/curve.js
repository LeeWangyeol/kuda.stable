/* 
 * Kuda includes a library and editor for authoring interactive 3D content for the web.
 * Copyright (C) 2011 SRI International.
 *
 * This program is free software; you can redistribute it and/or modify it under the terms
 * of the GNU General Public License as published by the Free Software Foundation; either 
 * version 2 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; 
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program; 
 * if not, write to the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, 
 * Boston, MA 02110-1301 USA.
 */

/**
 * @fileoverview This describes the objects needed to build the hemi particle
 *		effects: Bezier curves, particles which can follow those curves, and
 *		systems to manage particles and emitters. 
 */
o3djs.require('hemi.core');

var hemi = (function(hemi) {
	/**
	 * @namespace A module for curves and particle systems.
	 */
	hemi.curve = hemi.curve || {};

	/**
	 * Enum for different curve types, described below.
	 * <ul><pre>
	 * <li>hemi.curve.curveType.Linear
	 * <li>hemi.curve.curveType.Bezier
	 * <li>hemi.curve.curveType.CubicHermite
	 * <li>hemi.curve.curveType.LinearNorm
	 * <li>hemi.curve.curveType.Cardinal
	 * <li>hemi.curve.curveType.Custom
	 * </ul></pre>
	 */
	hemi.curve.curveType = {
		Linear : 0,
		Bezier : 1,
		CubicHermite : 2,
		LinearNorm : 3,
		Cardinal : 4,
		Custom : 5
	};
	
	/**
	 * Predefined values for common shapes.
	 * <ul><pre>
	 * <li>hemi.curve.shapeType.CUBE
	 * <li>hemi.curve.shapeType.SPHERE
	 * <li>hemi.curve.shapeType.ARROW
	 * </ul></pre>
	 */
	hemi.curve.shapeType = {
		CUBE : 'cube',
		SPHERE : 'sphere',
		ARROW : 'arrow'
	};

	/**
	 * Caculate the cubic hermite interpolation between two points with associated
	 * 		tangents.
	 *
	 * @param {number} t Time, between 0 and 1
	 * @param {number[]} p0 The first waypoint
	 * @param {number[]} m0 The tangent through the first waypoint
	 * @param {number[]} p1 The second waypoint
	 * @param {number[]} m1 The tangent through the second waypoint
	 */
	hemi.curve.cubicHermite = function(t,p0,m0,p1,m1) {;
		var tp0 = 2*t*t*t - 3*t*t + 1;
		var tm0 = t*t*t - 2*t*t + t;
		var tp1 = -2*t*t*t + 3*t*t;
		var tm1 = t*t*t - t*t;
		return tp0*p0 + tm0*m0 + tp1*p1 + tm1*m1;
	};
	
	/**
	 * Simple factorial function.
	 *
	 * @param {number} n Number to factorialize
	 * @return {number} n!
	 */
	hemi.curve.factorial = function(n) {
		var f = 1;
		for(var x = 2; x <= n; x++) {
			f = f*x;
		}
		return f;
	};
	
	/** 
	 * Simple choose function
	 *
	 * @param {number} n Top of choose input, n
	 * @param {number} m Bottom of choose input, m
	 * @return {number} Choose output, (n!)/(m!(n-m)!)
	 */
	hemi.curve.choose = function(n,m) {
		return hemi.curve.factorial(n)/
			   (hemi.curve.factorial(m)*hemi.curve.factorial(n-m));
	};

	/**
	 * Render a 3D representation of a curve.
	 *
	 * @param {number[][]} points Array of points (not waypoints)
	 * @param {hemi.config} config Configuration describing how the curve should look
	 */
	hemi.curve.drawCurve = function(points,config) {
		var jshow = (config.joints == null) ? true : config.joints;
		var jsize = config.jointSize || 10;
		var jcolor = config.jointColor || [1,1,0,1];
		var eshow = (config.edges == null) ? true : config.edges;
		var esize = config.edgeSize || 2;
		var ecolor = config.edgeColor || [0.5,0,0,1];
		var ballMat = o3djs.material.createBasicMaterial(hemi.core.mainPack,hemi.view.viewInfo,jcolor);
		var param = ballMat.getParam('lightWorldPos'); 
		if(param) {
			param.bind(hemi.world.camera.light.position);
		}
		var mainTransform = hemi.core.mainPack.createObject('Transform');
		mainTransform.parent = hemi.core.client.root;
		for (var i = 0; i < points.length; i++) {
			if(jshow) {
				var transform = hemi.core.mainPack.createObject('Transform');
				transform.parent = mainTransform;
				var joint = o3djs.primitives.createSphere(hemi.core.mainPack,ballMat,jsize,20,20);
				transform.addShape(joint);
				transform.translate(points[i]);
			}
			if (i < (points.length - 1) && eshow) {
				this.drawLine(points[i],points[i+1],mainTransform,esize,ecolor);
			}
		}
		return mainTransform;
	};
	
	/**
	 * Draw a line connecting two points.
	 *
	 * @param {number[]} p0 The first point
	 * @param {number[]} p1 The second point
	 * @param {number} opt_size Thickness of the line
	 * @param {number[]} opt_color Color of the line
	 */
	hemi.curve.drawLine = function(p0,p1,pTrans,opt_size,opt_color) {
		var size = opt_size || 2;
		var color = opt_color || [0.5,0,0,1];
		var lineMat = o3djs.material.createBasicMaterial(hemi.core.mainPack,hemi.view.viewInfo,color);
		var param = lineMat.getParam('lightWorldPos'); 
		if(param) {
			param.bind(hemi.world.camera.light.position);
		}
		var dist = o3djs.math.distance(p0,p1);
		var midpoint = [ (p0[0]+p1[0])/2, (p0[1]+p1[1])/2, (p0[2]+p1[2])/2 ];
		var line = o3djs.primitives.createCylinder(hemi.core.mainPack,lineMat,size,dist,3,1);
		var transform = hemi.core.mainPack.createObject('Transform');
		transform.parent = pTrans;
		transform.addShape(line);
		transform.translate(midpoint);
		transform = this.pointYAt(transform,midpoint,p0);
	};
	
	/**
	 * Point the y-up axis toward a given point
	 *
	 * @param {o3d.transform} t Transform to rotate
	 * @param {number[]} mp Point from which to look (may be origin)
	 * @param {number[]} p0 Point at which to aim the y axis
	 * @return {o3d.transform} The rotated transform
	 */
	hemi.curve.pointYAt = function(t,mp,p0) {
		var dx = p0[0] - mp[0];
		var dy = p0[1] - mp[1];
		var dz = p0[2] - mp[2];
		var dxz = Math.sqrt(dx*dx + dz*dz);
		var rotY = Math.atan2(dx,dz);
		var rotX = Math.atan2(dxz,dy);
		
		t.rotateY(rotY);
		t.rotateX(rotX);
		
		return t;
	};
	
	/**
	 * Generate a random point within a bounding box
	 *
	 * @param {number[]} min Minimum point of the bounding box
	 * @param {number[]} max Maximum point of the bounding box
	 * @param {function(number): number} opt_distribution Optional distribution function 
	 *		(linear by default}(not yet implemented)
	 * @return {number[]} Randomly generated point
	 */
	hemi.curve.randomPoint = function(min,max,opt_distribution) {
		var xi = Math.random();
		var yi = Math.random();
		var zi = Math.random();
		var x = xi*min[0] + (1-xi)*max[0];
		var y = yi*min[1] + (1-yi)*max[1];
		var z = zi*min[2] + (1-zi)*max[2];
		return [x,y,z];
	};
		
	/**
	 * Render the bounding boxes which the curves run through, mostly for
	 * 		debugging purposes.
	 */
	hemi.curve.showBoxes = function(system) {
		var boxes = system.boxes,
			pack = hemi.core.mainPack;
		
		if (this.dbgBoxTransforms.length > 0) {
			this.hideBoxes();
		}
		
		for (i = 0; i < boxes.length; i++) {
			var transform = pack.createObject('Transform'),
				b = boxes[i],
				w = b[1][0] - b[0][0],
				h = b[1][1] - b[0][1],
				d = b[1][2] - b[0][2],
				x = b[0][0] + w/2,
				y = b[0][1] + h/2,
				z = b[0][2] + d/2,
				box = o3djs.primitives.createBox(pack, this.dbgBoxMat, w, h, d);
			
			transform.addShape(box);
			transform.translate(x,y,z);
			transform.parent = system.transform;
			this.dbgBoxTransforms[i] = transform;
		}
	};
	
	/**
	 * Remove the bounding boxes from view.
	 */
	hemi.curve.hideBoxes = function() {
		var pack = hemi.core.mainPack;
		
		for (i = 0; i < this.dbgBoxTransforms.length; i++) {
			var tran = this.dbgBoxTransforms[i],
				shape = tran.shapes[0];
			
			tran.removeShape(shape);
			tran.parent = null;
			pack.removeObject(shape);
			pack.removeObject(tran);
		}
		
		this.dbgBoxTransforms = [];
	};
	
	hemi.curve.init = function() {
		this.dbgBoxMat = hemi.core.material.createConstantMaterial(
			hemi.core.mainPack,
			hemi.view.viewInfo,
			[0, 0, 0.5, 1]);
		
		var state = hemi.core.mainPack.createObject('State');
		state.getStateParam('PolygonOffset2').value = -1.0;
		state.getStateParam('FillMode').value = hemi.core.o3d.State.WIREFRAME;
		this.dbgBoxMat.state = state;
		this.dbgBoxTransforms = [];
	};

	/**
	 * @class A Curve is used to represent and calculate different curves
	 * including: linear, bezier, cardinal, and cubic hermite.
	 * 
	 * @param {number[][]} points List of xyz waypoints 
	 * @param {number} opt_type Curve type
	 * @param {hemi.config} opt_config Configuration object specific to this curve
	 */
	hemi.curve.Curve = function(points,opt_type,opt_config) {

		this.type = opt_type || hemi.curve.curveType.Linear;
		this.xpts = {};		
		this.ypts = {};
		this.zpts = {};
		this.xtans = {};
		this.ytans = {};
		this.ztans = {};
		this.weights = {};
		this.tension = 0;
		this.count = points.length;

		for (var i = 0; i < this.count; i++) {
			this.xpts[i] = points[i][0];
			this.ypts[i] = points[i][1];
			this.zpts[i] = points[i][2];
			this.xtans[i] = 0;
			this.ytans[i] = 0;
			this.ztans[i] = 0;
			this.weights[i] = 1;
		}

		switch (this.type) {
			case hemi.curve.curveType.Linear:
				this.interpolate = this.linear;
				break;
			case hemi.curve.curveType.Bezier:
				this.interpolate = this.bezier;
				break;
			case hemi.curve.curveType.CubicHermite:
			case hemi.curve.curveType.Cardinal:
				this.interpolate = this.cubicHermite;
				break;
			case hemi.curve.curveType.LinearNorm:
				this.interpolate = this.linearNorm;
				break;
			case hemi.curve.curveType.Custom:
				break;
			default:
		}
		
		if (opt_config) {
			if (opt_config.weights) {
				for (var i = 0; i < this.count; i++) {
					this.weights[i] = (opt_config.weights[i] != null) ? opt_config.weights[i] : 1;
				}
			}
			
			if (opt_config.tangents) {
				for (var i = 0; i < this.count; i++) {
					if(opt_config.tangents[i]) {
						this.xtans[i] = opt_config.tangents[i][0] || 0;
						this.ytans[i] = opt_config.tangents[i][1] || 0;
						this.ztans[i] = opt_config.tangents[i][2] || 0;
					}	
				}
			}
			
			if(opt_config.tension) {
				this.tension = opt_config.tension;
			}
		}
		
		this.setTangents();
	};

	hemi.curve.Curve.prototype = {
		
		/**
		 * Base interpolation function for this curve. Usually overwritten.
		 *
		 * @param {number} t Time, usually between 0 and 1
		 * @return {number[]} The position interpolated from the time input
		 */
		interpolate : function(t) {
			return [t,t,t];
		},

		/**
		 * The linear interpolation moves on a straight line between waypoints.
		 *
		 * @param {number} t Time, usually between 0 and 1
		 * @return {number[]} The position linearly interpolated from the time input
		 */
		linear : function(t) {
			var n = this.count - 1;
			var ndx = Math.floor(t*n);
			if (ndx >= n) ndx = n-1;
			var tt = (t-ndx/n)/((ndx+1)/n-ndx/n);
			var x = (1-tt)*this.xpts[ndx] + tt*this.xpts[ndx+1];
			var y = (1-tt)*this.ypts[ndx] + tt*this.ypts[ndx+1];
			var z = (1-tt)*this.zpts[ndx] + tt*this.zpts[ndx+1];
			return [x,y,z];
		},

		/**
		 * The bezier interpolation starts at the first waypoint, and ends at the
		 *		last waypoint, and 'bends' toward the intermediate points. These
		 *		points can be weighted for more bending.
		 *
		 * @param {number} t Time, usually between 0 and 1
		 * @return {number[]} The position interpolated from the time input by a
		 *		a bezier function.
		 */
		bezier : function(t) {
			var x = 0;
			var y = 0;
			var z = 0;
			var w = 0;
			var n = this.count;
			for(var i = 0; i < n; i++) {
				var fac = this.weights[i]*
				          hemi.curve.choose(n-1,i)*
					      Math.pow(t,i)*
						  Math.pow((1-t),(n-1-i));
				x += fac*this.xpts[i];
				y += fac*this.ypts[i];
				z += fac*this.zpts[i];
				w += fac; 
			}
			return [x/w,y/w,z/w];
		},

		/**
		 * The cubic hermite function interpolates along a line that runs through the Curve
		 *		object's waypoints, at a predefined tangent slope through each one.
		 *
		 * @param {number} t Time, usually between 0 and 1
		 * @return {number[]} The position interpolated from the time input by the cubic 
		 *		hermite function.
		 */		
		cubicHermite : function(t) {
			var n = this.count - 1;
			var ndx = Math.floor(t*n);
			if (ndx >= n) ndx = n-1;
			var tt = (t-ndx/n)/((ndx+1)/n-ndx/n);
			var x = hemi.curve.cubicHermite(tt,this.xpts[ndx],this.xtans[ndx],this.xpts[ndx+1],this.xtans[ndx+1]);
			var y = hemi.curve.cubicHermite(tt,this.ypts[ndx],this.ytans[ndx],this.ypts[ndx+1],this.ytans[ndx+1]);
			var z = hemi.curve.cubicHermite(tt,this.zpts[ndx],this.ztans[ndx],this.zpts[ndx+1],this.ztans[ndx+1]);
			return [x,y,z];
		},
		
		/**
		 * The normalized linear interpolation moves on a straight line between waypoints,
		 *		at a constant velocity.
		 *
		 * @param {number} t Time, usually between 0 and 1
		 * @return {number[]} The position linearly interpolated from the time input, normalized
		 * 		to keep the velocity constant
		 */
		linearNorm : function(t) {
			var d = 0;
			var dpts = [];
			dpts[0] = 0;
			for(var i = 1; i < this.count; i++) {
				d += hemi.core.math.distance([this.xpts[i-1],this.ypts[i-1],this.zpts[i-1]],
											 [this.xpts[i],this.ypts[i],this.zpts[i]]);
				dpts[i] = d;
			}
			var tt = t*d;
			var ndx = 0;
			for(var i = 0; i < this.count; i++) {
				if(dpts[i] < tt) ndx = i; 
			}
			var lt = (tt - dpts[ndx])/(dpts[ndx+1] - dpts[ndx]);
			var x = (1-lt)*this.xpts[ndx] + lt*this.xpts[ndx+1];
			var y = (1-lt)*this.ypts[ndx] + lt*this.ypts[ndx+1];
			var z = (1-lt)*this.zpts[ndx] + lt*this.zpts[ndx+1];			
			return [x,y,z];
		},
		
		/**
		 * Build the vector to represent the tangent through a point on this Curve.
		 *
		 * @param {number} t Time, usually between 0 and 1
		 * @return {number[]} Vector tangent, i.e. the velocity and direction of the 
		 *		curve through this point
		 */
		tangent : function(t) {
			var t0 = this.interpolate(t-0.001);
			var t1 = this.interpolate(t+0.001);
			return [t1[0]-t0[0],t1[1]-t0[1],t1[2]-t0[2]];
		},
		
		/**
		 * Calculate the tangents for a cardinal curve, which is a cubic hermite curve
		 * 		where the tangents are defined by a single 'tension' factor.
		 */
		setTangents : function() {
			if (this.type == hemi.curve.curveType.Cardinal) {
				for (var i = 0; i < this.count - 2; i++) {
					this.xtans[i] = (1-this.tension)*(this.xpts[i+2]-this.xpts[i])/2;
					this.ytans[i] = (1-this.tension)*(this.ypts[i+2]-this.ypts[i])/2;
					this.ztans[i] = (1-this.tension)*(this.zpts[i+2]-this.zpts[i])/2;
					this.xpts[i] = this.xpts[i+1];
					this.ypts[i] = this.ypts[i+1];
					this.zpts[i] = this.zpts[i+1];
				}
				this.count = this.count - 2;
			}
		},
		
		getStart : function() {
			return [this.xpts[0],this.ypts[0],this.zpts[0]];
		},
		
		getEnd : function() {
			var end = this.xpts.length - 1;
			return [this.xpts[end],this.ypts[end],this.zpts[end]];
		},
		
		draw : function(samples,config) {
			var points = [];
			for (var i = 0; i < samples+2; i++) {
				points[i] = this.interpolate(i/(samples+1));
			}
			return hemi.curve.drawCurve(points,config);
		}
		
	};
	
	/**
	 * @class A Particle allows for the movement of a transform along a set of
	 * points.
	 * 
	 * @param {o3d.transform} trans The transform to move along the curve
	 * @param {number[][]} points The array of points to travel through
	 * @param {hemi.curve.colorKey[]} colorKeys Array of key-values for the 
	 *		color of the default material
	 * @param {hemi.curve.scaleKey[]} scaleKeys Array of key-values for the 
	 *		scale of the transform
	 * @param {boolean} rotate flag indicating if the transform should rotate as
	 *      it travels along the points
	 */
	hemi.curve.Particle = function(trans,points,colorKeys,scaleKeys,rotate) {	
		var pack = hemi.core.mainPack;
		this.transform = pack.createObject('Transform');
		this.transform.parent = trans;
		this.frame = 1;
		this.lastFrame = points.length - 2;
		this.destroyed = false;
        this.transform.createParam('diffuse', 'ParamFloat4').value = [0,0,0,0];		
		this.lt = [];		
		this.setColors(colorKeys);
		this.setScales(scaleKeys);	
		for (var i = this.frame; i <= this.lastFrame; i++) {
			var L = o3djs.math.matrix4.translation(points[i]);
			
			if (rotate) {
				var dx = points[i+1][0] - points[i-1][0];
				var dy = points[i+1][1] - points[i-1][1];
				var dz = points[i+1][2] - points[i-1][2];
				var dxz = Math.sqrt(dx*dx + dz*dz);
				var rotY = Math.atan2(dx,dz);
				var rotX = Math.atan2(dxz,dy);
				L = o3djs.math.matrix4.rotateY(L,rotY);
				L = o3djs.math.matrix4.rotateX(L,rotX);
			}
			this.lt[i] = L;
		}
		this.ready = true;
		this.active = false;
	};
	
	hemi.curve.Particle.prototype = {
	
		/**
		 * Start this particle along the curve.
		 *
		 * @param {number} loops The number of loops to do
		 */
		run : function(loops) {
			this.loops = loops;
			this.ready = false;
			this.active = true;
		},
	
		/**
		 * Add a shape to the particle transform.
		 *
		 * @param {o3d.shape} shape The shape to add
		 */
		addShape : function(shape) {
			this.transform.addShape(shape);
		},
		
		/**
		 * Remove all shapes from the particle transform.
		 */
		removeShapes : function() {
			for (var i = this.transform.shapes.length - 1; i >=0; i--) {
				this.transform.removeShape(this.transform.shapes[i]);
			}
		},
		
		/**
		 * Set the color gradient of this particle.
		 * @param {key[]} colorKeys Array of color key pairs
		 */
		setColors : function(colorKeys) {
			this.colors = [];
			if(colorKeys) {
				this.colorKeys = [];
				for (var i = 0; i < colorKeys.length; i++) {
					var p = {};
					var c = colorKeys[i];
					p.key = c.key;
					if (c.range) {
						p.value = [];
						if (typeof c.range == 'number') {
							var offset = (Math.random()-0.5)*2*c.range;
							for (var j = 0; j < c.value.length; j++) {
								p.value[j] = c.value[j] + offset;
							}
						} else {
							for (var j = 0; j < c.value.length; j++) {
								p.value[j] = c.value[j] + (Math.random()-0.5)*2*c.range[j];
							}
						}
					} else {
						p.value = c.value;
					}
					this.colorKeys[i] = p;
				}
			} else {
				this.colorKeys = [
					{key:0,value:[0,0,0,1]},
					{key:1,value:[0,0,0,1]}
					];
			}
			for (var i = 1; i <= this.lastFrame; i++) {		
				var time = (i-1)/(this.lastFrame-2);				
				this.colors[i] = this.lerpValue(time,this.colorKeys);			
			}
			return this;
		},
		
		/**
		 * Set the scale gradient of this particle.
		 * @param {key[]} scaleKeys Array of scale key pairs
		 */
		setScales : function(scaleKeys) {
			this.scales = [];
			if(scaleKeys) {
				var sKeys = [];
				for (i = 0; i < scaleKeys.length; i++) {
					var p = {};
					var c = scaleKeys[i];
					p.key = c.key;
					if (c.range) {
						p.value = [];
						if (typeof c.range == 'number') {
							var offset = (Math.random()-0.5)*2*c.range;
							for (var j = 0; j < c.value.length; j++) {
								p.value[j] = c.value[j] + offset;
							}
						} else {
							for (var j = 0; j < c.value.length; j++) {
								p.value[j] = c.value[j] + (Math.random()-0.5)*2*c.range[j];
							}
						}
					} else {
						p.value = c.value;
					}
					sKeys[i] = p;
				}
			} else {
				sKeys = [
					{key:0,value:[1,1,1]},
					{key:1,value:[1,1,1]}
				];
			}
			for (var i = 1; i <= this.lastFrame; i++) {		
				var time = (i-1)/(this.lastFrame-2);				
				this.scales[i] = this.lerpValue(time,sKeys);				
			}	
			return this;
		},
	
		/**
		 * Translate the particle transform in local space.
		 *
		 * @param {number} x X translation
		 * @param {number} y Y translation
		 * @param {number} z Z translation
		 */
		translate : function(x,y,z) {
			this.transform.translate(x,y,z);
		},
		
		/**
		 * Given a set of key-values, return the interpolated value
		 *
		 * @param {number} time Time, from 0 to 1
		 * @param {hemi.curve.Key[]} keySet Array of key-value pairs
		 * @return {number[]} The interpolated value
		 */
		lerpValue : function(time,keySet) {
			var ndx = keySet.length - 2;
			while(keySet[ndx].key > time) {
				ndx--;
			}
			var t = (time - keySet[ndx].key)/(keySet[ndx+1].key - keySet[ndx].key);
			return o3djs.math.lerpVector(keySet[ndx].value,keySet[ndx+1].value,t);
		},
		
		/**
		 * Update the particle (called on each render).
		 */
		update : function() {
			if (!this.active) return;				
			var color = this.colors[this.frame];
			var scale = this.scales[this.frame];		
			this.transform.getParam('diffuse').value = color;
			var f = this.frame;
			this.transform.localMatrix = hemi.utils.copyArray(this.lt[f]);
			this.transform.scale(scale);		
			this.frame++;
			this.transform.visible = true;
			if(this.frame >= this.lastFrame) {
				this.frame = 1;
				this.loops--;
				if(this.loops == 0) this.reset();
			}
		},
		
		/**
		 * Destroy this particle and all references to it.
		 */
		destroy : function() {
			if(this.destroyed) return;
			var t = this.transform;
			for(var i = (t.shapes.length-1); i >= 0; i--) {
				t.removeShape(t.shapes[i]);
			}
			hemi.core.mainPack.removeObject(t);
			this.transform = null;
			this.curve = null;
			this.destroyed = true;
		},
		
		/**
		 * Reset this particle.
		 */
		reset : function() {
			this.transform.visible = false;
			this.loops = this.totalLoops;
			this.destroyed = false;
			this.active = false;
			this.ready = true;
		}
	
	};
	
	/**
	 * @class A ParticleSystem manages a set of Particle objects, and fires
	 * them at the appropriate intervals.
	 * 
	 * @param {o3d.transform} trans The transform which will be the parent of this system
	 * @param {hemi.config} config Configuration object describing this system
	 */
	hemi.curve.ParticleSystem = function(trans,config) {
		var pack = hemi.core.mainPack;
		var view = hemi.view.viewInfo;
		this.transform = pack.createObject('Transform');
		this.transform.parent = trans;
		this.active = false;
		this.pRate = config.rate || 5;
		this.maxRate = this.pRate;
		this.pLife = config.life || 5;
		this.boxes = config.boxes;
		this.maxParticles = this.pRate * this.pLife;
		this.particles = [];
		this.pTimer = 0.0;
		this.pIndex = 0;
		
		var shapeColor = [1,0,0,1];
		this.shapeMaterial = o3djs.material.createBasicMaterial(pack,view,shapeColor,true);
		var param = this.shapeMaterial.getParam('lightWorldPos'); 
		if(param) {
			param.bind(hemi.world.camera.light.position);
		}

		var mState = pack.createObject('State');
				// Use these when we figure out how...
		//mState.getStateParam('o3d.BlendEquation').value = hemi.core.o3d.State.BLEND_ADD;
		//mState.getStateParam('o3d.SourceBlendFunction').value = hemi.core.o3d.State.BLENDFUNC_SOURCE_ALPHA;
		//mState.getStateParam('o3d.DestinationBlendFunction').value = hemi.core.o3d.State.BLENDFUNC_ONE;		
		this.shapeMaterial.state = mState;
		
		this.shapes = [];
		
		if (config.shape) {
			switch (config.shape) {
				case (hemi.curve.shapeType.ARROW):
					var arrowHeadXY = [[-0.4,0],[0.4,0],[0,0.6]];
					var arrowBaseXY = [[-0.2,0],[-0.2,-0.4],[0.2,-0.4],[0.2,0]];
					this.shapes.push(o3djs.primitives.createPrism(pack,this.shapeMaterial,arrowHeadXY,0.2));
					this.shapes.push(o3djs.primitives.createPrism(pack,this.shapeMaterial,arrowBaseXY,0.2));
					break;
				case (hemi.curve.shapeType.SPHERE):
					this.shapes.push(o3djs.primitives.createSphere(pack,this.shapeMaterial,0.5,12,12));
					break;
				case (hemi.curve.shapeType.CUBE):
					this.shapes.push(o3djs.primitives.createCube(pack,this.shapeMaterial,1));
					break;
				default:
					break;
			}
		} else {
			this.shapes.push(o3djs.primitives.createSphere(pack,this.shapeMaterial,0.5,12,12));
		}
		
		hemi.view.addRenderListener(this);
		
		this.boxesOn = false;
		
		this.points = [];
		this.frames = config.frames || this.pLife*hemi.view.FPS;
		
		for(j = 0; j < this.maxParticles; j++) {
			var curve = this.newCurve();
			this.points[j] = [];
			for(i=0; i < this.frames; i++) {
				this.points[j][i] = curve.interpolate((i)/this.frames);
			}
		}
		
		for (i = 0; i < this.maxParticles; i++) {
			this.particles[i] = new hemi.curve.Particle(
				this.transform,
				this.points[i],
				config.colorKeys,
				config.scaleKeys,
				config.aim);
			for (var j = 0; j < this.shapes.length; j++) {
				this.particles[i].addShape(this.shapes[j]);
			}
		}
	};
	
	hemi.curve.ParticleSystem.prototype = {
		
		/**
		 * Start the system.
		 */
		start : function() {
			this.active = true;
		},
		
		/**
		 * Stop the system.
		 *
		 * @param {boolean} opt_hard If true, remove all particles immediately. Otherwise,
		 *		stop emitting but let existing particles finish.
		 */
		stop : function(opt_hard) {
			this.active = false;
			if(opt_hard) {
				// Destroy All Particles
				for(i = 0; i < this.maxParticles; i++) {
					if(this.particles[i] != null) {
						this.particles[i].reset();
					}
				}
			}
		},
		
		/**
		 * Function performed on each render. Update all existing particles, and emit
		 * 		new ones if needed.
		 *
		 * @param {o3d.renderEvent} event Event object describing details of the render loop
		 */
		onRender : function(event) {
			for(i = 0; i < this.maxParticles; i++) {
				if(this.particles[i] != null) {
					this.particles[i].update(event);
				}
			}
			if(!this.active) return;
			this.pTimer += event.elapsedTime;
			if(this.pTimer >= (1.0/this.pRate)) {
				this.pTimer = 0;
				var p = this.particles[this.pIndex];
				if (p.ready) p.run(1);
				this.pIndex++;
				if(this.pIndex >= this.maxParticles) this.pIndex = 0;
			}
		},
		
		/**
		 * Generate a new curve running through the system's bounding boxes.
		 *
		 * @return {hemi.curve.Curve} The randomly generated Curve object.
		 */
		newCurve : function() {
			var points = [];
			var num = this.boxes.length;
			for (i = 0; i < num; i++) {
				var min = this.boxes[i][0];
				var max = this.boxes[i][1];
				points[i+1] = hemi.curve.randomPoint(min,max);
			}
			points[0] = points[1].slice(0,3);
			points[num+1] = points[num].slice(0,3);
			var curve = new hemi.curve.Curve(points,hemi.curve.curveType.Cardinal);
			return curve;
		},
		
		/**
		 * Remove all shapes from all particles in the system.
		 */
		removeShapes : function() {
			for (var i = 0; i < this.maxParticles; i++) {
				this.particles[i].removeShapes();
			}
			this.shapes = [];
		},
		
		/**
		 * Add a shape which will be added to the transform of every particle.
		 *
		 * @param {number|o3d.shape} shape Either an enum for standard shapes, or a custom
		 * 		predefined shape to add
		 */
		addShape : function(shape) {
			var pack = hemi.core.mainPack;
			var startndx = this.shapes.length;
			if (typeof shape == 'string') {
				switch (shape) {
					case (hemi.curve.shapeType.ARROW):
						var arrowHeadXY = [[-0.4,0],[0.4,0],[0,0.6]];
						var arrowBaseXY = [[-0.2,0],[-0.2,-0.4],[0.2,-0.4],[0.2,0]];
						this.shapes.push(o3djs.primitives.createPrism(pack,this.shapeMaterial,arrowHeadXY,0.2));
						this.shapes.push(o3djs.primitives.createPrism(pack,this.shapeMaterial,arrowBaseXY,0.2));
						break;
					case (hemi.curve.shapeType.CUBE):
						this.shapes.push(o3djs.primitives.createCube(pack,this.shapeMaterial,1));
						break;
					case (hemi.curve.shapeType.SPHERE):
					default:
						this.shapes.push(o3djs.primitives.createSphere(pack,this.shapeMaterial,0.5,12,12));
						break;
				}
			} else {
				this.shapes.push(shape);
			}
			for (i = 0; i < this.maxParticles; i++) {
				for (var j = startndx; j < this.shapes.length; j++) {
					this.particles[i].addShape(this.shapes[j]);
				}
			}
		},
		
		/**
		 * Change the rate at which particles are emitted.
		 *
		 * @param {number} delta The delta by which to change the rate
		 * @return {number} The new rate
		 */
		changeRate : function(delta) {
			this.setRate(this.pRate + delta);
			return this.pRate;
		},
		
		/**
		 * Set the emit rate of the system.
		 *
		 * @param (number) rate The rate at which to emit particles
		 * @return (number) The new rate - may be different because of bounds
		 */
		setRate : function(rate) {
			var newRate = rate;
			if (newRate > this.maxRate) {
				newRate = this.maxRate;
			}
			if (newRate <= 0) {
				this.pRate = 0;
				this.stop();
				return;
			}
			if (this.pRate == 0 && newRate > 0) {
				this.start();
			}
			this.pRate = newRate;
			return this.pRate;
		},
		
		/**
		 * Set the color gradient for this particle system.
		 * @param {key[]} colorKeys Array of color key pairs
		 * @return {hemi.curve.ParticleSystem} This system, for chaining
		 */
		setColors : function(colorKeys) {
			for (var i = 0; i < this.maxParticles; i++) {
				this.particles[i].setColors(colorKeys);
			}
			return this;
		},

		/**
		 * Set the scale gradient for this particle system.
		 * @param {key[]} scaleKeys Array of scale key pairs
		 * @return {hemi.curve.ParticleSystem} This system, for chaining
		 */		
		setScales : function(scaleKeys) {
			for (var i = 0; i < this.maxParticles; i++) {
				this.particles[i].setScales(scaleKeys);
			}
			return this;
		}
	};
	
	// START GPU PARTICLE SYSTEM
	
	hemi.curve.vertHeader =
		'uniform float ptcTime; \n' +
		'uniform float ptcMaxTime; \n' +
		'uniform float ptcDec; \n' +
		'uniform float numPtcs; \n' +
		'uniform vec3 minXYZ[NUM_BOXES]; \n' +
		'uniform vec3 maxXYZ[NUM_BOXES]; \n' +
		'attribute vec4 TEXCOORD; \n' +
		'varying float ptcVis; \n' +
		'\n' +
		'float rand(vec2 co) { \n' +
		'  return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453); \n' +
		'} \n' +
		'\n' +
		'vec3 randXYZ(vec2 co, vec3 min, vec3 max) { \n' +
		'  float rX = rand(vec2(co.x, co.x)); \n' +
		'  float rY = rand(vec2(co.y, co.y)); \n' +
		'  float rZ = rand(co); \n' +
		'  return vec3(rX*min[0] + (1.0-rX)*max[0], \n' +
		'              rY*min[1] + (1.0-rY)*max[1], \n' +
		'              rZ*min[2] + (1.0-rZ)*max[2]); \n' +
		'} \n' +
		'\n' +
		'vec3 ptcInterp(float t, vec3 p0, vec3 p1, vec3 m0, vec3 m1) { \n' +
		'  float t2 = t*t; \n' +
		'  float t3 = t2*t; \n' +
		'  return (2.0*t3 - 3.0*t2 + 1.0)*p0 + (t3 -2.0*t2 + t)*m0 + \n' +
		'   (-2.0*t3 + 3.0*t2)*p1 + (t3-t2)*m1; \n' +
		'} \n' +
		'\n' +
		'vec4 getPtcPos() { \n' +
		'  float pLen = float(NUM_BOXES-1); \n' +
		'  float id = TEXCOORD[0]; \n' +
		'  float offset = TEXCOORD[1]; \n' +
		'  vec2 seed = vec2(id, numPtcs-id); \n' +
		'  float vecTime = ptcTime + offset; \n' +
		'  if (vecTime > ptcMaxTime) { \n' +
		'    vecTime -= ptcDec; \n' +
		'  } \n' +
		'  if (vecTime > 1.0) { \n' +
		'    ptcVis = -1.0; \n' +
		'    vecTime = 0.0; \n' +
		'  } else { \n' +
		'    ptcVis = 1.0; \n' +
		'  } \n' +
		'  int ndx = int(floor(pLen*vecTime)); \n' +
		'  vec3 p0 = randXYZ(seed,minXYZ[ndx],maxXYZ[ndx]); \n' +
		'  vec3 p1 = randXYZ(seed,minXYZ[ndx+1],maxXYZ[ndx+1]); \n' +
		'  vec3 m0; \n' +
		'  vec3 m1; \n' +
		'  if (ndx == 0) { \n' +
		'    m0 = vec3(0,0,0); \n' +
		'  } else { \n' +
		'    vec3 pm1 = randXYZ(seed,minXYZ[ndx-1],maxXYZ[ndx-1]); \n' +
		'    m0 = vec3(p1[0]-pm1[0],p1[1]-pm1[1],p1[2]-pm1[2]); \n' +
		'  } \n' +
		'  if (ndx == 2) { \n' +
		'    m1 = vec3(0,0,0); \n' +
		'  } else { \n' +
		'    vec3 p2 = randXYZ(seed,minXYZ[ndx+2],maxXYZ[ndx+2]); \n' +
		'    m1 = vec3(p2[0]-p0[0],p2[1]-p0[1],p2[2]-p0[2]); \n' +
		'  } \n' +
		'  float t = pLen*vecTime - float(ndx); \n' +
		'  vec3 pos = ptcInterp(t, p0, p1, m0, m1); \n' +
		// Start rotate
		'  float tM = max(0.0,t-0.02); \n' +
		'  float tP = min(1.0,t+0.02); \n' +
		'  vec3 posM = ptcInterp(tM, p0, p1, m0, m1); \n' +
		'  vec3 posP = ptcInterp(tP, p0, p1, m0, m1); \n' +
		'  vec3 dPos = posP-posM; \n' +
		'  float dxz = sqrt(pow(dPos[0],2.0)+pow(dPos[2],2.0)); \n' +
		'  float dxyz = length(dPos); \n' +
		'  float cx = dPos[1]/dxyz; \n' +
		'  float cy = dPos[2]/dxz; \n' +
		'  float sx = dxz/dxyz; \n' +
		'  float sy = dPos[0]/dxz; \n' +
		'  mat4 rMat = mat4(cy,0.0,-1.0*sy,0.0, \n' +
		'   sx*sy,cx,sx*cy,0.0, \n' +
		'   cx*sy,-1.0*sx,cx*cy,0.0, \n' +
		'   0.0,0.0,0.0,1.0); \n' +
		'  mat4 tMat = mat4(1.0,0.0,0.0,0.0, \n' +
		'   0.0,1.0,0.0,0.0, \n' +
		'   0.0,0.0,1.0,0.0, \n' +
		'   pos.x,pos.y,pos.z,1.0); \n' +
		'  mat4 tMatIT = mat4(1.0,0.0,0.0,-1.0*pos.x, \n' +
		'   0.0,1.0,0.0,-1.0*pos.y, \n' +
		'   0.0,0.0,1.0,-1.0*pos.z, \n' +
		'   0.0,0.0,0.0,1.0); \n' +
		'  mat4 worldMat = tMat*rMat; \n' +
		'  mat4 worldMatIT = tMatIT*rMat; \n' +
		// End rotate
		'  v_normal = (worldMatIT * vec4(normal, 0)).xyz; \n' +
		'  mat4 myMat = worldViewProjection * worldMat; \n' +
		'  vec4 newPos = myMat * position; \n' +
		'  v_surfaceToLight = lightWorldPos - (worldMat * position).xyz; \n' +
		'  v_surfaceToView = (viewInverse[3] - (worldMat * position)).xyz; \n' +
		'  return newPos; \n' +
		'} \n\n';

	hemi.curve.vertEnd =
		'gl_Position = getPtcPos(); ';
	
	hemi.curve.fragHeader =
		'varying float ptcVis; \n' +
		'\n' +
		'vec4 checkPtcVis(vec4 clr) { \n' +
		'  if (ptcVis < 0.0) { \n' +
		'    clr.a = 0.0; \n' +
		'  } \n' +
		'  return clr; \n' +
		'} \n\n';

	hemi.curve.fragEnd =
		'gl_FragColor = checkPtcVis(preCheck); ';
	
	hemi.curve.GpuParticleSystem = function(cfg) {
		this.active = false;
		this.boxes = cfg.boxes;
		this.endTime = 1.0;
		this.life = cfg.life;
		this.starting = false;
		this.stopping = false;
		this.trail = cfg.trail;
		this.transform = null;
		
		var type = cfg.shape || hemi.curve.shapeType.CUBE,
			color = cfg.color || [0,0,1,1],
			size = cfg.size || 0.3;
		
		switch (type) {
			case hemi.curve.shapeType.ARROW:
				this.transform = hemi.shape.create({
					shape: 'arrow',
					color: color,
					size: size,
					tail: size });
				break;
			case hemi.curve.shapeType.SPHERE:
				this.transform = hemi.shape.create({
					shape: 'sphere',
					color: color,
					radius: size });
				break;
			case hemi.curve.shapeType.CUBE:
			default:
				this.transform = hemi.shape.create({
					shape: 'cube',
					color: color,
					size: size });
				break;
		}
		
		var shape = this.transform.shapes[0];
		var material = modifyShape(shape, cfg.particles, cfg.boxes);
		this.decParam = material.getParam('ptcDec');
		this.decParam.value = 1.0;
		this.maxTimeParam = material.getParam('ptcMaxTime');
		this.maxTimeParam.value = 3.0;
		this.timeParam = material.getParam('ptcTime');
		this.timeParam.value = 1.1;
	};
	
	hemi.curve.GpuParticleSystem.prototype = {
		onRender : function(e) {
			var delta = e.elapsedTime / this.life,
				newTime = this.timeParam.value + delta;
			
			if (newTime > this.endTime) {
				if (this.stopping) {
					this.active = false;
					this.stopping = false;
					this.maxTimeParam.value = 3.0;
					hemi.view.removeRenderListener(this);
					newTime = 1.1;
				} else {
					if (this.starting) {
						this.starting = false;
						this.endTime = 1.0;
						this.decParam.value = 1.0;
						this.maxTimeParam.value = 1.0;
					}
					
					while (--newTime > this.endTime) {}
				}
			}
			
			if (this.stopping) {
				this.maxTimeParam.value += delta;
			}
			
			this.timeParam.value = newTime;
		},
		
		setLife : function(life) {
			if (life > 0) {
				this.life = life;
			}
		},
		
		start : function() {
			if (!this.active) {
				this.active = true;
				
				if (this.trail) {
					this.starting = true;
					this.stopping = false;
					this.endTime = 2.0;
					this.decParam.value = 2.0;
					this.maxTimeParam.value = 2.0;
				} else {
					this.maxTimeParam.value = 1.0;
				}
				
				this.timeParam.value = 1.0;
				hemi.view.addRenderListener(this);
			}
		},
		
		stop : function() {
			if (this.active && !this.stopping) {
				if (this.trail) {
					this.starting = false;
					this.stopping = true;
					this.endTime = this.timeParam.value + 1.0;
				} else {
					this.active = false;
					this.timeParam.value = 1.1;
					this.maxTimeParam.value = 3.0;
					hemi.view.removeRenderListener(this);
				}
				
			}
		}
	};
	
	var modifyShape = function(shape, numParticles, boxes) {
		var elements = shape.elements,
			material = null;
		
		for (var i = 0, il = elements.length; i < il; i++) {
			var element = elements[i];
			
			if (element.className === 'Primitive') {
				var texNdx = modifyPrimitive(element, numParticles);
				
				if (material === null) {
					material = element.material;
					modifyMaterial(material, boxes.length, texNdx);
					material.getParam('numPtcs').value = numParticles;
					setupBounds(material, boxes);
				}
			}
		}
		
		return material;
	};
	
	var modifyPrimitive = function(primitive, numParticles) {
		var TEXCOORD = hemi.core.o3d.Stream.TEXCOORD,
			indexBuffer = primitive.indexBuffer,
			streamBank = primitive.streamBank,
			streams = streamBank.vertexStreams,
			numVerts = streams[0].getMaxVertices_(),
			vertexBuffer = streams[0].field.buffer,
			origStreams = [],
			idOffNdx = -1,
			idOffStream;
		
		// Find the first unused texture coordinate stream and create it
		do {
			idOffStream = streamBank.getVertexStream(TEXCOORD, ++idOffNdx);
		} while (idOffStream !== null);
		
		var idOffsetField = vertexBuffer.createField('FloatField', 2);
		streamBank.setVertexStream(TEXCOORD, idOffNdx, idOffsetField, 0);
		
		// Copy the contents of all of the existing vertex streams
		for (var i = 0, il = streams.length; i < il; i++) {
			var stream = streams[i];
			
			origStreams.push({
				stream: stream,
				vals: stream.field.getAt(0, numVerts)
			});
		}
		
		vertexBuffer.allocateElements(numVerts * numParticles);
		
		// Create a copy of each stream's contents for each particle
		var indexArr = indexBuffer.array_,
			newIndexArr = [];
		
		for (var i = 0; i < numParticles; i++) {
			// Index buffer entry
			var vertOffset = i * numVerts,
				timeOffset = i / numParticles;
			
			for (var j = 0, jl = indexArr.length; j < jl; j++) {
				newIndexArr.push(indexArr[j] + vertOffset);
			}
			// Original vertex data
			for (var j = 0, jl = origStreams.length; j < jl; j++) {
				var obj = origStreams[j],
					vals = obj.vals,
					field = obj.stream.field;
				
				field.setAt(i * numVerts, vals);
			}
			// New "particle system" vertex data
			for (var j = 0; j < numVerts; j++) {
				idOffsetField.setAt(vertOffset + j, [i, timeOffset]);
			}
		}
		
		indexBuffer.set(newIndexArr);
		// Update the primitive and vertex counts
		primitive.numberPrimitives *= numParticles;
  		primitive.numberVertices *= numParticles;
		return idOffNdx;
	};
	
	var modifyMaterial = function(material, numBoxes, texNdx) {
		var shads = hemi.utils.getShaders(material),
			fragShd = shads.fragShd,
			fragSrc = shads.fragSrc;
			vertShd = shads.vertShd,
			vertSrc = shads.vertSrc;
		
		// modify the vertex shader
		if (vertSrc.search('getPtcPos') < 0) {
			var vertHdr = hemi.curve.vertHeader.replace(/NUM_BOXES/g, numBoxes),
				vertEnd = hemi.curve.vertEnd;
			
			vertHdr = vertHdr.replace(/TEXCOORD/g, 'texCoord' + texNdx);
			vertSrc = hemi.utils.combineVertSrc(vertHdr, vertEnd, vertSrc);
			material.gl.detachShader(material.effect.program_, vertShd);
			material.effect.loadVertexShaderFromString(vertSrc);
		}
		
		// modify the fragment shader
		if (fragSrc.search('checkPtcVis') < 0) {
			var fragHdr = hemi.curve.fragHeader,
				fragEnd = hemi.curve.fragEnd;
			
			fragSrc = hemi.utils.combineFragSrc(fragHdr, fragEnd, fragSrc, 'vec4 preCheck');
			material.gl.detachShader(material.effect.program_, fragShd);
			material.effect.loadPixelShaderFromString(fragSrc);
		}
		
		material.effect.createUniformParameters(material);
	};
	
	var setupBounds = function(material, boxes) {
		var minParam = material.getParam('minXYZ'),
			maxParam = material.getParam('maxXYZ'),
			minArr = hemi.core.mainPack.createObject('ParamArray'),
			maxArr = hemi.core.mainPack.createObject('ParamArray');
		
		minArr.resize(boxes.length, 'ParamFloat3');
		maxArr.resize(boxes.length, 'ParamFloat3');
		
		for (var i = 0, il = boxes.length; i < il; ++i) {
			var box = boxes[i];
			minArr.getParam(i).value = box[0];
			maxArr.getParam(i).value = box[1];
		}
		
		minParam.value = minArr;
		maxParam.value = maxArr;
	};
	
	return hemi;
})(hemi || {});