const _ = require("lodash");

module.exports = {
    rgbToHsv: function (rgb) {
        var rr, gg, bb,
            r = rgb.r / 255,
            g = rgb.g / 255,
            b = rgb.b / 255,
            h, s,
            v = Math.max(r, g, b),
            diff = v - Math.min(r, g, b),
            diffc = function (c) {
                return (v - c) / 6 / diff + 1 / 2;
            };

        if (diff == 0) {
            h = s = 0;
        } else {
            s = diff / v;
            rr = diffc(r);
            gg = diffc(g);
            bb = diffc(b);

            if (r === v) {
                h = bb - gg;
            } else if (g === v) {
                h = (1 / 3) + rr - bb;
            } else if (b === v) {
                h = (2 / 3) + gg - rr;
            }
            if (h < 0) {
                h += 1;
            } else if (h > 1) {
                h -= 1;
            }
        }
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            v: Math.round(v * 100)
        };
    },

    hsvToRgb: function (hsv) {
        var h = hsv.h;
        var s = hsv.s;
        var v = hsv.v;

        var r, g, b;
        var i;
        var f, p, q, t;

        h = Math.max(0, Math.min(360, h));
        s = Math.max(0, Math.min(100, s));
        v = Math.max(0, Math.min(100, v));

        s /= 100;
        v /= 100;

        if (s == 0) {
            r = g = b = v;
            return {
                r: Math.round(r * 255).toFixed(0),
                g: Math.round(g * 255).toFixed(0),
                b: Math.round(b * 255).toFixed(0)
            };
        }

        h /= 60;
        i = Math.floor(h);
        f = h - i;
        p = v * (1 - s);
        q = v * (1 - s * f);
        t = v * (1 - s * (1 - f));

        switch (i) {
            case 0:
                r = v;
                g = t;
                b = p;
                break;

            case 1:
                r = q;
                g = v;
                b = p;
                break;

            case 2:
                r = p;
                g = v;
                b = t;
                break;

            case 3:
                r = p;
                g = q;
                b = v;
                break;

            case 4:
                r = t;
                g = p;
                b = v;
                break;

            default:
                r = v;
                g = p;
                b = q;
        }

        return {
            r: Math.round(r * 255).toFixed(0),
            g: Math.round(g * 255).toFixed(0),
            b: Math.round(b * 255).toFixed(0)
        };
    },


    toHex: function (d) {
        return _.padStart((_.clamp(_.round(d), 0,255)||0).toString(16),2,'0').toUpperCase();
    },

    rgbToHex: function (rgb) {
        rgb.r = Number(rgb.r);
        rgb.g = Number(rgb.g);
        rgb.b = Number(rgb.b);
        if (rgb.r > 255 || rgb.g > 255 || rgb.b > 255)
            throw "Invalid color component";
        return "" + ((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1);
    },

    hexToRgb: function (hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function (m, r, g, b) {
            return r + r + g + g + b + b;
        });

        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
};