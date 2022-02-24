define([], function() {
    return class RecordingClient {
        constructor({ config, apiKey, map }) {
            this.config = config;
            this.apiKey = apiKey;
            this.map = map;

            this._wfsClient = this._constructWfsClient();
        }

        _constructWfsClient() {
            const { token, atlasHost } = this.config;
            if (!atlasHost) {
                alert(`Street Smart: atlasHost not configured!`);
            }

            const authHeader = {
                Authorization: `Basic ${token}`
            };
            return new CM.aperture.WfsRecordingClient({
                uriManager: new CM.aperture.WfsRecordingUriManager({
                    apiKey: this.apiKey,
                    dataUri: atlasHost + '/recording/wfs',
                    withCredentials: true
                }),
                authHeaders: authHeader
            });
        }

        load() {
            const {
                extent: { xmin, ymin, xmax, ymax },
                spatialReference: { wkid }
            } = this.map;

            return this._wfsClient.requestWithinBBOX(
                xmin, ymin, xmax, ymax, wkid
            );
        }
    }
});