
(function () {

    function _getAllAttr(node) {
        const result = {};
        if(node && node.attributes) {
            if (node.hasAttributes() === true) {
                const attributes = node.attributes;
                const attribKeys = Object.keys(attributes);
                for (let index = 0; index < attribKeys.length; index += 1) {
                    const attr = attributes[attribKeys[index]];
                    if(attr && attr.name && attr.value) {
                        result[attr.name] = attr.value;
                    }
                }
            }
        }
        return result;
    }

    /**
     * @private
     */
    function _getContent(node) {
        return node.innerHTML || node.textContent;
    }

    /**
     * @private
     */
    function _getTagName(node) {
        return node.tagName;
    }

    /**
     * @private
     */
    function _getChildren(parent) {
        const children = [];
        if(parent && parent.childNodes) {
            const childNodes = parent.childNodes;
            let childNodeKeys = Object.keys(childNodes);
            for (let childIndex = 0; childIndex < childNodeKeys.length; childIndex += 1) {
                const child = childNodes[childNodeKeys[childIndex]];
                if(child && child.nodeType === 1) {
                    children.push(child);
                }
            }
        }
        return children;
    }

    /**
     * @private
     */
    function _getChildInfo(children) {
        const resultArr = [];
        if(children) {
            const childKeys = Object.keys(children);
            for(let childKeyIndex = 0; childKeyIndex < childKeys.length; childKeyIndex += 1) {
                const child = children[childKeys[childKeyIndex]];
                if(child) {
                    const eachChildInfo = {
                        tagName: _getTagName(child),
                        content: _getContent(child),
                        attr: _getAllAttr(child),
                        isParent: false,
                        hasAttr: child.hasAttributes()
                    };
                    const subChildren = _getChildren(child);
                    if (subChildren && subChildren.length !== 0) {
                        eachChildInfo.isParent = true;
                        eachChildInfo.children = _getChildInfo(subChildren);
                    }
                    resultArr.push(eachChildInfo);
                }
            }
        }
        return resultArr;
    }


    function toJSON(xmlString) {
        const doc = getXmlObject(xmlString);
        return _getChildInfo(doc.childNodes)[0];
    }

    function getXmlObject(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        return xmlDoc;
    }
        define({
            toJSON
        });
})();
