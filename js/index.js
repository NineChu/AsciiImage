const mainElement = document.body.querySelector(`main`);
const imgOriginal = document.getElementById(`imgOriginal`);
const imgGrayscaled = document.getElementById(`imgGrayscaled`);
const imgGrayscaledResized = document.getElementById(`imgGrayscaledResized`);
const preAscii = document.getElementById(`preAscii`);
/** @type { HTMLInputElement } */
const inputAsciiWidth = document.getElementById(`inputAsciiWidth`);

const grayscale = ` _.'^-",:;><~\\/)(+?C*Il!i|][}{1tfjrxnuvczXYUJkhaomwqpdbLQ0OZ#MW&8%B@$`;
const fontRatio = 9 / 20;

/**
 * Display the pixel bytes of a RGBA8 image in the specified <img> tag.
 * @param {Uint8ClampedArray} rgba8Pixels Image's bytes in RGBA8 pixel array.
 * @param {number} width Image's width in pixels.
 * @param {HTMLImageElement} imageElement
 */
function displayRgba8(rgba8Pixels, width, imageElement) {
  const imageData = new ImageData(rgba8Pixels, width);

  const canvas = document.createElement(`canvas`);
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const ctx = canvas.getContext(`2d`);
  ctx.putImageData(imageData, 0, 0);

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);

    imageElement.onload = () => URL.revokeObjectURL(url);
    imageElement.src = url;
  }, `image/png`);
}

/**
 * Receives the pixel bytes of a Grayscale8 image and replicates it to the RGB components.
 * @param {Uint8ClampedArray} pixelBytes Image's bytes in Grayscale8 pixel array.
 * @param {number} width Image's width in pixels.
 * @returns {Uint8ClampedArray} Image's bytes converted to RGBA8 pixel array.
 */
function grayscale8ToRgba8(pixelBytes, width) {
  const rgba8Pixels = new Uint8ClampedArray(pixelBytes.length * 4);

  for (let i = 0, j = 0; i < pixelBytes.length; i++, j += 4) {
    rgba8Pixels[j] = pixelBytes[i];
    rgba8Pixels[j + 1] = pixelBytes[i];
    rgba8Pixels[j + 2] = pixelBytes[i];
    rgba8Pixels[j + 3] = 255;
  }

  return rgba8Pixels;
}

/**
 * Generates the pixel bytes of a Grayscale8 version of a RGBA8 image.
 * @param {Uint8ClampedArray} pixelBytes Image's bytes in RGBA8 pixel array.
 * @param {number} width Image's width in pixels.
 * @returns {Uint8ClampedArray} Image's bytes converted to Grayscale8 pixel array.
 */
function rgba8ToGrayscale8(pixelBytes, width) {
  const grayscaledPixels = new Uint8ClampedArray(pixelBytes.length / 4);

  for (let i = 0, j = 0; i < pixelBytes.length; i += 4, j++) {
    const R = pixelBytes[i];
    const G = pixelBytes[i + 1];
    const B = pixelBytes[i + 2];
    const A = pixelBytes[i + 3];

    grayscaledPixels[j] = (((R + G + B) / 3) * A) / 255;
  }

  return grayscaledPixels;
}

/**
 * Does the length resampling.
 * @param {number} inputLength Input's length.
 * @param {number} outputLength Output's length.
 * @returns
 */
function findLengthWeights(inputLength, outputLength) {
  const r = outputLength / inputLength;
  const weights = [new Map()];
  let j = 0;
  for (let i = 1; i <= inputLength; i++) {
    if (i * r <= j + 1) {
      weights[j].set(i - 1, r);
    } else {
      weights[j++].set(i - 1, r - i * r + j);
      weights.push(new Map([[i - 1, i * r - j]]));
    }
  }
  return weights;
}

/**
 * Does the area resampling with the length resampling vectors.
 * @param {number} inputWidth Input's width.
 * @param {number} inputHeight Input's height.
 * @param {number} outputWidth Output's width.
 * @param {number} outputHeight Output's height.
 * @returns
 */
