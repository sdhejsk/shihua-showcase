
import convert from './convert.js';     // GeoJSON conversion and preprocessing
import clip from './clip.js';           // stripe clipping algorithm
import wrap from './wrap.js';           // date line processing
import transform from './transform.js'; // coordinate transformation
import createTile from './tile.js';     // final simplified tile generation

const defaultOptions = {
    crs: 'EPSG:3857',       // 默认的投影坐标系 3857 4326走经纬度裁图
    maxZoom: 14,            // max zoom to preserve detail on
    indexMaxZoom: 5,        // max zoom in the tile index
    indexMaxPoints: 100000, // max number of points per tile in the tile index
    tolerance: 3,           // simplification tolerance (higher means simpler)
    extent: 4096,           // tile extent
    buffer: 64,             // tile buffer on each side
    lineMetrics: false,     // whether to calculate line metrics
    promoteId: null,        // name of a feature property to be promoted to feature.id
    generateId: false,      // whether to generate feature ids. Cannot be used with promoteId
    debug: 0,               // logging level (0, 1 or 2)
    isWrapData: false       // 表示是否对geojson数据进行分段处理。如果为true，则会对超出范围的数据重新计算，保证其在世界范围内显示。如果为false，则不处理。
};

class GeoJSONVT {
    constructor(data, options) {
        options = this.options = extend(Object.create(defaultOptions), options);

        const debug = options.debug;

        if (debug) console.time('preprocess data');

        if (options.maxZoom < 0 || options.maxZoom > 24) throw new Error('maxZoom should be in the 0-24 range');
        if (options.promoteId && options.generateId) throw new Error('promoteId and generateId cannot be used together.');

        // projects and adds simplification info
        const features = convert(data, options);
        this.features = features;
        // tiles and tileCoords are part of the public API
        this.tiles = {};
        this.tileCoords = [];

        if (debug) {
            console.timeEnd('preprocess data');
            console.log('index: maxZoom: %d, maxPoints: %d', options.indexMaxZoom, options.indexMaxPoints);
            console.time('generate tiles');
            this.stats = {};
            this.total = 0;
        }

        // wraps features (ie extreme west and extreme east)
        // 移除worldCopies操作，目前按屏幕范围取瓦片范围
        // if (options.isWrapData) {
        //     features = wrap(features, options);
        // }
        // start slicing from the top tile down
        // if (features.length) this.splitTile(features, 0, 0, 0);

        // if (debug) {
        //     if (features.length) console.log('features: %d, points: %d', this.tiles[0].numFeatures, this.tiles[0].numPoints);
        //     console.timeEnd('generate tiles');
        //     console.log('tiles generated:', this.total, JSON.stringify(this.stats));
        // }
    }

    // splits features from a parent tile to sub-tiles.
    // z, x, and y are the coordinates of the parent tile
    // cz, cx, and cy are the coordinates of the target tile
    //
    // If no target tile is specified, splitting stops when we reach the maximum
    // zoom or the number of points is low as specified in the options.
    splitTile(features, z, x, y, cz, cx, cy) {

        const stack = [features, z, x, y];
        const options = this.options;
        const debug = options.debug;

        // avoid recursion by using a processing queue
        while (stack.length) {
            y = stack.pop();
            x = stack.pop();
            z = stack.pop();
            features = stack.pop();

            const z2 = 1 << z;
            const id = toID(z, x, y);
            let tile = this.tiles[id];

            if (!tile) {
                if (debug > 1) console.time('creation');

                tile = this.tiles[id] = createTile(features, z, x, y, options);
                this.tileCoords.push({z, x, y});

                if (debug) {
                    if (debug > 1) {
                        console.log('tile z%d-%d-%d (features: %d, points: %d, simplified: %d)',
                            z, x, y, tile.numFeatures, tile.numPoints, tile.numSimplified);
                        console.timeEnd('creation');
                    }
                    const key = `z${  z}`;
                    this.stats[key] = (this.stats[key] || 0) + 1;
                    this.total++;
                }
            }

            // save reference to original geometry in tile so that we can drill down later if we stop now
            tile.source = features;

            // if it's the first-pass tiling
            if (cz == null) {
                // stop tiling if we reached max zoom, or if the tile is too simple
                if (z === options.indexMaxZoom || tile.numPoints <= options.indexMaxPoints) continue;
            // if a drilldown to a specific tile
            } else if (z === options.maxZoom || z === cz) {
                // stop tiling if we reached base zoom or our target tile zoom
                continue;
            } else if (cz != null) {
                // stop tiling if it's not an ancestor of the target tile
                const zoomSteps = cz - z;
                if (x !== cx >> zoomSteps || y !== cy >> zoomSteps) continue;
            }

            // if we slice further down, no need to keep source geometry
            tile.source = null;

            if (features.length === 0) continue;

            if (debug > 1) console.time('clipping');

            // values we'll use for clipping
            const k1 = 0.5 * options.buffer / options.extent;
            const k2 = 0.5 - k1;
            const k3 = 0.5 + k1;
            const k4 = 1 + k1;

            let tl = null;
            let bl = null;
            let tr = null;
            let br = null;

            let left  = clip(features, z2, x - k1, x + k3, 0, tile.minX, tile.maxX, options);
            let right = clip(features, z2, x + k2, x + k4, 0, tile.minX, tile.maxX, options);
            features = null;

            if (left) {
                tl = clip(left, z2, y - k1, y + k3, 1, tile.minY, tile.maxY, options);
                bl = clip(left, z2, y + k2, y + k4, 1, tile.minY, tile.maxY, options);
                left = null;
            }

            if (right) {
                tr = clip(right, z2, y - k1, y + k3, 1, tile.minY, tile.maxY, options);
                br = clip(right, z2, y + k2, y + k4, 1, tile.minY, tile.maxY, options);
                right = null;
            }

            if (debug > 1) console.timeEnd('clipping');

            stack.push(tl || [], z + 1, x * 2,     y * 2);
            stack.push(bl || [], z + 1, x * 2,     y * 2 + 1);
            stack.push(tr || [], z + 1, x * 2 + 1, y * 2);
            stack.push(br || [], z + 1, x * 2 + 1, y * 2 + 1);
        }
    }

