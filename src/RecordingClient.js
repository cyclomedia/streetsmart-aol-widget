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

        load(timeTravel) {
            //GC: created an additional function that includes the options variable to show the dates of the recording if time travel was activated
            if(timeTravel){
                const now = timeTravel;
                let date2 = '31';
                //Makes the end date 28 if the month is February
                if(now.getMonth() === 1){
                    date2 = '28';
                }
                //Makes the end date 30 if the month is April, June, September, or November
                if(now.getMonth() === 3 || now.getMonth() === 5 || now.getMonth() === 8 || now.getMonth() === 10){
                    date2 = '30';
                }
                let month = now.getMonth()+1;
                const year = now.getFullYear();
                if(month < 10){
                    month = '0'+month;
                }
                //const options = {dateRange: {from: now.getFullYear()+'-'+(now.getMonth()+1)+'-'+(now.getDate()-1), to: (now.getFullYear())+'-'+(now.getMonth()+1)+'-'+(now.getDate()+1)}, };
                const options = {dateRange: {from: year+'-'+month+'-01' , to: year+'-'+month+'-'+date2}, };

                const {
                    extent: { xmin, ymin, xmax, ymax },
                    spatialReference: { wkid }
                } = this.map;

                return this._wfsClient.requestWithinBBOX(
                    xmin, ymin, xmax, ymax, wkid, options
                );
            }else{
                const {
                    extent: { xmin, ymin, xmax, ymax },
                    spatialReference: { wkid }
                } = this.map;

                return this._wfsClient.requestWithinBBOX(
                    xmin, ymin, xmax, ymax, wkid
                );
            }

        }

        // load() {
        //     const {
        //         extent: { xmin, ymin, xmax, ymax },
        //         spatialReference: { wkid }
        //     } = this.map;
        //
        //     return this._wfsClient.requestWithinBBOX(
        //         xmin, ymin, xmax, ymax, wkid
        //     );
        // }
    }
});