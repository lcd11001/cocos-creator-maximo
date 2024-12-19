import { Vec2, Vec3 } from "cc";

export class HaltonSeq {
    static cache: Map<string, number> = new Map
    public static Get (index: number, radix: number) {
        let key = `${index}_${radix}`;
        let result = this.cache.get(key);

        if (!result) {
            let fraction = 1 / radix;

            result = 0;
            while (index > 0) {
                result += (index % radix) * fraction;

                index /= radix;
                fraction /= radix;
            }

            this.cache.set(key, result);
        }

        return result;
    }
}

export class HaltonUtils {
    static instance = new HaltonUtils;

    sampleIndex = 0;

    private _tempVec2 = new Vec2;
    public Generate2DRandomOffset (sampleCount = 8, index?: number) {
        if (index === undefined) {
            index = this.sampleIndex++;
        }
        index = index % sampleCount;

        // The variance between 0 and the actual halton sequence values reveals noticeable instability
        // in shadow maps, so we avoid index 0.
        this._tempVec2.set(
            (HaltonSeq.Get((index & 1023) + 1, 2) - 0.5),
            (HaltonSeq.Get((index & 1023) + 1, 3) - 0.5)
        );

        return this._tempVec2;
    }

    private _tempVec3 = new Vec3;
    public Generate3DRandomOffset (sampleCount = 8, index?: number) {
        if (index === undefined) {
            index = this.sampleIndex++;
        }
        index = index % sampleCount;

        // The variance between 0 and the actual halton sequence values reveals noticeable instability
        // in shadow maps, so we avoid index 0.
        this._tempVec3.set(
            HaltonSeq.Get((index & 1023) + 1, 2) - 0.5,
            HaltonSeq.Get((index & 1023) + 1, 3) - 0.5,
            HaltonSeq.Get((index & 1023) + 1, 5) - 0.5
        );

        return this._tempVec3;
    }
}
