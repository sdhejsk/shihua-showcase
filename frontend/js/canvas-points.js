export function createCanvasPointLayer(LMap, options = {}) {
  const {
    radius = 3,
    fillColor = "#13a37f",
    strokeColor = "#ffffff",
    strokeWidth = 0.75,
    hitRadiusSq = 36 * 36,
    opacity = 0.92
  } = options;

  let items = [];
  let latLngBounds = null;
  let onPick = null;
  let frame = 0;
  let sprite = null;

  function ensureSprite() {
    if (sprite) return sprite;
    const size = Math.max(8, Math.ceil(radius * 4));
    sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const ctx = sprite.getContext("2d");
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius + (strokeWidth || 0), 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
    return sprite;
  }

  function computeBounds() {
    if (!items.length) {
      latLngBounds = null;
      return;
    }
    latLngBounds = LMap.latLngBounds(items.map(item => item.latlng));
  }

  const canvasLayer = new (LMap.Layer.extend({
    onAdd(layerMap) {
      this._map = layerMap;
      this._canvas = LMap.DomUtil.create("canvas");
      this._canvas.style.pointerEvents = "none";
      this._canvas.style.background = "transparent";
      this._ctx = this._canvas.getContext("2d");
      layerMap.getPanes().overlayPane.appendChild(this._canvas);
      layerMap.on("moveend zoomend resize viewreset", this._scheduleDraw, this);
      layerMap.on("click", this._handleClick, this);
      this._scheduleDraw();
    },
    onRemove(layerMap) {
      layerMap.off("moveend zoomend resize viewreset", this._scheduleDraw, this);
      layerMap.off("click", this._handleClick, this);
      LMap.DomUtil.remove(this._canvas);
      this._canvas = null;
      this._ctx = null;
      this._map = null;
    },
    getBounds() {
      return latLngBounds || LMap.latLngBounds([[0, 0], [0, 0]]);
    },
    setItems(nextItems) {
      items = Array.isArray(nextItems) ? nextItems : [];
      computeBounds();
      if (this._map) this._scheduleDraw();
      return this;
    },
    appendItems(nextItems) {
      if (!Array.isArray(nextItems) || !nextItems.length) return this;
      if (latLngBounds) {
        for (const item of nextItems) {
          if (item?.latlng) latLngBounds.extend(item.latlng);
        }
      }
      items = items.concat(nextItems);
      if (!latLngBounds) computeBounds();
      if (this._map) this._scheduleDraw();
      return this;
    },
    clear() {
      return this.setItems([]);
    },
    getItems() {
      return items;
    },
    setPickHandler(fn) {
      onPick = typeof fn === "function" ? fn : null;
      return this;
    },
    _scheduleDraw() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        this._draw();
      });
    },
    _draw() {
      if (!this._map || !this._ctx || !this._canvas) return;
      const size = this._map.getSize();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(size.x * dpr);
      const h = Math.round(size.y * dpr);
      if (this._canvas.width !== w) this._canvas.width = w;
      if (this._canvas.height !== h) this._canvas.height = h;
      if (this._canvas.style.width !== `${size.x}px`) this._canvas.style.width = `${size.x}px`;
      if (this._canvas.style.height !== `${size.y}px`) this._canvas.style.height = `${size.y}px`;
      const ctx = this._ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);
      const topLeft = this._map.containerPointToLayerPoint([0, 0]);
      LMap.DomUtil.setPosition(this._canvas, topLeft);
      if (!items.length) return;
      ctx.globalAlpha = opacity;
      const r = radius;
      const pointSprite = ensureSprite();
      const spriteHalf = pointSprite.width / 2;
      const visibleBounds = this._map.getBounds().pad(0.1);
      const zoom = this._map.getZoom();
      const cellSize = zoom <= 3 ? 3 : zoom <= 6 ? 2 : 1;
      const drawnCells = cellSize > 1 ? new Set() : null;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item?.latlng) continue;
        if (!visibleBounds.contains(item.latlng)) continue;
        const point = this._map.latLngToContainerPoint(item.latlng);
        if (point.x < -r || point.y < -r || point.x > size.x + r || point.y > size.y + r) continue;
        if (drawnCells) {
          const cellKey = `${(point.x / cellSize) | 0},${(point.y / cellSize) | 0}`;
          if (drawnCells.has(cellKey)) continue;
          drawnCells.add(cellKey);
        }
        ctx.drawImage(pointSprite, point.x - spriteHalf, point.y - spriteHalf);
      }
      ctx.globalAlpha = 1;
    },
    _handleClick(event) {
      if (!this._map) return;
      let best = null;
      let bestDistance = hitRadiusSq;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item?.latlng) continue;
        const point = this._map.latLngToContainerPoint(item.latlng);
        const dx = point.x - event.containerPoint.x;
        const dy = point.y - event.containerPoint.y;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = item.feature;
        }
      }
      if (best && onPick) onPick(best, event);
    }
  }))();

  return canvasLayer;
}
