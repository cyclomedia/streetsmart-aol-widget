define([], function () {
    "use strict";

    return {

        diamondSymbol: ({fill, size = 12, rotation = 45}) =>
            `<PointSymbolizer>
                <Graphic>
                    <Mark>
                        <WellKnownName>square</WellKnownName>
                        <Fill>
                            <CssParameter name="fill">${fill}</CssParameter>
                        </Fill>
                    </Mark>
                    <Size>${size}</Size>
                    <Rotation>${rotation}</Rotation>
                </Graphic>
            </PointSymbolizer>`,

        squareSymbol: ({ fill, stroke, strokeWidth, size = 12 }) =>
            `<PointSymbolizer>
                <Graphic>
                    <Mark>
                        <WellKnownName>square</WellKnownName>
                        <Fill>
                            <CssParameter name="fill">${fill}</CssParameter>
                        </Fill>
                        <Stroke>
                            <CssParameter name="stroke">${stroke}</CssParameter>
                            <CssParameter name="stroke-width">${strokeWidth}</CssParameter>
                        </Stroke>
                    </Mark>
                    <Size>${size}</Size>
                </Graphic>
            </PointSymbolizer>`,

        circleSymbol: ({ fill, size = 12, stroke, strokeWidth  }) =>
            `<PointSymbolizer>
                <Graphic>
                    <Mark>
                        <WellKnownName>circle</WellKnownName>
                        <Fill>
                            <CssParameter name="fill">${fill}</CssParameter>
                        </Fill>
                        <Stroke>
                            <CssParameter name="stroke">${stroke}</CssParameter>
                            <CssParameter name="stroke-width">${strokeWidth}</CssParameter>
                        </Stroke>
                    </Mark>
                    <Size>${size}</Size>
                </Graphic>
            </PointSymbolizer>`,

        imageSymbol: ({ imageType, imageUrl, imgSize = 32 }) =>
            `<PointSymbolizer>
                <Graphic>
                    <ExternalGraphic>
                        <OnlineResource xlink:type="simple" xlink:href=${imageUrl} />
                <Format>${imageType}</Format>
              </ExternalGraphic>
              <Size>${imgSize}</Size>
            </Graphic>
          </PointSymbolizer>`,

        lineSymbol: ({ fill, lineWidth }) =>
            `<LineSymbolizer>
                <Stroke>
                  <CssParameter name="stroke">${fill}</CssParameter>
                </Stroke>
            </LineSymbolizer>`,

        polySymbol: ({fill, stroke, strokeWidth}) =>
            `<PolygonSymbolizer>
                <Fill>
                    <CssParameter name="fill">${fill}</CssParameter>
                    <CssParameter name="fill-opacity">0</CssParameter>
                 </Fill>
                 <Stroke>
                    <CssParameter name="stroke">${stroke}</CssParameter>
                    <CssParameter name="stroke-width">${strokeWidth}</CssParameter>
                </Stroke>
            </PolygonSymbolizer>`,
        smallPolySymbol: ({fill, stroke, strokeWidth}) =>
            `<PolygonSymbolizer>
                <Fill>
                    <CssParameter name="fill">${fill}</CssParameter>
                    <CssParameter name="fill-opacity">0.5</CssParameter>
                 </Fill>
                 <Stroke>
                    <CssParameter name="stroke">${stroke}</CssParameter>
                    <CssParameter name="stroke-width">${strokeWidth}</CssParameter>
                </Stroke>
            </PolygonSymbolizer>`,

        sldStylingPoints: function (fill, stroke, strokeWidth, shape, name, title, imageType, imageUrl, imageSize, lineWidth, polygonLength) {
            const filter = (symbol) => `<ogc:Filter>
                <ogc:PropertyIsEqualTo>
                  <ogc:PropertyName>symbol</ogc:PropertyName>
                  <ogc:Literal>${symbol}</ogc:Literal>
                </ogc:PropertyIsEqualTo>
              </ogc:Filter>`;
            const polygonFilter = (polygonLength) => `<ogc:Filter>
                <ogc:PropertyIsGreaterThan>
                  <ogc:PropertyName>polygonLength</ogc:PropertyName>
                  <ogc:Literal>5</ogc:Literal>
                </ogc:PropertyIsGreaterThan>
              </ogc:Filter>`;
            const smallPolygonFilter = (polygonLength) => `<ogc:Filter>
                <ogc:PropertyIsLessThanOrEqualTo>
                  <ogc:PropertyName>polygonLength</ogc:PropertyName>
                  <ogc:Literal>5</ogc:Literal>
                </ogc:PropertyIsLessThanOrEqualTo>
              </ogc:Filter>`;

            if(imageType === undefined){imageType = "image/png";}
            if(imageUrl === undefined){imageUrl = "'" + "colorblocks.png" + "'" ;}

            return `<?xml version="1.0" encoding="UTF-8"?>
                    <sld:StyledLayerDescriptor version="1.1.0" 
                     xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd" 
                     xmlns="http://www.opengis.net/se" 
                     xmlns:sld="http://www.opengis.net/sld" 
                     xmlns:ogc="http://www.opengis.net/ogc" 
                     xmlns:xlink="http://www.w3.org/1999/xlink" 
                     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
              <sld:NamedLayer>
                <Name>${name}</Name>
                <sld:UserStyle>
                <VendorOption name="attributeInfo">ObjectID</VendorOption>
                  <Title>${title}</Title>
                  <FeatureTypeStyle>
                    <Rule>
                      ${filter('circle')}
                      ${this.circleSymbol({ fill, stroke, strokeWidth })}
                    </Rule>
                    <Rule>
                      ${filter('diamond')}
                      ${this.squareSymbol({ fill, stroke, strokeWidth })}
                    </Rule>
                    <Rule>
                      ${filter('square')}
                      ${this.squareSymbol({ fill, stroke, strokeWidth })}
                    </Rule>
                    <Rule>
                      ${filter('image')}
                      ${this.imageSymbol({imageType, imageUrl, imageSize})}
                    </Rule>
                    <Rule>
                      ${filter('line')}
                      ${this.lineSymbol({fill,lineWidth})}
                    </Rule>
                    <Rule>
                      ${filter('polygon')}
                      ${polygonFilter(polygonLength)}
                      ${this.polySymbol({fill, stroke, strokeWidth})}
                    </Rule>
                    <Rule>
                      ${filter('polygon')}
                      ${smallPolygonFilter(polygonLength)}
                      ${this.smallPolySymbol({fill, stroke, strokeWidth})}
                    </Rule>
                  </FeatureTypeStyle>
                </sld:UserStyle>
              </sld:NamedLayer>
            </sld:StyledLayerDescriptor>`;
        }

    };
});


