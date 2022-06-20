#!/usr/bin/env node

const fs = require('fs');
const { readdir } = require('fs').promises;
const path = require('path');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;
const { compress } = require('./3d-tiles-tools');

async function getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return files.flat().filter(e => e.match(/.*\.(b3dm)$/ig))
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

async function main() {
  if (argv.input) {
    const inputDir = path.resolve('', argv.input);
    const files = await getFiles(inputDir);

    if (files.length === 0) {
      console.log(`no .b3dm files in ${inputDir}`);
      process.exit(1)
    }
    for(let i=0; i<files.length; i++) {
      var file = files[i];
      console.log(file);
      await compress(file, argv.quality ? Number(argv.quality) : 100, argv.quality !== undefined);
    }
    //await rmFiles(files)
  } else {
    console.log('缺少--input')
  }



}

main();
