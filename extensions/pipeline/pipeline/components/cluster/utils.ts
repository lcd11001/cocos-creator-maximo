import { director, gfx, ImageAsset, ReflectionProbe, TextureCube } from "cc";


export interface ClusterCubemapAtlas {
    texture: gfx.Texture,
    cubemaps: TextureCube[]
    offsets: number[][]
}

enum FaceIndex {
    right = 0,
    left = 1,
    top = 2,
    bottom = 3,
    front = 4,
    back = 5,
}
function _forEachFace (mipmap, callback: (face: ImageAsset, faceIndex: number) => void) {
    callback(mipmap.right, FaceIndex.right);
    callback(mipmap.left, FaceIndex.left);
    callback(mipmap.top, FaceIndex.top);
    callback(mipmap.bottom, FaceIndex.bottom);
    callback(mipmap.front, FaceIndex.front);
    callback(mipmap.back, FaceIndex.back);
}

const faces = ['right', 'left', 'top', 'bottom', 'front', 'back']
export function packCubemapAtlas (cubemaps: TextureCube[]): ClusterCubemapAtlas {
    const device = director.root!.device;
    const maxSize = Math.min(device.capabilities.maxTextureSize, 4096);

    let atlasWidth = 0;
    let atlasHeight = 0;

    let texImages: TexImageSource[] = []
    let regions: gfx.BufferTextureCopy[] = []

    let minMipMapLevel = 8;
    for (let ci = 0; ci < cubemaps.length; ci++) {
        minMipMapLevel = Math.min(minMipMapLevel, cubemaps[ci].mipmapAtlas.layout.length);
    }

    let offsets: number[][] = []

    for (let mi = 0; mi < minMipMapLevel; mi++) {

        let offsetX = 0;
        let offsetY = 0;

        let maxHeight = 0;

        for (let ci = 0; ci < cubemaps.length; ci++) {
            const cubemap = cubemaps[ci];
            cubemap.mipmapAtlas.layout
            let mipmap = cubemap.mipmaps[mi];

            let width = mipmap.front.width * 6;
            let height = mipmap.front.height;
            maxHeight = Math.max(height, maxHeight);

            if ((offsetX + width) > maxSize) {
                offsetY += maxHeight;
                offsetX = 0;
                maxHeight = 0;
            }

            offsets.push([offsetX, offsetY, width, height])

            for (let fi = 0; fi < faces.length; fi++) {
                let img = (mipmap as any)[faces[fi]] as ImageAsset;
                texImages.push(img.data as HTMLImageElement)

                regions.push(new gfx.BufferTextureCopy(undefined, undefined,
                    img.height,
                    new gfx.Offset(offsetX, offsetY),
                    new gfx.Extent(img.width, img.height),
                    new gfx.TextureSubresLayers(mi)
                ))

                offsetX += img.width;
            }
        }

        if (mi === 0) {
            atlasWidth = offsetX;
            atlasHeight = offsetY + maxHeight;
        }
    }

    offsets.forEach(offset => {
        offset[0] = (offset[0]) / atlasWidth;
        offset[1] = (offset[1]) / atlasHeight;
        offset[2] = (offset[2]) / atlasWidth;
        offset[3] = (offset[3]) / atlasHeight;
    })

    let texture = device.createTexture(new gfx.TextureInfo(
        gfx.TextureType.TEX2D,
        gfx.TextureUsageBit.SAMPLED | gfx.TextureUsageBit.TRANSFER_DST,
        gfx.Format.RGBA8,
        atlasWidth,
        atlasHeight,
        gfx.TextureFlagBit.GEN_MIPMAP,
        undefined,
        minMipMapLevel
    ))
    device.copyTexImagesToTexture(texImages, texture, regions)

    // breakIfGlError();

    return {
        texture,
        cubemaps,
        offsets
    };
}