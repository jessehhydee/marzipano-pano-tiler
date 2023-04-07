const fs                = require('fs');
const { joinImages }    = require('join-images');
const sharp             = require('sharp');
const { convertImage }  = require("panorama-to-cubemap");

const imagesDir           = 'input';
const outputDir           = 'output';
const layers              = 4;
const images              = [];
const fileNameConversions = {
  nx: 'r',
  ny: 'd',
  nz: 'f',
  px: 'l',
  py: 'u',
  pz: 'b'
};

const getImages = async () => {

  const dirs = await fs.promises.readdir(`${imagesDir}/`);

  for(const filePath of dirs) {

    if(filePath === '.gitkeep') continue;
    if(await calcAspectRatio(`${imagesDir}/${filePath}`) !== '2:1') {
      console.log(`\x1b[31m${filePath} aspect ratio does not equal 2:1\x1b[0m`);
      process.exit(1);
    }

    images.push(filePath);

  }

  console.log('..\x1b[92mimages fetched\x1b[0m\n');

};

const calcAspectRatio = async (image) => {

  const gcd = (a, b) => {
    return b ? gcd(b, a % b) : a;
  };

  const dimensions  = await getImageDimensions(image);
  const divisor     = gcd(dimensions.w, dimensions.h);

  return `${dimensions.w / divisor}:${dimensions.h / divisor}`;

};

const createPanos = async () => {

  for(const image of images) {
    const cubeMapDir = await createCubeMap(image);
    await createPreviewImage(image, cubeMapDir);
    createTiles(image, cubeMapDir);
  };

};

const createCubeMap = async (image) => {

  const options = {
    outtype:  "buffer",
    width:    2048
  };
  
  const dir     = `${outputDir}/${getImageName(image)}/cube-map`;
  const cubeMap = await convertImage(`${imagesDir}/${image}`, options);

  for(let i = 0; i < cubeMap.length; i++) {

    cubeMap[i].filename = `${dir}/${fileNameConversions[getImageName(cubeMap[i].filename)]}.jpg`;

    if(!fs.existsSync(dir)) fs.mkdirSync(dir, { 
      recursive: true 
    });
    fs.writeFileSync(cubeMap[i].filename, cubeMap[i].buffer, "binary");

  };

  console.log('..\x1b[92mcubemap created\x1b[0m\n');

  return dir;

};

const createPreviewImage = async (image, cubeMapDir) => {

  const previewPath   = `${outputDir}/${getImageName(image)}/preview.jpg`;
  const cubeMapImages = (await fs.promises.readdir(`${cubeMapDir}/`)).map(el => `${cubeMapDir}/${el}`);

  const preview = await joinImages(cubeMapImages);
  await preview.toFile(previewPath);

  const resized = await sharp(previewPath).resize({width: 256}).toBuffer();
  await sharp(resized).toFile(previewPath);

  console.log(`..\x1b[36m${getImageName(image)} - preview created\x1b[0m`);

  return;

};

const createTiles = async (image, cubeMapDir) => {

  const cubeMapImages = await fs.promises.readdir(`${cubeMapDir}/`);

  let tileHeight = 1;
  for(let layer = 0; layer < layers; layer++) {
    for(let i = 0; i < cubeMapImages.length; i++) {
      const dimensions = await getImageDimensions(`${cubeMapDir}/${cubeMapImages[i]}`);
      for(let e = 0; e < tileHeight; e++) {

        const dir = `${outputDir}/${getImageName(image)}/${layer + 1}/${getImageName(cubeMapImages[i])}/${e}/`;
        if(!fs.existsSync(dir)) fs.mkdirSync(dir, { 
          recursive: true 
        });

        if(layer === 0) sharp(`${cubeMapDir}/${cubeMapImages[i]}`).resize({width: 512}).toFile(`${dir}/0.jpg`);
        else {
          for(let o = 0; o < tileHeight; o++)
            sharp(`${cubeMapDir}/${cubeMapImages[i]}`)
              .extract({
                width:  dimensions.w / tileHeight, 
                height: dimensions.h / tileHeight, 
                left:   dimensions.w / tileHeight * o, 
                top:    dimensions.h / tileHeight * e
              })
              .resize({
                width:  512
              })
              .toFile(`${dir}/${o}.jpg`);
        }
      };
    };
    tileHeight *= 2;
    console.log(`..\x1b[36m${getImageName(image)} - layer ${layer} created\x1b[0m`);
  };

};

const getImageName = (image) => {
  return image.split('.')[0];
};

const getImageDimensions = async (imagePath) => {

  const metaData = await sharp(imagePath).metadata();

  return {
    w:  Math.floor(metaData.width),
    h:  Math.floor(metaData.height),
  };

};

const run = async () => {

  await getImages();
  await createPanos();

};

run();
