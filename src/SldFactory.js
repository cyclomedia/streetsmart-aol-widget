define([
    'esri/renderers/SimpleRenderer',
    'esri/renderers/ClassBreaksRenderer'
], function (
    SimpleRenderer,
    ClassBreaksRenderer
) {
    'use strict';

    return {
        create({ mapLayer }) {
            const filterSymbolMapping = this.generateFilterSymbolMapping({ mapLayer });
            const rules = filterSymbolMapping.map(this.createRuleForSymbolCase.bind(this));
            return this.wrapSld(rules);
        },
        // A mapLayer can render multiple symbols.
        // Each symbol represents a Rule in an SLD.
        // Create a symbol and its correspondig filter per unique symbol.
        generateFilterSymbolMapping({ mapLayer }) {
        // ... not really a mapping but meh.
            const renderer = mapLayer.renderer;
            if (renderer instanceof  SimpleRenderer) {
                return [{
                    filter: null, // Every symbol is the same, so no filtering needed
                    symbol: renderer.getSymbol(),
                    geometryType: mapLayer.geometryType,
                }];
            }
            console.warn('Unsupported renderer found', mapLayer.name, mapLayer.renderer);
            return [{
                filter: null,
                symbol: renderer.defaultSymbol,
            }];
        },
        createRuleForSymbolCase({ filter, symbol, geometryType }) {
            return `
                <Rule>
                    ${this.createSldFilter(filter)}
                    ${this.createSymbolizer(symbol, { geometryType })}
                </Rule>
            `;
        },
        // Transform `infos` to filter
        createSldFilter(filter) {
            return '';
        },
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
        },
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
        },
        createPolygonSymbolizer(symbol) {
            const { stroke, fill } = this._createStrokeAndFill(symbol);
            return `
                <PolygonSymbolizer>
                    ${fill}
                    ${stroke}
                </PolygonSymbolizer>
            `;
        },
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
        },
        createPointSymbolizer(symbol) {
            let content = '';
            if (symbol.type === 'picturemarkersymbol') {
                content = `
                    <ExternalGraphic>
                       <OnlineResource xlink:type="simple" xlink:href="${symbol.imageData}" />
                       <Format>${symbol.contentType}</Format>
                    </ExternalGraphic>
                    <Size>32</Size>
                `;
            } else {
                const { stroke, fill } = this._createStrokeAndFill(symbol);
                content = `
                    <Mark>
                        <WellKnownName>circle</WellKnownName>
                        ${fill}
                        ${stroke}
                    </Mark>
                    <Size>12</Size>
                `;
            }
            return `
            <PointSymbolizer>
                <Graphic>
                    ${content}
                </Graphic>
            </PointSymbolizer>
            `;
        },
        wrapSld(rules) {
            return `<sld:StyledLayerDescriptor version="1.0.0"
              xsi:schemaLocation="http://www.opengis.net/sldStyledLayerDescriptor.xsd"
              xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            >
                <sld:NamedLayer>
                    <Name>BetaAssets - Utility Structures</Name>
                    <sld:UserStyle>
                        <Title>BetaAssets_8551</Title>
                        <FeatureTypeStyle>
                         ${rules.join('')}
                        </FeatureTypeStyle>
                    </sld:UserStyle>
                </sld:NamedLayer>
            </sld:StyledLayerDescriptor>`;
        }
    };
});


