(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["gojs"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("gojs"));
  } else {
    root.ParallelRouteLink = factory(root.go);
  }
})(typeof self !== "undefined" ? self : this, function (go) {
  if (!go) {
    throw new Error("ParallelRouteLink requires GoJS");
  }

  class ParallelRouteLink extends go.Link {
    constructor(init) {
      super();
      this._parallelSpacing = 10;
      if (init) Object.assign(this, init);
    }

    get parallelSpacing() {
      return this._parallelSpacing;
    }

    set parallelSpacing(value) {
      let spacing = Number(value);
      if (!Number.isFinite(spacing) || spacing < 0) spacing = 0;
      if (this._parallelSpacing !== spacing) {
        this._parallelSpacing = spacing;
        this.invalidateRoute();
      }
    }

    /**
     * Collect all ParallelRouteLink instances connecting the same pair of ports.
     * @returns {Array<ParallelRouteLink>}
     */
    _collectParallelLinks() {
      const diagram = this.diagram;
      if (!diagram) return [this];
      const fromNode = this.fromNode;
      const toNode = this.toNode;
      const fromPortId = this.fromPortId || "";
      const toPortId = this.toPortId || "";
      const links = [];

      diagram.links.each((link) => {
        if (!(link instanceof ParallelRouteLink)) return;
        if (link.fromNode !== fromNode || link.toNode !== toNode) return;
        const linkFromPortId = link.fromPortId || "";
        const linkToPortId = link.toPortId || "";
        if (linkFromPortId !== fromPortId || linkToPortId !== toPortId) return;
        if (link.isOrthogonal || link.curve === go.Curve.Bezier) return;
        links.push(link);
      });

      const sortValue = (link) => {
        const data = link.data || {};
        if (typeof data.parallelIndex === "number") return data.parallelIndex;
        return 0;
      };

      const model = diagram.model;
      links.sort((a, b) => {
        const diff = sortValue(a) - sortValue(b);
        if (diff !== 0) return diff;
        if (model && typeof model.getKeyForLinkData === "function") {
          const keyA = model.getKeyForLinkData(a.data);
          const keyB = model.getKeyForLinkData(b.data);
          if (keyA < keyB) return -1;
          if (keyA > keyB) return 1;
        }
        return 0;
      });

      return links;
    }

    computeCurviness() {
      const base = go.Link.prototype.computeCurviness.call(this);
      if (base !== 0) return base;
      if (this.isOrthogonal || this.curve === go.Curve.Bezier) return base;

      const spacing = this.parallelSpacing;
      if (!spacing) return base;

      const parallels = this._collectParallelLinks();
      if (parallels.length <= 1) return base;

      const index = parallels.indexOf(this);
      if (index < 0) return base;

      const mid = (parallels.length - 1) / 2;
      const offset = (index - mid) * spacing;
      if (Math.abs(offset) < 0.01) return 0;
      return offset;
    }

    computePoints() {
      const result = go.Link.prototype.computePoints.call(this);
      if (!this.isOrthogonal && this.curve !== go.Curve.Bezier && this.hasCurviness()) {
        const curv = this.computeCurviness();
        if (curv !== 0) {
          const num = this.pointsCount;
          let pidx = 0;
          let qidx = num - 1;
          if (num >= 4) {
            pidx++;
            qidx--;
          }
          const frompt = this.getPoint(pidx);
          const topt = this.getPoint(qidx);
          const dx = topt.x - frompt.x;
          const dy = topt.y - frompt.y;
          let mx = frompt.x + (dx * 1) / 8;
          let my = frompt.y + (dy * 1) / 8;
          let px = mx;
          let py = my;
          if (-0.01 < dy && dy < 0.01) {
            if (dx > 0) py -= curv;
            else py += curv;
          } else {
            const slope = -dx / dy;
            let e = Math.sqrt((curv * curv) / (slope * slope + 1));
            if (curv < 0) e = -e;
            px = (dy < 0 ? -1 : 1) * e + mx;
            py = slope * (px - mx) + my;
          }
          mx = frompt.x + (dx * 7) / 8;
          my = frompt.y + (dy * 7) / 8;
          let qx = mx;
          let qy = my;
          if (-0.01 < dy && dy < 0.01) {
            if (dx > 0) qy -= curv;
            else qy += curv;
          } else {
            const slope = -dx / dy;
            let e = Math.sqrt((curv * curv) / (slope * slope + 1));
            if (curv < 0) e = -e;
            qx = (dy < 0 ? -1 : 1) * e + mx;
            qy = slope * (qx - mx) + my;
          }
          this.insertPointAt(pidx + 1, px, py);
          this.insertPointAt(qidx + 1, qx, qy);
        }
      }
      return result;
    }
  }

  return ParallelRouteLink;
});
