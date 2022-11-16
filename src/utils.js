define([
    "esri/SpatialReference",
    "esri/geometry/Point",
], function(SpatialReference, Point) {
    "use strict";

    return {
        proj4: null,

        DEG_TO_RAD: Math.PI / 180.0,
        RAD_TO_DEG: 180.0 / Math.PI,

        toRadians: function(deg) {
            return deg * this.DEG_TO_RAD;
        },

        toDegrees: function(rad) {
            return rad * this.RAD_TO_DEG;
        },

        setProj4: function(proj4) {
            this.proj4 = proj4;
        },
        /**
         * transform a point with Proj4js
         * (use this function if no serverside transformation is needed (for a point)
         * If source srs is the same as target srs ignore transformation
         * @param sourceGeom point to transform
         * @param targetSrs srs to transform the point to
         * @returns {Point} the (original) transformed point
         */
        transformProj4js: function(nls, sourceGeom, targetSrs, backupSRS) {
            //NB: Only works with points.

            //No transformation needed if source SRS == target SRS
            //GC: added a backup SRS for the latestWkid in case targetSRS doesn't match
            //Covers all cases for finding matching SRS to avoid the projection method
            //these will return a new saved measurement
            if (sourceGeom.spatialReference.wkid === targetSrs) {
                return sourceGeom;
            }else if(sourceGeom.spatialReference.wkid === backupSRS) {
                return sourceGeom;
            }else if(sourceGeom.spatialReference.latestWkid && sourceGeom.spatialReference.latestWkid === targetSrs) {
                return sourceGeom;
            }else if(sourceGeom.spatialReference.latestWkid && sourceGeom.spatialReference.latestWkid === backupSRS) {
                return sourceGeom;
            }

            var sourceEpsg = "EPSG:" + sourceGeom.spatialReference.wkid;
            var destEpsg = "EPSG:" + targetSrs;
            //creating latest esri web mercator SRS
            if (sourceEpsg === "EPSG:102100") {
                sourceEpsg = "EPSG:3857";
            }
            if (destEpsg === "EPSG:102100") {
                destEpsg = "EPSG:3857";
            }

            //GC: looks for an error exception if the proj4 function cannot find the source or destination projection
            //if error is caught, then the projection method is called to end the widget
            try{
                var source = this.proj4(sourceEpsg);
            }
            catch(err){
                //var dest = source;
                alert(nls.srsAlert);
                var source = this.proj4(sourceEpsg);
            }

            try{
                var dest = this.proj4(destEpsg);
            }
            catch(err){
                //var dest = source;
                alert(nls.srsAlert);
                var dest = this.proj4(destEpsg);
            }

            var p = this.proj4(source, dest).forward([sourceGeom.x, sourceGeom.y]);
            //this will NOT return a new saved measurement
            return new Point(p[0], p[1], new SpatialReference({ wkid: parseInt(targetSrs) }));
        }
    };
});