    /**
     * @description: 创建0级瓦片
     * @param {*} x0
     * @param {*} y0
     * @param {*} options
     * @return {*}
     */
    _createZeroTile(x0, y0, options) {
        const z0 = 0;
        const k1 = 0.5 * options.buffer / options.extent;
        const scale = 1 >> z0;
        const idZero = toID(z0, x0, y0);

        const xMin = x0 * scale;
        const xMax =  (x0 + 1) * scale;
        const yMin = y0 * scale;
        const yMax = (y0 + 1) * scale;

        let tile;
        // 横向裁剪
        const clipWidth = clip(this.features, scale, xMin - k1, xMax + k1, 0, -Infinity, Infinity, options);
        if (clipWidth) {
            const clipFeatures = clip(
                clipWidth,
                scale,
                yMin - k1,
                yMax + k1,
                1,
                -Infinity,
                Infinity,
                options
            );

            if (clipFeatures) {
                this.tiles[idZero] = transform(createTile(clipFeatures, z0, x0, y0, options),  options.extent) 
                this.tiles[idZero].source = clipFeatures;
                tile = this.tiles[idZero];
            }

        }
        return tile;
    }

    getTile(z, x, y) {
        z = +z;
        x = +x;
        y = +y;

        const options = this.options;
        const {extent, debug} = options;

        if (z < 0 || z > 24) return null;

        // 去除warp操作，目前坐标系是无限延伸的，不能warp范围
        // const z2 = 1 << z;
        // x = (x + z2) & (z2 - 1); // wrap tile x coordinate
        const id = toID(z, x, y);
        if (this.tiles[id]) {
            return transform(this.tiles[id], extent);
        } else if (z === 0) {
            return this._createZeroTile(x, y, options);
        }

        if (debug > 1) console.log('drilling down to z%d-%d-%d', z, x, y);

        let z0 = z;
        let x0 = x;
        let y0 = y;
        let parent;

        while (!parent && z0 > 0) {
            z0--;
            x0 = x0 >> 1;
            y0 = y0 >> 1;
            const idZero = toID(z0, x0, y0);
            parent = this.tiles[idZero];
            if (z0 === 0 && !parent) {
                parent = this._createZeroTile(x0, y0, options);
            }
        }
        if (!parent || !parent.source) return null;

        // if we found a parent tile containing the original geometry, we can drill down from it
        if (debug > 1) {
            console.log('found parent tile z%d-%d-%d', z0, x0, y0);
            console.time('drilling down');
        }
        this.splitTile(parent.source, z0, x0, y0, z, x, y);
        if (debug > 1) console.timeEnd('drilling down');

        return this.tiles[id] ? transform(this.tiles[id], extent) : null;
    }
}

/**
 * @description: 瓦片编码方式（此插件默认的编码方式在0级多张瓦片时会导致瓦片重复）
 * @param {*} z
 * @param {*} x
 * @param {*} y
 * @return {*}
 */
function toID(z, x, y) {
    return  x.toString(36) + y.toString(36) + z.toString(36);
}

function extend(dest, src) {
    for (const i in src) dest[i] = src[i];
    return dest;
}

export default function geojsonvt(data, options) {
    return new GeoJSONVT(data, options);
}
