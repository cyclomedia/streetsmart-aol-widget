
// import { get } from 'https://sld.cyclomedia.com/react/lodash.min.js';
// import { getContentTypeJsonHeaders, getContentTypeTextHeaders } from '../store/auth';
//
// export default class GeoTransformClient {

//import {getAuthHeaders} from "./auth";

define([
    'https://sld.cyclomedia.com/react/lodash.min.js',
], function (
    lodash,
) {
    return class GeoTransformClient {
        constructor({widget}) {
            this.widget = widget;
            this._geoTransformService = 'https://atlasapi.cyclomedia.com/geotransform/api/v1/transformations/';
        }

        _canRequestData() {
            return !!this._geoTransformService;
        }

        _buildGeoTransformRequestBody(inputSrs, outputSrs, coordinates) {
            const coordinatesJson = [];

            coordinates.forEach(coordinate => {
                if (Array.isArray(coordinate) && coordinate.length >= 2) {
                    coordinatesJson.push({
                        X: coordinate[0],
                        Y: coordinate[1],
                        Z: coordinate[2] || null,
                        Heading: 0,
                        XStandardDeviation: 0,
                        YStandardDeviation: 0,
                        ZStandardDeviation: 0,
                    });
                }
            });

            return {
                InputEpsg: this._normalizeSrs(inputSrs),
                OutputEpsg: this._normalizeSrs(outputSrs),
                Coordinates: coordinatesJson,
                AllowLowQualityCrossGeographicEpsgTransformations: false,
            };
        }

        _normalizeSrs(srs){
            const reValidSrs = /(?:(EPSG|ESRI):)?(\d+)/;
            const match = ("" + srs).match(reValidSrs);

            if (!match) {
                throw new Error('Invalid SRS: "' + srs + '"');
            }

            //const authority = match[1];
            let srsId = parseInt(match[2], 10);

            // special treatment for 102100, which is equivalent to 3857
            if (srsId === 102100) {
                srsId = 3857;
            }

            return srsId;
        }

        _buildGeoTransformGetPrjRequest(epsg) {
            return new Request(`${this._geoTransformService}prj/${epsg}`, {
                method: 'GET',
                headers: new Headers(this._getContentTypeTextHeaders()),
                mode: 'cors',
            });
        }

        _buildGeoTransformRequest(body) {
            return new Request(`${this._geoTransformService}transform`, {
                method: 'POST',
                redirect: 'follow',
                headers: new Headers(this._getContentTypeJsonHeaders()),
                body: JSON.stringify(body),
                mode: 'cors',
            });
        }

        _getContentTypeJsonHeaders() {
            return {
                Authorization: 'Basic'+btoa(this.widget.config.username + ':' + this.widget.config.password),
                'Content-Type': 'application/json',
            };
        }

        _getContentTypeTextHeaders() {
            return {
                Authorization: 'Basic'+btoa(this.widget.config.username + ':' + this.widget.config.password),
                'Content-Type': 'text/plain',
            };
        }

        _getDatasetData(data) {
            const coordinates = lodash.get(data, 'Coordinates');
            let result = [];

            if (Array.isArray(coordinates)) {
                result = coordinates.map(c => [c.X || 0, c.Y || 0, c.Z || 0]);
            }

            return result;
        }

        async _handleRequestResponseToJson(request) {
            const response = await fetch(request);

            if (!response.ok) {
                const errorMessage = `Loading geoTransform transformation ${request.url} failed with status code ${response.status}. Message: ${response.statusText}`;
                throw new Error(errorMessage);
            }

            return response.json();
        }

        async _handlePrjRequestResponseToText(request) {
            const response = await fetch(request);

            if (!response.ok) {
                const errorMessage = `Loading geoTransform projection ${request.url} failed with status code ${response.status}. Message: ${response.statusText}`;
                throw new Error(errorMessage);
            }

            return response.text();
        }

        async requestGeoTransform(epsgSource, epsgTarget, coordinates) {
            if (!(epsgSource && epsgTarget && coordinates && this._canRequestData())) {
                return undefined;
            }
            if (!(Array.isArray(coordinates) && coordinates.length)) {
                return undefined;
            }

            const body = this._buildGeoTransformRequestBody(epsgSource, epsgTarget, coordinates);
            const request = this._buildGeoTransformRequest(body);
            const data = await this._handleRequestResponseToJson(request);
            return this._getDatasetData(data);
        }

        async requestPrjFromGeoTransform(epsg) {
            if (!epsg && this._canRequestData()) {
                return undefined;
            }
            const request = this._buildGeoTransformGetPrjRequest(epsg);
            return await this._handlePrjRequestResponseToText(request);
        }
    }
});
