//TODO: betere naam geven dan "utils"
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "esri/geometry/webMercatorUtils",
    "esri/tasks/GeometryService",
    "esri/tasks/ProjectParameters",
    "esri/SpatialReference",
    "esri/geometry/Extent",
    "esri/geometry/Point",
    "//cdnjs.cloudflare.com/ajax/libs/proj4js/2.3.3/proj4.js"
], function(declare, lang, webMercatorUtils, GeometryService, ProjectParameters, SpatialReference, Extent, Point, proj4) {
    "use strict";

    var geometryService = null;

    return {
        //Bounds of SRS's in WGS84. Source: http://spatialreference.org
        SRS_BOUNDS: {
            //UTM zone 10N t/m 18N / NAD83
            26910: { xmin: -126.0000, ymin: 34.4000, xmax: -120.0000, ymax: 77.0000, spatialReference: { wkid: 4326 } },
            26911: { xmin: -120.0000, ymin: 27.0000, xmax: -114.0000, ymax: 78.3300, spatialReference: { wkid: 4326 } },
            26912: { xmin: -114.0000, ymin: 24.8300, xmax: -108.0000, ymax: 79.2500, spatialReference: { wkid: 4326 } },
            26913: { xmin: -108.0000, ymin: 17.8300, xmax: -102.0000, ymax: 80.1000, spatialReference: { wkid: 4326 } },
            26914: { xmin: -102.0000, ymin: 15.5000, xmax: -96.0000, ymax: 81.0000, spatialReference: { wkid: 4326 } },
            26915: { xmin: -96.0000, ymin: 14.2500, xmax: -90.0000, ymax: 82.0000, spatialReference: { wkid: 4326 } },
            26916: { xmin: -90.0000, ymin: 17.7000, xmax: -84.0000, ymax: 82.5000, spatialReference: { wkid: 4326 } },
            26917: { xmin: -84.0000, ymin: 24.0000, xmax: -78.0000, ymax: 83.0000, spatialReference: { wkid: 4326 } },
            26918: { xmin: -78.0000, ymin: 33.8300, xmax: -72.0000, ymax: 83.2000, spatialReference: { wkid: 4326 } },
            //Gauss Krüger Germany DHDN / 3-degree gauss-kruger zone 3
            //31466: { xmin: 5.8700, ymin: 49.1000, xmax: 7.5000, ymax:  53.7500, spatialReference: { wkid: 4326 } },
            //31467: { xmin: 7.5000, ymin: 47.2700, xmax: 10.5000, ymax:  55.0600, spatialReference: { wkid: 4326 } },
            //31468: { xmin: 10.5000, ymin: 47.2700, xmax: 13.5000, ymax: 55.0600 , spatialReference: { wkid: 4326 } },
            //31469: { xmin: 13.5000, ymin: 47.2700, xmax: 16.5000, ymax: 55.0600, spatialReference: { wkid: 4326 } }
            //UTM ZONE 30N t/m 33N / ETRS89
            25830: { xmin: -6.0000, ymin: 1.0000, xmax: 0.0000, ymax: 82.3300, spatialReference: { wkid: 4326 } },
            25831: { xmin: 0.0000, ymin: 1.0000, xmax: 6.0000, ymax: 82.3300, spatialReference: { wkid: 4326 } },
            25832: { xmin: 6.0000, ymin: 1.0000, xmax: 12.0000, ymax: 85.6700, spatialReference: { wkid: 4326 } },
            25833: { xmin: 12.0000, ymin: 1.0000, xmax: 21.0000, ymax: 80.0500, spatialReference: { wkid: 4326 } }
        },

        //geometryService: null,

        setGeometryService: function(url) {
            geometryService = new GeometryService(url);
        },

        //constructor: function(options) {
        //    if (options && options.geometryServiceUrl) {
        //        this.geometryService = new GeometryService(options.geometryServiceUrl);
        //    }
        //},

        /**
         * Find local SRS at given position
         * @param ptLL point at which we want to know the SRS
         * @returns {Number} the WKID of the spatial reference system, null if no SRS was found
         */
        getSrsAtCoordinates: function(ptLL) {
            //var ptLL = webMercatorUtils.webMercatorToGeographic(mapPoint);
            //if (mapPoint.spatialReference.wkid === 4326) ptLL = mapPoint;
            for (var srs in this.SRS_BOUNDS) {
                var extent = new Extent(this.SRS_BOUNDS[srs]);
                if (extent.contains(ptLL)) {
                    return parseInt(srs);
                }
            }
            return null;
        },

        transform: function(sourceGeom, targetSrs, callback, useProj4js) {
            if (!geometryService) {
                console.error("No geometry service defined.");
                return;
            }

            //Input for the geometry service should always be an array
            if (!Array.isArray(sourceGeom)) sourceGeom = [sourceGeom];

            //No transformation needed if source SRS == target SRS
            if (sourceGeom[0].spatialReference.wkid === targetSrs) {
                //return sourceGeom;
                callback(sourceGeom);
                return;
            }

            //if (useProj4js === true) {
            //    //NB: werkt alleen voor punten
            //
            //    var sourceEpsg = "EPSG:" + sourceGeom[0].spatialReference.wkid;
            //    var destEpsg = "EPSG:" + targetSrs;
            //    if (sourceEpsg === "EPSG:102100") sourceEpsg = "EPSG:3857";
            //    if (destEpsg === "EPSG:102100") destEpsg = "EPSG:3857";
            //
            //    var source = proj4(sourceEpsg);
            //    var dest = proj4(destEpsg);
            //
            //    var results = [];
            //    for (var i = 0; i < sourceGeom.length; ++i) {
            //        var p = proj4(source, dest).forward([sourceGeom[i].x, sourceGeom[i].y]);
            //        results.push(new Point(p[0], p[1], new SpatialReference({ wkid: parseInt(targetSrs) })));
            //    }
            //    callback(results);
            //} else {
            var params = new ProjectParameters();
            params.geometries = sourceGeom;
            params.outSR = new SpatialReference({ wkid: parseInt(targetSrs) });

            geometryService.project(params, callback);
            //}
        },
        /**
         * transform a point with Proj4js
         * (use this function if no serverside transformation is needed (for a point)
         * If source srs is the same as target srs ignore transformation
         * @param sourceGeom point to transform
         * @param targetSrs srs to transform the point to
         * @returns {Point} the (original) transformed point
         */
        transformProj4js: function(sourceGeom, targetSrs) {
            //NB: werkt alleen voor punten

            //No transformation needed if source SRS == target SRS
            if (sourceGeom.spatialReference.wkid === targetSrs) {
                //return sourceGeom;
                return sourceGeom;
            }

            var sourceEpsg = "EPSG:" + sourceGeom.spatialReference.wkid;
            var destEpsg = "EPSG:" + targetSrs;
            if (sourceEpsg === "EPSG:102100") sourceEpsg = "EPSG:3857";
            if (destEpsg === "EPSG:102100") destEpsg = "EPSG:3857";

            var source = proj4(sourceEpsg);
            var dest = proj4(destEpsg);

            var p = proj4(source, dest).forward([sourceGeom.x, sourceGeom.y]);
            return new Point(p[0], p[1], new SpatialReference({ wkid: parseInt(targetSrs) }));
        }
    };
});