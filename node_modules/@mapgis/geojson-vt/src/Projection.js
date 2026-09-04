import proj4 from 'proj4';
/**
 * @description: 投影坐标系对象
 */
export default class Projection {
    /**
     * @description 实现投影对象
     * @param {String} code
     * @param {String} def 参考系对象
     * @param {Array<Number>} bounds 投影系范围
     * @param {Number} width 投影系宽度
     * @param {Number} height 投影系高度
     * @return {*}
     */
    constructor(code, def, bounds, width, height) {
        this.bounds = bounds;
        this.width = width;
        this.height = height;
        if (!def) throw new Error('自定义参考系必须指定参数系信息def');
        // 验证proj4库是否存在
        if (!proj4) throw new Error('proj4对象不存在，自定义投影必须引入proj4对象');
        const isP4 = this._isProj4Obj(code);
        this._proj = isP4 ? code : this._projFromCodeDef(code, def);      
    }

    /**
     * @description: 投影方法
     * @param {Array|Object} lnglat
     * @return {*}
     */
    project(lnglat) {
        let lng, lat;
        if (Array.isArray(lnglat)) {
            lng = lnglat[0];
            lat = lnglat[1];
        } else {
            lng = lnglat.lng;
            lat = lnglat.lat;
        }
        const coords = this._proj.forward([lng, lat]);
        const bounds = this.bounds;
        const x = (coords[0] - bounds[0]) / this.width;
        const y = (bounds[3] - coords[1]) / this.height;
        return [x, y];
    }


    /**
     * @description: 反投影方法
     * @param {Array|Object} point
     * @return {*}
     */
    unproject(point) {
        let x, y;
        if (Array.isArray(point)) {
            x = point[0];
            y = point[1];
        } else {
            x = point.x;
            y = point.y;
        }
        return this._proj.inverse([x, y]);
    }


    /**
     * @description: 定义proj投影
     * @param {*} code
     * @param {*} def
     * @return {*}
     */
    _projFromCodeDef(code, def) {
        if (def) {
            proj4.defs(code, def);
        } else if (proj4.defs[code] === undefined) {
            const urn = code.split(':');
            if (urn.length > 3) {
                code = `${urn[urn.length - 3]  }:${  urn[urn.length - 1]}`;
            }
            if (proj4.defs[code] === undefined) {
                throw new Error(`No projection definition for code ${  code}`);
            }
        }
        return proj4(code);
    }


    /**
     * @description: 判断是否是proj4
     * @param {*} a
     * @return {*}
     */
    _isProj4Obj(a) {
        return (typeof a.inverse !== 'undefined' &&
            typeof a.forward !== 'undefined');
    }
}
