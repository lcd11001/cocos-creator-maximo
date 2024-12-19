import { clamp, Color, Component, Material, Vec4, _decorator } from 'cc';
import { CameraSetting } from '../../camera-setting';

const { ccclass, property, type, executeInEditMode } = _decorator;

class FExponentialHeightFogSceneData {
    Height = 0;
    Density = 0;
    HeightFalloff = 0;
};

let FogData = [new FExponentialHeightFogSceneData, new FExponentialHeightFogSceneData]
let FogColor = new Vec4

const NumFogs = 2;
let CollapsedFogParameter = new Array(NumFogs).fill(0);

const _tempFogInscatteringColor = new Color;

let _empty = new Array(4).fill(0);

export let fogUBO = {
    fog_Parameters: new Vec4,
    fog_Parameters2: new Vec4,
    fog_Parameters3: new Vec4,
    fog_ColorParameters: new Vec4,

    update (setter: any, material: Material) {
        setter.setVec4('fog_Parameters', this.fog_Parameters)
        setter.setVec4('fog_Parameters2', this.fog_Parameters2)
        setter.setVec4('fog_Parameters3', this.fog_Parameters3)
        setter.setVec4('fog_ColorParameters', this.fog_ColorParameters)
    },

    reset () {
        this.fog_Parameters.w = 1000000;
    }
}


@ccclass('SecondExponentialHeightFog')
export class SecondExponentialHeightFog {
    @property
    fogDensity = 0.02;

    /**
    * Height density factor, controls how the density increases as height decreases.
    * Smaller values make the visible transition larger.
    */
    @property
    fogHeightFalloff = 0.2;

    /** Height offset, relative to the actor position Z. */
    @property
    fogHeightOffset = 0.0;
}

@ccclass('ExponentialHeightFog')
@executeInEditMode
export class ExponentialHeightFog extends Component {
    static instance: ExponentialHeightFog | undefined = undefined;

    _dirty = true;

    @property
    _fogDensity = 0.02;
    @property
    get fogDensity () {
        return this._fogDensity;
    }
    set fogDensity (v) {
        this._fogDensity = v;
        this._dirty = true;
    }
    @property
    _fogHeightFalloff = 0.2;
    @property
    get fogHeightFalloff () {
        return this._fogHeightFalloff;
    }
    set fogHeightFalloff (v) {
        this._fogHeightFalloff = v;
        this._dirty = true;
    }

    /** Settings for the second fog. Setting the density of this to 0 means it doesn't have any influence. */
    @type(SecondExponentialHeightFog)
    _secondFogData = new SecondExponentialHeightFog;
    @type(SecondExponentialHeightFog)
    get secondFogData () {
        return this._secondFogData;
    }
    set secondFogData (v) {
        this._secondFogData = v;
        this._dirty = true;
    }

    @property
    _fogInscatteringColor = new Vec4;
    @property
    get fogInscatteringColor () {
        return this._fogInscatteringColor;
    }
    set fogInscatteringColor (v) {
        this._fogInscatteringColor = v;
        this._dirty = true;
    }

    @property
    get fogInscatteringColorSetter () {
        _tempFogInscatteringColor.set(this._fogInscatteringColor.x * 255, this._fogInscatteringColor.y * 255, this._fogInscatteringColor.z * 255, this._fogInscatteringColor.w * 255);
        return _tempFogInscatteringColor;
    }
    set fogInscatteringColorSetter (v) {
        this._fogInscatteringColor.set(v.x, v.y, v.z, v.w);
        this._dirty = true;
    }

    /** 
     * Maximum opacity of the fog.  
     * A value of 1 means the fog can become fully opaque at a distance and replace scene color completely,
     * A value of 0 means the fog color will not be factored in at all.
     */
    @property
    _fogMaxOpacity = 1.;
    @property
    get fogMaxOpacity () {
        return this._fogMaxOpacity;
    }
    set fogMaxOpacity (v) {
        this._fogMaxOpacity = v;
        this._dirty = true;
    }

    /** Distance from the camera that the fog will start, in world units. */
    @property
    _startDistance = 0.;
    @property
    get startDistance () {
        return this._startDistance;
    }
    set startDistance (v) {
        this._startDistance = v;
        this._dirty = true;
    }

    /** Scene elements past this distance will not have fog applied.  This is useful for excluding skyboxes which already have fog baked in. */
    @property
    _fogCutoffDistance = 0.;
    @property
    get fogCutoffDistance () {
        return this._fogCutoffDistance;
    }
    set fogCutoffDistance (v) {
        this._fogCutoffDistance = v;
        this._dirty = true;
    }

    inscatteringColorCubemap = null;
    inscatteringTextureTint = new Vec4;

    onEnable () {
        this._dirty = true;

        ExponentialHeightFog.instance = this;
    }
    onDisable () {
        if (ExponentialHeightFog.instance === this) {
            ExponentialHeightFog.instance = undefined;
        }

        fogUBO.reset();
    }

    update () {
        if (this._dirty) {
            this._dirty = false;
            this.updateUBO();
        }
    }

    updateFogData () {
        let secondFogData = this.secondFogData!;

        FogData[0].Height = this.node.worldPosition.z;
        FogData[1].Height = FogData[0].Height + secondFogData.fogHeightOffset;

        // Scale the densities back down to their real scale
        // Artists edit the densities scaled up so they aren't entering in minuscule floating point numbers
        FogData[0].Density = this.fogDensity / 10.0;
        FogData[0].HeightFalloff = this.fogHeightFalloff / 10.0;
        FogData[1].Density = secondFogData.fogDensity / 10.0;
        FogData[1].HeightFalloff = secondFogData.fogHeightFalloff / 10.0;

        FogColor = this.inscatteringColorCubemap ? this.inscatteringTextureTint : this.fogInscatteringColor;
    }

    updateUBO () {
        this.updateFogData();

        let MaxObserverHeight = 10e5;
        const MaxObserverHeightDifference = 65536.0;

        for (let i = 0; i < NumFogs; i++) {
            // Only limit the observer height to fog if it has any density
            if (FogData[i].Density > 0.0) {
                MaxObserverHeight = Math.min(MaxObserverHeight, FogData[i].Height + MaxObserverHeightDifference);
            }
        }

        let ObserverHeight = 10;
        let camera = CameraSetting.mainCamera;
        if (camera) {
            ObserverHeight = Math.min(camera.node.worldPosition.y, MaxObserverHeight);
        }

        for (let i = 0; i < CollapsedFogParameter.length; i++) {
            let CollapsedFogParameterPower = clamp(
                -FogData[i].HeightFalloff * (ObserverHeight - FogData[i].Height),
                -126. + 1., // min and max exponent values for IEEE floating points (http://en.wikipedia.org/wiki/IEEE_floating_point)
                +127. - 1.
            );

            CollapsedFogParameter[i] = FogData[i].Density * Math.pow(2.0, CollapsedFogParameterPower);
        }

        fogUBO.fog_Parameters.set(CollapsedFogParameter[0], FogData[0].HeightFalloff, MaxObserverHeight, this.startDistance)
        fogUBO.fog_Parameters2.set(CollapsedFogParameter[1], FogData[1].HeightFalloff, FogData[1].Density, FogData[1].Height)
        fogUBO.fog_Parameters3.set(FogData[0].Density, FogData[0].Height, this.inscatteringColorCubemap ? 1.0 : 0.0, this.fogCutoffDistance)
        fogUBO.fog_ColorParameters.set(FogColor.x, FogColor.y, FogColor.z, 1 - this.fogMaxOpacity)
    }
}
