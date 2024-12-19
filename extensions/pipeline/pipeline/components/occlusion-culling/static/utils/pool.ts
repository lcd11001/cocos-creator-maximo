import { Vec3, Vec2, Quat, Mat4, Vec4 } from 'cc';

export class PrivatePool<T> {
    _pool: T[] = [];
    _ctor: new () => T;

    constructor (ctor: new () => T) {
        this._ctor = ctor;
    }

    get (): T {
        let instance = this._pool.pop()! as T;
        if (!instance) {
            instance = new this._ctor();
        }
        return instance;
    }

    put (instance: T) {
        this._pool.push(instance);
    }
}

export let Pool = {
    Vec2: new PrivatePool(Vec2),
    Vec3: new PrivatePool(Vec3),
    Vec4: new PrivatePool(Vec4),
    Quat: new PrivatePool(Quat),
    Mat4: new PrivatePool(Mat4),
}
