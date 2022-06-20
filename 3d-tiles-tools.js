'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var GltfPipeline = require('gltf-pipeline');
var Promise = require('bluebird');
var zlib = require('zlib');
var extractB3dm = require('./lib/extractB3dm');
var fileExists = require('./lib/fileExists');
var glbToB3dm = require('./lib/glbToB3dm');
var isGzipped = require('./lib/isGzipped');
var zlibGunzip = Promise.promisify(zlib.gunzip);
var zlibGzip = Promise.promisify(zlib.gzip);
var DeveloperError = Cesium.DeveloperError;
var statistics=GltfPipeline.getStatistics;
var glbToGltf = GltfPipeline.glbToGltf;
var gltfToGlb = GltfPipeline.gltfToGlb;
// command line supplied flags
const spawn = require('child_process').spawn;
const execSync = require('child_process').execSync;
const fs = require('fs');
const path = require('path');
// command line supplied flags
var gltfKtxCompressor_makeExtensionRequired = true;
var gltfKtxCompressor_keepFallbackTextureImage = false;
var gltfKtxCompressor_inputFilePath = null;
var gltfKtxCompressor_outputFilePath = null;
let khrTextureBasisU_extensionName = "KHR_texture_basisu";

function convertReferencedImage(gltf, imageIndex, toKtxArgs) {
    let image = gltf.images[imageIndex];

    let outGltfPath = gltfKtxCompressor_outputFilePath.substring(0, gltfKtxCompressor_outputFilePath.lastIndexOf(path.sep) + 1);
    let outImagePath = image.uri.substring(0, image.uri.lastIndexOf("."));
    outImagePath += ".ktx2";
    let outImagePathFull = path.resolve(outGltfPath, outImagePath);
    toKtxArgs.push(outImagePathFull);

    let inGltfPath = gltfKtxCompressor_inputFilePath.substring(0, gltfKtxCompressor_inputFilePath.lastIndexOf(path.sep) + 1);
    let inImagePath = image.uri;
    let inImagePathFull = path.join(inGltfPath, inImagePath);
    toKtxArgs.push(inImagePathFull);
    // runToKtx(toKtxArgs);
    toKtxArgs.unshift("--t2 --bcmp");
    let command = 'toktx.exe';
    for (let i = 0; i < toKtxArgs.length; ++i) {
        command += " " + toKtxArgs[i];
    }
    console.log(command);
    const output = execSync(command, {stdio: 'inherit'});
    if (gltfKtxCompressor_keepFallbackTextureImage) {
        imageIndex = gltf.images.push(Object.assign({}, gltf.images[imageIndex])) - 1;
    }

    gltf.images[imageIndex].uri = outImagePath;
    return imageIndex;
}


function addKtxExtensionToGltf(gltf) {
    if (gltfKtxCompressor_makeExtensionRequired) {
        if (!gltf.extensionsRequired) {
            gltf.extensionsRequired = [];
        }
        gltf.extensionsRequired.push(khrTextureBasisU_extensionName);
    }
    if (!gltf.extensionsUsed) {
        gltf.extensionsUsed = [];
    }
    gltf.extensionsUsed.push(khrTextureBasisU_extensionName);
}

