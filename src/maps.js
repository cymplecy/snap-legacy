/*

    maps.js

    a slippy maps tile client for morphic.js and Snap!

    written by Jens Mönig
    jens@moenig.org

    Copyright (C) 2019 by Jens Mönig

    This file is part of Snap!.

    Snap! is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of
    the License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.


    prerequisites:
    --------------
    needs morphic.js

    credits:
    --------
    https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
*/

/*global modules, Point, newCanvas, radians*/

// Global stuff ////////////////////////////////////////////////////////

modules.maps = '2019-May-24';

// WorldMap /////////////////////////////////////////////////////////////

function WorldMap() {
    this.url = 'api.tiles.mapbox.com/v4/mapbox.streets';
    // this.url = 'tile.openstreetmap.org';
    // this.url = 'maps.wikimedia.org/osm-intl';
    // this.subdomains = ['a', 'b', 'c'];
    this.apiSuffix = '?access_token=' +
        'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.' +
        'rJcFIG214AriISLbB6B5aw';
    this.lon = -122.257852;
    this.lat = 37.872099;
    this.zoom = 13;
    this.minZoom = 0;
    this.maxZoom = 20;
    this.position = new Point(
        this.tileXfromLon(this.lon),
        this.tileYfromLat(this.lat)
    );
    this.extent = new Point(480, 360);
    this.tileSize = 256;
    this.canvas = null;
    this.loading = 0;
}

WorldMap.prototype.setView = function (lon, lat) {
    this.lat = lat;
    this.lon = lon;
    this.refresh();
};

WorldMap.prototype.setZoom = function (num) {
    this.zoom = Math.max(Math.min(this.maxZoom, Math.floor(num)), 0);
    this.refresh();

};

WorldMap.prototype.panBy = function (x, y) {
    this.lon = this.lonFromTileX(this.position.x + (x / this.tileSize));
    this.lat = this.latFromTileY(this.position.y + (y / this.tileSize));
    this.refresh();
};

WorldMap.prototype.refresh = function () {
    this.position = new Point(
        this.tileXfromLon(this.lon),
        this.tileYfromLat(this.lat)
    );
};

WorldMap.prototype.wrapTile = function (n) {
    var max = Math.pow(2, this.zoom);
    return n < 0 ? max - n : n % max;
};

WorldMap.prototype.tileXfromLon = function (lon) {
    return (lon + 180) / 360 * Math.pow(2, this.zoom);
};

WorldMap.prototype.tileYfromLat = function (lat) {
    return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 /
        Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 *
        Math.pow(2, this.zoom);
};

WorldMap.prototype.lonFromTileX = function (x) {
    return x / Math.pow(2, this.zoom) * 360 - 180;
};

WorldMap.prototype.latFromTileY = function (y) {
    var n = Math.PI - 2 * Math.PI * y / Math.pow(2, this.zoom);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

WorldMap.prototype.lonFromSnapX = function (x) {
    return this.lonFromTileX(this.position.x + (x / this.tileSize));
};

WorldMap.prototype.latFromSnapY = function (y) {
    return this.latFromTileY(this.position.y - (y / this.tileSize));
};

WorldMap.prototype.snapXfromLon = function (lon) {
    return (this.tileXfromLon(lon) - this.position.x) * this.tileSize;
};

WorldMap.prototype.snapYfromLat = function (lat) {
    return (this.tileYfromLat(lat) - this.position.y) * -this.tileSize;
};

WorldMap.prototype.distanceInKm = function(lat1, lon1, lat2, lon2) {
    // haversine formula:
    var R = 6371, // radius of the earth in km
        dLat = radians(lat2 - lat1),
        dLon = radians(lon2 - lon1),
        a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(radians(lat1)) * Math.cos(radians(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2),
        c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

WorldMap.prototype.render = function () {
    var cntr = this.extent.divideBy(2),
        size = this.tileSize,
        tile = this.position.floor(),
        off = new Point(
            this.position.x % 1,
            this.position.y % 1
        ).multiplyBy(size),
        tileOrigin = cntr.subtract(off),
        tileDistance = tileOrigin.floorDivideBy(size).add(1),
        tileGrid = this.extent.floorDivideBy(size).add(2),
        originTile = tile.subtract(tileDistance),
        mapOrigin = tileOrigin.subtract(
            tileDistance.multiplyBy(size)
        ),
        // sub = 0,
        myself = this,
        max = Math.pow(2, this.zoom),
        x, y, img, ctx, tileX, tileY;

    function ok() {
        myself.loading -= 1;
        ctx.drawImage(
            this,
            mapOrigin.x + (this.cx * size),
            mapOrigin.y + (this.cy * size)
        );
    }
    
    function err() {
        myself.loading -= 1;
    }

    this.canvas = newCanvas(this.extent, true);
    ctx = this.canvas.getContext('2d');
    for (x = 0; x < tileGrid.x; x += 1) {
        for (y = 0; y < tileGrid.y; y += 1) {
            tileX = this.wrapTile(originTile.x + x);
            tileY = originTile.y + y;
            if ((tileX >= 0 && tileX < max) && (tileY >= 0 && tileY < max)) {
                img = new Image();
                img.cx = x;
                img.cy = y;
                img.crossOrigin = ''; // anonymous
                img.onload = ok;
                img.onerror = err;
                myself.loading += 1;
                img.src = 'https://' +
                    // this.subdomains[sub] + '.' +
                    this.url + '/' +
                    this.zoom + '/' +
                    tileX + '/' +
                    tileY + '.png' +
                    this.apiSuffix;
                /*
                sub += 1;
                if (sub === this.subdomains.length) {
                    sub = 0;
                }
                */
            }
        }
    }
};
