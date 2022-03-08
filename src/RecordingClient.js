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
                //Makes the end date 28 if the end month is February
                if((now.getMonth()+1) === 1){
                    date2 = '28';
                }
                //Makes the end date 30 if the end month is April, June, September, or November
                if((now.getMonth()+1) === 3 || (now.getMonth()+1) === 5 || (now.getMonth()+1) === 8 || (now.getMonth()+1) === 10){
                    date2 = '30';
                }
                //separate start and end dates by three months
                let month1 = now.getMonth();
                let month2 = now.getMonth()+2;
                let year1 = now.getFullYear();
                let year2 = now.getFullYear();
                if(month1 === 0){
                    month1 = '12';
                    year1 = now.getFullYear()-1;
                }else if(month1 < 10){
                    month1 = '0'+month1;
                }
                if(month2 === 13){
                    month2 = '01';
                    year2 = now.getFullYear()+1;
                }else if(month2 < 10){
                    month2 = '0'+month2;
                }

                const options = {dateRange: {from: year1+'-'+month1+'-01' , to: year2+'-'+month2+'-'+date2}, };
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