function isDataUrl(url) {
    return url.match(isDataUrl.regex);
}
isDataUrl.regex = /^\s*data:([a-z]+\/[a-z]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i;

function getImageType(url) {
    return url.substring(url.lastIndexOf(".") + 1, url.length);
}
let supportedImageTypes = ["pam", "ppm", "pgm", "png","jpg","jpeg"]
function isSupportedImageType(type) {
    return supportedImageTypes.includes(type.toLowerCase());
}

async function rmFiles(files){
    console.log("shanchu")
    for(let i=0; i<files.length; i++) {
        const file=files[i];
        const filetmp=file.substring(0, file.lastIndexOf("\\")) + "\\";
        fs.readdir(path.join(filetmp), function (err, filerm) {
            if (err) {
                console.log(err);
            }
            filerm.forEach(item => {
                if (item.indexOf('gltf') > -1 || item.indexOf('ktx2') > -1 || item.indexOf('jpg') > -1) {
                    fs.rmSync(path.join(filetmp, item))
                }
            })
        })
    }
}

function processCommandLineArgs(args) {
    let toKtxArgs = [];
    gltfKtxCompressor_inputFilePath = args;
    gltfKtxCompressor_outputFilePath=args;
    return toKtxArgs;
}

function copyGltfBuffers(gltf, gltfKtxCompressor_inputFilePath, gltfKtxCompressor_outputFilePath) {
    let inputname=gltfKtxCompressor_inputFilePath.substring(0, gltfKtxCompressor_inputFilePath.lastIndexOf("//"))+ buffer.uri;
    let outputname=gltfKtxCompressor_outputFilePath.substring(0, gltfKtxCompressor_outputFilePath.lastIndexOf("//"))+ buffer.uri;
    if (gltf.buffers){
        for (let i = 0; i < gltf.buffers.length; ++i) {
            let buffer = gltf.buffers[i];
            if (isDataUrl(buffer.uri)){
                fs.copyFileSync(inputname, outputname);
            }
        }
    }

}

let toKtxArgs = [];


function checkFileOverwritable(file, force) {
    if (force) {
        return Promise.resolve();
    }
    return fileExists(file)
        .then(function (exists) {
            if (exists) {
                throw new DeveloperError('File ' + file + ' already exists. Specify -f or --force to overwrite existing files.');
            }
        });
}


async function compress(inputPath, compression, decode) {
    var gzipped;
    var b3dm;
    return checkFileOverwritable(inputPath, true)
        .then(function() {
            //console.log(`READING ${inputPath}`);
            return fsExtra.readFile(inputPath);
        })
        .then(function(fileBuffer) {
            gzipped = isGzipped(fileBuffer);
            if (isGzipped(fileBuffer)) {
                return zlibGunzip(fileBuffer);
            }
            return fileBuffer;
        })
        .then(function(fileBuffer) {
            b3dm = extractB3dm(fileBuffer);
            let filename=inputPath.substring(0,inputPath.indexOf("."));
            var filename1=inputPath.substring(0,inputPath.lastIndexOf("\\"))+"\\";
            let gltfname=filename+".gltf";

            glbToGltf(b3dm.glb).then(function (res) {
                //console.log(`${inputPath} before compress`,statistics(res.gltf).toString())
                    const options = {
                        separateTextures: true,

                    };
                    GltfPipeline.processGltf(res.gltf,options).then(function (results) {

                        // Save separate resources
                        const separateResources = results.separateResources;
                        for (const relativePath in separateResources) {
                            if (separateResources.hasOwnProperty(relativePath)) {
                                const resource = separateResources[relativePath];
                                console.log(filename1+" image "+relativePath)
                                fsExtra.writeFileSync(filename1+relativePath, resource);
                            }
                        }

                        fsExtra.writeJsonSync(gltfname, results.gltf);
                        return gltfname;
                    }).then(function (gltfname) {
                        toKtxArgs = processCommandLineArgs(gltfname);
                        //console.log(gltfKtxCompressor_inputFilePath);
                        fsExtra.readFile(gltfKtxCompressor_inputFilePath, function (err, data) {
                            if (err && err.code === 'ENOENT') {
                                throw new Error(`Input glTF ${gltfKtxCompressor_inputFilePath} is not found.`);
                            } else if (err) {
                                throw err;
                            }
                            var gltf=JSON.parse(data);
                            console.log(`Converting compatible textures in ${gltfKtxCompressor_inputFilePath} to KTX2`)
                            // convertGLTFImagesToKTX(gltf, gltfKtxCompressor_inputFilePath, toKtxArgs);
                            let addKtxExtensionFlag = false;

                            if (gltf.images) {
                                let imagesOriginalLength = gltf.images.length;
                                for (let i = 0; i < imagesOriginalLength; ++i) {
                                    let image = gltf.images[i];
                                    let textureIndex;
                                    if (!isDataUrl(image.uri)) {
                                        let imageType = getImageType(image.uri);
                                        if (isSupportedImageType(imageType)) {
                                            textureIndex = convertReferencedImage(gltf, i, toKtxArgs.slice());

                                            addKtxExtensionFlag = true;
                                            let inputname=gltfKtxCompressor_inputFilePath.substring(0, gltfKtxCompressor_inputFilePath.lastIndexOf("//"))+ image.uri;

                                            let outputname=gltfKtxCompressor_outputFilePath.substring(0, gltfKtxCompressor_outputFilePath.lastIndexOf("//"))+ image.uri;
                                            console.log("inputname:"+inputname+" outputname:"+outputname);
                                            // updateReferencingTextures(gltf, i, textureIndex, gltfKtxCompressor_keepFallbackTextureImage);
                                            for (let j = 0; j < gltf.textures.length; ++j){
                                                let texture = gltf.textures[j];
                                                if (texture.source == i){
                                                    if (!gltfKtxCompressor_keepFallbackTextureImage) {
                                                        delete texture.source;
                                                    }
                                                    if (!texture.extensions){
                                                        texture.extensions = {};
                                                    }
                                                    if (!texture.extensions.KHR_texture_basisu) {
                                                        texture.extensions.KHR_texture_basisu = {};
                                                    }
                                                    texture.extensions.KHR_texture_basisu = { "source": textureIndex };
                                                }
                                            }
                                            if (gltfKtxCompressor_keepFallbackTextureImage) {
                                                fsExtra.copyFile(inputname,outputname);
                                            }
                                        } else {
                                            console.error(`Image type ${imageType} is not supported. (${supportedImageTypes}) Skipping image ${i}...`)
                                        }
                                    } else {
                                        console.error(`Embedded image files are not supported. Skipping image ${i}...`);
                                        continue;
                                    }
                                }
                            }
                            if (addKtxExtensionFlag) {
                                addKtxExtensionToGltf(gltf);
                            }
                            var convertedGltf = gltf;
                            //console.log(`saving converted glTF to ${gltfKtxCompressor_outputFilePath}`);
                            fsExtra.writeJsonSync(gltfKtxCompressor_outputFilePath, convertedGltf, (err) => {
                                if (err) throw err;
                                copyGltfBuffers(gltf, gltfKtxCompressor_inputFilePath, gltfKtxCompressor_outputFilePath);
                                console.log("Conversion complete!");
                            });
                            var filename1=inputPath.substring(0,inputPath.lastIndexOf("\\"))+"\\";

                            var options = {
                                resourceDirectory: `${filename1}`,
                                dracoOptions:true,
                                decodeWebP: true,
                            };
                            var gltfbuffer = fsExtra.readJsonSync(gltfKtxCompressor_outputFilePath);
                            var b3dmpath=gltfKtxCompressor_inputFilePath.substring(0,gltfKtxCompressor_inputFilePath.indexOf("."))+".b3dm";
                            gltfToGlb(gltfbuffer, options).then(function (res) {
                                var b3dmBuffer = glbToB3dm(res.glb, b3dm.featureTable.json, b3dm.featureTable.binary, b3dm.batchTable.json, b3dm.batchTable.binary);

                                if (gzipped) {
                                    var res = zlibGzip(b3dmBuffer);

                                    return res;
                                }
                                fsExtra.writeFileSync(b3dmpath, b3dmBuffer);
                                console.log(b3dmpath+" write done");

                            })
                        });

                    })
            });

        })
        .catch(function (error) {
        console.log("ERROR", error);
        });
}




module.exports = {
    compress
};
