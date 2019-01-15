define([
    'esri/renderers/SimpleRenderer',
    'esri/renderers/ClassBreaksRenderer',
    'esri/renderers/UniqueValueRenderer',
    'esri/symbols/SimpleMarkerSymbol'
], function (
    SimpleRenderer,
    ClassBreaksRenderer,
    UniqueValueRenderer,
    SimpleMarkerSymbol
) {
    'use strict';

    return class SLD {
        constructor(mapLayer, geojson) {
            this.mapLayer = mapLayer;
            this.geojson = geojson;
            this.containsDefaultCase = false;
            this.cases = this.generateCases();
            this.rules = this.cases.map(this.createRuleForSymbolCase.bind(this));
            this.xml = this.createXml();
        }

        // A mapLayer can render multiple symbols.
        // Each symbol represents a Rule in an SLD.
        // Create a symbol and its correspondig filter per unique symbol.
        generateCases() {
            const mapLayer = this.mapLayer;
            const renderer = mapLayer.renderer;
            if (renderer instanceof SimpleRenderer) {
                const symbol = _.cloneDeep(renderer.getSymbol());
                this.applyLayerAlpha(symbol, mapLayer);
                return [{
                    filter: null, // Every symbol is the same, so no filtering needed
                    symbol,
                    geometryType: mapLayer.geometryType,
                }];
            }
            if (renderer instanceof UniqueValueRenderer) {
                const attribute = renderer.attributeField;

                const specialCases = renderer.infos.map((uniqueValue) => {
                    const symbol = _.cloneDeep(uniqueValue.symbol);
                    this.applyLayerAlpha(symbol, mapLayer);
                    return {
                        filter: {
                            value: uniqueValue.value,
                            attribute,
                        },
                        symbol,
                        geometryType: mapLayer.geometryType,
                    }
                });

                // Add the "else" symbol (default case) to the list
                if (renderer.defaultSymbol) {
                    this.containsDefaultCase = true;
                    const defaultCase = {
                        filter: {
                            value: 1,
                            attribute: 'SLD_DEFAULT_CASE',
                        },
                        symbol: renderer.defaultSymbol,
                        geometryType: mapLayer.geometryType,
                    };

                    return [defaultCase, ...specialCases];
                }

                return specialCases;
            }
            if(renderer instanceof ClassBreaksRenderer){
                const baseSymbol = _.cloneDeep(renderer.infos[0].symbol);
                let result = [];
                renderer.authoringInfo.visualVariables.forEach((e, i) => {
                        const info = renderer.visualVariables[i];
                        const {type} = e;
                        if(renderer.valueExpression) {
                            console.warn('We cannot render this, it is too advanced');
                            result = result.concat([{
                                filter: null,
                                symbol: baseSymbol,
                                geometryType: mapLayer.geometryType,
                            }]);
                            return;
                        }
                        if(type === 'colorInfo'){
                            result = result.concat(this.colorInfoToCases(baseSymbol, info, e, mapLayer));
                        }else if(type === 'sizeInfo'){
                            result = result.concat(this.sizeInfoToCases(baseSymbol, info, mapLayer));
                        }
                        else {
                            console.warn('Unsupported ClassBreak Attributes')
                        }
                });
                return result
            }
            console.warn('Unsupported renderer found', mapLayer.name);
            return [{
                filter: null,
                symbol: renderer.defaultSymbol,
            }];
        }

        applyLayerAlpha(symbol, layer) {
            if(symbol.color) symbol.color.a *= layer.opacity;
            if(symbol.outline && symbol.outline.color) symbol.outline.color.a *= layer.opacity;
        }

        sizeInfoToCases(base, info, layer) {
            const {maxDataValue, minDataValue, maxSize, minSize, valueExpression, field} = info;
            const geo = this.geojson;
            const result = [];
            const resultForValue = {};

            if(valueExpression){
                console.warn('We cant do this yet');
                return;
            }

            for(const feature of geo.features){
                const value = feature.properties[field];
                const newsymbol = _.cloneDeep(base);
                this.applyLayerAlpha(newsymbol, layer);
                if (resultForValue[value || 'SLD_DEFAULT_CASE']) continue;
                if(value){
                    const percentage = (value - minDataValue) / (maxDataValue - minDataValue);
                    let size = minSize + (percentage * (maxSize - minSize));
                    // clamp size
                    size = size <= minSize ? minSize : size >= maxSize ? maxSize : size;
                    newsymbol.size = size;
                    result.push({
                        filter: {
                            value: value,
                            attribute: field,
                        },
                        symbol: newsymbol,
                        geometryType: layer.geometryType,
                    });
                    resultForValue[value] = true;
                    continue;
                }else{
                    this.containsDefaultCase = true;
                    result.push({
                        filter: {
                            value: 1,
                            attribute: 'SLD_DEFAULT_CASE',
                        },
                        symbol: newsymbol,
                        geometryType: layer.geometryType,
                    });
                    resultForValue['SLD_DEFAULT_CASE'] = true;
                    continue;
                }
            }

            return result;
        }

        colorInfoToCases(base, info, meta, layer){
            const {stops, field} = info;
            const {maxSliderValue, minSliderValue} = meta;
            const geo = this.geojson;
            const result = [];
            const resultForValue = {};

            for(const feature of geo.features){
                const value = feature.properties[field];
                if(value >= minSliderValue){
                    for (let i = 0; i < stops.length; i++) {
                        const stop = stops[i];
                        const nextStop = stops[i + 1];
                        const symbol = _.cloneDeep(base);
                        let symbolChanged = false;


                        if (resultForValue[value || 'SLD_DEFAULT_CASE']) break;

                        if(!value){
                            this.containsDefaultCase = true;
                            this.applyLayerAlpha(symbol, layer);
                            result.push({
                                filter: {
                                    value: 1,
                                    attribute: 'SLD_DEFAULT_CASE',
                                },
                                symbol: symbol,
                                geometryType: layer.geometryType,
                            });
                            resultForValue['SLD_DEFAULT_CASE'] = true;
                            break;
                        }

                        if (!nextStop || value <= stop.value) {
                            symbol.color = _.cloneDeep(stop.color);
                            this.applyLayerAlpha(symbol, layer);
                            symbolChanged = true;
                        }

                        if (!symbolChanged && value > stop.value && value < nextStop.value) {
                            // calculate linear transition between two stops
                            const percentage = (value - minSliderValue) / (maxSliderValue - minSliderValue);
                            const r = stop.color.r + (percentage * (nextStop.color.r - stop.color.r));
                            const g = stop.color.g + (percentage * (nextStop.color.g - stop.color.g));
                            const b = stop.color.b + (percentage * (nextStop.color.b - stop.color.b));
                            const a = stop.color.a + (percentage * (nextStop.color.a - stop.color.a));
                            symbol.color.r = Math.round(r);
                            symbol.color.g = Math.round(g);
                            symbol.color.b = Math.round(b);
                            symbol.color.a = Math.round(a);
                            this.applyLayerAlpha(symbol, layer);
                            symbolChanged = true;
                        }

                        if (symbolChanged) {
                            result.push({
                                filter: {
                                    value: value,
                                    attribute: field,
                                },
                                symbol: symbol,
                                geometryType: layer.geometryType,
                            });
                            resultForValue[value] = true;
                            break;
                        }
                    }
                }
            }

            return result;
        }

        createRuleForSymbolCase({ filter, symbol, geometryType }) {
            return `
                <Rule>
                    ${this.createSldFilter(filter)}
                    ${this.createSymbolizer(symbol, { geometryType })}
                </Rule>
            `;
        }

        // Transform `infos` to filter
        createSldFilter(filter) {
            if (!filter) {
                return '';
            }
            const content = `<PropertyName>${filter.attribute}</PropertyName><Literal>${filter.value}</Literal>`
            return `<Filter><PropertyIsEqualTo>${content}</PropertyIsEqualTo></Filter>`;
        }

        _createStrokeAndFill(symbol) {
            let stroke = '';
            if (symbol.outline) {
                stroke = `<Stroke>
                    <SvgParameter name="stroke">${symbol.outline.color.toHex()}</SvgParameter>
                    <SvgParameter name="stroke-opacity">${symbol.outline.color.a}</SvgParameter>
                    <SvgParameter name="stroke-width">${symbol.outline.width}</SvgParameter>
                  </Stroke>`
            }
            const fill = `<Fill>
                <SvgParameter name="fill">${symbol.color.toHex()}</SvgParameter>
                <SvgParameter name="fill-opacity">${symbol.color.a}</SvgParameter>
              </Fill>`;
            return { stroke, fill };
        }

        // Transform arcGis symbol to SLD
        createSymbolizer(symbol, { geometryType }) {
            switch (geometryType) {
                case 'esriGeometryPolygon':
                    return this.createPolygonSymbolizer(symbol);
                case 'esriGeometryPolyline':
                    return this.createLineSymbolizer(symbol);
                case 'esriGeometryPoint':
                default:
                    return this.createPointSymbolizer(symbol);
            }
        }

        createPolygonSymbolizer(symbol) {
            const { stroke, fill } = this._createStrokeAndFill(symbol);
            return `
                <PolygonSymbolizer>
                    ${fill}
                    ${stroke}
                </PolygonSymbolizer>
            `;
        }

        createLineSymbolizer(symbol) {
            return `
                <LineSymbolizer>
                    <Stroke>
                        <SvgParameter name="stroke">${symbol.color.toHex()}</SvgParameter>
                        <SvgParameter name="stroke-opacity">${symbol.color.a}</SvgParameter>
                        <SvgParameter name="stroke-width">${symbol.width}</SvgParameter>
                    </Stroke>
                </LineSymbolizer>
            `;
        }

        _createWellKnownName(symbol) {
            // asdfsdfdsfasdfsaf
            switch (symbol.style) {
                case SimpleMarkerSymbol.STYLE_PATH:
                case SimpleMarkerSymbol.STYLE_SQUARE:
                case SimpleMarkerSymbol.STYLE_DIAMOND:
                    return 'square';
                case SimpleMarkerSymbol.STYLE_X:
                    // return 'x'; // The StreetSmartAPI does not support 'x'
                case SimpleMarkerSymbol.STYLE_CROSS:
                    return 'cross';
                case SimpleMarkerSymbol.STYLE_CIRCLE:
                default:
                    return 'circle';
            }
        }

        createPointSymbolizer(symbol) {
            let content = '';
            if(symbol === undefined) {
                return;
            }
            if (symbol.type === 'picturemarkersymbol') {
                content = `
                    <ExternalGraphic>
                       <OnlineResource xlink:type="simple" xlink:href="${symbol.url}" />
                       <Format>${symbol.contentType}</Format>
                    </ExternalGraphic>
                    <Size>${symbol.size}</Size>
                `;
            } else {
                const wellKnownName = this._createWellKnownName(symbol);
                let { stroke, fill } = this._createStrokeAndFill(symbol);

                // According to the arcgis docs:
                // The color property does not apply to marker symbols defined with the cross or x style.
                // Since these styles are wholly comprised of outlines, you must set the color of symbols with those styles via the setOutline() method.
                if (symbol.style === SimpleMarkerSymbol.STYLE_X ||
                    symbol.style === SimpleMarkerSymbol.STYLE_CROSS) {
                    fill = stroke;
                    stroke = '';
                }

                content = `
                    <Mark>
                        <WellKnownName>${wellKnownName}</WellKnownName>
                        ${fill}
                        ${stroke}
                    </Mark>
                    <Size>${symbol.size || 12}</Size>
                `;
            }
            return `
            <PointSymbolizer>
                <Graphic>
                    ${content}
                </Graphic>
            </PointSymbolizer>
            `;
        }

        createXml() {
            const { mapLayer, rules } = this;

            return `<?xml version="1.0" encoding="UTF-8"?>
                    <sld:StyledLayerDescriptor version="1.1.0" 
                     xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd" 
                     xmlns="http://www.opengis.net/se" 
                     xmlns:sld="http://www.opengis.net/sld" 
                     xmlns:ogc="http://www.opengis.net/ogc" 
                     xmlns:xlink="http://www.w3.org/1999/xlink" 
                     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
                    <sld:NamedLayer>
                        <Name>${mapLayer.name}</Name>
                        <sld:UserStyle>
                            <Title>${mapLayer.id}</Title>
                            <FeatureTypeStyle>
                                 ${rules.join('')}
                            </FeatureTypeStyle>
                        </sld:UserStyle>
                    </sld:NamedLayer>
                </sld:StyledLayerDescriptor>`;
        }
    }
});