function findAreaWeights(inputWidth, inputHeight, outputWidth, outputHeight) {
  const widthWeights = findLengthWeights(inputWidth, outputWidth);
  const heightWeights = findLengthWeights(inputHeight, outputHeight);

  const areaWeights = [];

  for (let y = 0; y < heightWeights.length; y++) {
    for (let x = 0; x < widthWeights.length; x++) {
      const weights = new Map();

      for (const [heightIndex, heightValue] of heightWeights[y]) {
        for (const [widthIndex, widthValue] of widthWeights[x]) {
          weights.set(heightIndex * inputWidth + widthIndex, widthValue * heightValue);
        }
      }

      areaWeights.push(weights);
    }
  }

  return areaWeights;
}

/**
 * Receives the pixel bytes of an image in Grayscale8 format and resizes it.
 * @param {Uint8ClampedArray} pixelBytes Image's bytes in Grayscale8 pixel array.
 * @param {number} width Image's width in pixels.
 * @param {number} newWidth New image's width in pixels.
 */
function resizeGrayscale8Image(pixelBytes, width, newWidth) {
  const height = pixelBytes.length / width;
  const newHeight = Math.ceil(height * (newWidth / width) * fontRatio);

  const resizedPixels = new Uint8ClampedArray(newWidth * newHeight);

  const weights = findAreaWeights(width, height, newWidth, newHeight);

  for (let i = 0; i < weights.length; i++) {
    let finalValue = 0;

    for (const [inputPixel, weight] of weights[i]) {
      finalValue += pixelBytes[inputPixel] * weight;
    }

    resizedPixels[i] = finalValue;
  }

  return resizedPixels;
}

/**
 * Transforms each pixel of the image in a character.
 * @param {Uint8ClampedArray} pixelBytes Image's bytes in Grayscale8 pixel array.
 * @param {number} imageWidth Image's width in pixels.
 * @returns {string} Image's bytes converted to an ASCII image string.
 */
function grayscale8ToAscii(pixelBytes, imageWidth) {
  let asciiImage = ``;

  for (let i = 0; i < pixelBytes.length; i++) {
    if (i % imageWidth == 0) asciiImage += `\n`;
    asciiImage += grayscale.charAt((pixelBytes[i] / 256) * grayscale.length);
  }

  return asciiImage.slice(1);
}

/**
 * Main function, all steps to generate the ASCII.
 * @param {Uint8ClampedArray} pixelBytes Image's bytes in RGBA8 pixel array.
 * @param {number} width Image's width in pixels.
 */
function displayAsciiImage(pixelBytes, width) {
  displayRgba8(pixelBytes, width, imgOriginal);

  const grayscaledPixels = rgba8ToGrayscale8(pixelBytes, width);
  const rgba8GrayscaledPixels = grayscale8ToRgba8(grayscaledPixels, width);
  displayRgba8(rgba8GrayscaledPixels, width, imgGrayscaled);

  const grayscaledResizedPixels = resizeGrayscale8Image(grayscaledPixels, width, inputAsciiWidth.value);
  const rgba8Grayscaled8ResizedPixels = grayscale8ToRgba8(grayscaledResizedPixels, inputAsciiWidth.value);
  displayRgba8(rgba8Grayscaled8ResizedPixels, inputAsciiWidth.value, imgGrayscaledResized);

  preAscii.style.fontSize = `${Math.floor((window.innerWidth * 0.6) / inputAsciiWidth.value)}px`;
  preAscii.textContent = grayscale8ToAscii(grayscaledResizedPixels, inputAsciiWidth.value);
}

// Receiving an image via Ctrl + V:
document.addEventListener(`paste`, async (event) => {
  const clipboardData = event.clipboardData;
  const imageItem = [...clipboardData.items].find((item) => item.type.includes(`image`));

  if (!imageItem) return;
  event.preventDefault();

  const imageFile = imageItem.getAsFile();

  const decoder = new ImageDecoder({
    data: await imageFile.arrayBuffer(),
    type: imageFile.type,
  });
  const image = (await decoder.decode()).image;
  const imageWidth = image.displayWidth;
  const pixelBytes = new Uint8ClampedArray(image.allocationSize());
  await image.copyTo(pixelBytes, { format: `RGBA` });

  image.close();
  decoder.close();

  displayAsciiImage(pixelBytes, imageWidth);
});
