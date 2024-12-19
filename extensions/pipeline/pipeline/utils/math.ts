import { Vec3, Vec4 } from 'cc';


export function lerp (from: number, to: number, ratio: number, EPLISION = 0.01) {
    let v = from + (to - from) * ratio;
    if (Math.abs(to - v) <= EPLISION) {
        v = to;
    }
    return v;
}

export function vec3_min (out: Vec3, a: Vec3, b: Vec3) {
    out.x = Math.min(a.x, b.x);
    out.y = Math.min(a.y, b.y);
    out.z = Math.min(a.z, b.z);
    return out;
}

export function vec3_max (out: Vec3, a: Vec3, b: Vec3) {
    out.x = Math.max(a.x, b.x);
    out.y = Math.max(a.y, b.y);
    out.z = Math.max(a.z, b.z);
    return out;
}

export function vec3_floor (out: Vec3, a: Vec3) {
    out.x = Math.floor(a.x);
    out.y = Math.floor(a.y);
    out.z = Math.floor(a.z);
    return out;
}

export function vec3_ceil (out: Vec3, a: Vec3) {
    out.x = Math.ceil(a.x);
    out.y = Math.ceil(a.y);
    out.z = Math.ceil(a.z);
    return out;
}

export function roundUp (numToRound: number, multiple: number) {
    if (multiple === 0)
        return numToRound;
    return Math.ceil(numToRound / multiple) * multiple;
}

export function sRGB2Linear (v: number) {
    v /= 255;
    v = Math.pow(v, 2.2);
    return v;
}

export function RGBE2Linear (rgbe: Vec4, out: Vec4) {
    let e = Math.pow(2.0, rgbe.w - 128.0) / 255;
    out.x *= e;
    out.y *= e;
    out.z *= e;
    out.w = 1;
}

export function powerOfTwo (v: number) {
    let target = 1;
    while (target < v) {
        target *= 2;
    }
    return target;
}

export const toHalf16 = (function () {

    var floatView = new Float32Array(1);
    var int32View = new Int32Array(floatView.buffer);

    /* This method is faster than the OpenEXR implementation (very often
     * used, eg. in Ogre), with the additional benefit of rounding, inspired
     * by James Tursa?s half-precision code. */
    return function toHalf16 (val: number) {

        floatView[0] = val;
        var x = int32View[0];

        var bits = (x >> 16) & 0x8000; /* Get the sign */
        var m = (x >> 12) & 0x07ff; /* Keep one extra bit for rounding */
        var e = (x >> 23) & 0xff; /* Using int is faster here */

        /* If zero, or denormal, or exponent underflows too much for a denormal
         * half, return signed zero. */
        if (e < 103) {
            return bits;
        }

        /* If NaN, return NaN. If Inf or exponent overflow, return Inf. */
        if (e > 142) {
            bits |= 0x7c00;
            /* If exponent was 0xff and one mantissa bit was set, it means NaN,
             * not Inf, so make sure we set one mantissa bit too. */
            bits |= ((e == 255) ? 0 : 1) && (x & 0x007fffff);
            return bits;
        }

        /* If exponent underflows but not too much, return a denormal */
        if (e < 113) {
            m |= 0x0800;
            /* Extra rounding may overflow and set mantissa to 0 and exponent
             * to 1, which is OK. */
            bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
            return bits;
        }

        bits |= ((e - 112) << 10) | (m >> 1);
        /* Extra rounding. An overflow will set mantissa to 0 and increment
         * the exponent, which is OK. */
        bits += m & 1;
        return bits;
    };

}());
