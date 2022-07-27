// Perceptual image hash calculation tool based on algorithm descibed in
// Block Mean Value Based Image Perceptual Hashing by Bian Yang, Fan Gu and Xiamu Niu
//
// Updated and deno-ified version of blockhash.js (https://github.com/commonsmachinery/blockhash-js)
import jpeg from "./deps.ts"
import {mimeType} from "./mime-type.ts";

var one_bits = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/* Calculate the hamming distance for two hashes in hex format */
export function hammingDistance(hash1: string, hash2: string) {
    if (hash1.length !== hash2.length) {
        throw new Error("Can't compare hashes with different length");
    }

    var d = 0;
    var i;
    for (i = 0; i < hash1.length; i++) {
        var n1 = parseInt(hash1[i], 16);
        var n2 = parseInt(hash2[i], 16);
        d += one_bits[n1 ^ n2];
    }
    return d;
}

function median(data) {
    var mdarr = data.slice(0);
    mdarr.sort(function(a, b) { return a-b; });
    if (mdarr.length % 2 === 0) {
        return (mdarr[mdarr.length/2] + mdarr[mdarr.length/2 + 1]) / 2.0;
    }
    return mdarr[Math.floor(mdarr.length/2)];
}

function translate_blocks_to_bits(blocks, pixels_per_block) {
    var half_block_value = pixels_per_block * 256 * 3 / 2;
    var bandsize = blocks.length / 4;

    // Compare medians across four horizontal bands
    for (var i = 0; i < 4; i++) {
        var m = median(blocks.slice(i * bandsize, (i + 1) * bandsize));
        for (var j = i * bandsize; j < (i + 1) * bandsize; j++) {
            var v = blocks[j];

            // Output a 1 if the block is brighter than the median.
            // With images dominated by black or white, the median may
            // end up being 0 or the max value, and thus having a lot
            // of blocks of value equal to the median.  To avoid
            // generating hashes of all zeros or ones, in that case output
            // 0 if the median is in the lower value space, 1 otherwise
            blocks[j] = Number(v > m || (Math.abs(v - m) < 1 && m > half_block_value));
        }
    }
}

function bits_to_hexhash(bitsArray) {
    var hex = [];
    for (var i = 0; i < bitsArray.length; i += 4) {
        var nibble = bitsArray.slice(i, i + 4);
        hex.push(parseInt(nibble.join(''), 2).toString(16));
    }

    return hex.join('');
}

function _fromEvenImage(data, bits) {
    var blocksize_x = Math.floor(data.width / bits);
    var blocksize_y = Math.floor(data.height / bits);

    var result = [];

    for (var y = 0; y < bits; y++) {
        for (var x = 0; x < bits; x++) {
            var total = 0;

            for (var iy = 0; iy < blocksize_y; iy++) {
                for (var ix = 0; ix < blocksize_x; ix++) {
                    var cx = x * blocksize_x + ix;
                    var cy = y * blocksize_y + iy;
                    var ii = (cy * data.width + cx) * 4;

                    var alpha = data.data[ii+3];
                    if (alpha === 0) {
                        total += 765;
                    } else {
                        total += data.data[ii] + data.data[ii+1] + data.data[ii+2];
                    }
                }
            }

            result.push(total);
        }
    }

    translate_blocks_to_bits(result, blocksize_x * blocksize_y);
    return bits_to_hexhash(result);
}

function hashFromImage(data, bits) {
    var result = [];

    var i, j, x, y;
    var block_width, block_height;
    var weight_top, weight_bottom, weight_left, weight_right;
    var block_top, block_bottom, block_left, block_right;
    var y_mod, y_frac, y_int;
    var x_mod, x_frac, x_int;
    var blocks = [];

    var even_x = data.width % bits === 0;
    var even_y = data.height % bits === 0;

    if (even_x && even_y) {
        return bmvbhash_even(data, bits);
    }

    // initialize blocks array with 0s
    for (i = 0; i < bits; i++) {
        blocks.push([]);
        for (j = 0; j < bits; j++) {
            blocks[i].push(0);
        }
    }

    block_width = data.width / bits;
    block_height = data.height / bits;

    for (y = 0; y < data.height; y++) {
        if (even_y) {
            // don't bother dividing y, if the size evenly divides by bits
            block_top = block_bottom = Math.floor(y / block_height);
            weight_top = 1;
            weight_bottom = 0;
        } else {
            y_mod = (y + 1) % block_height;
            y_frac = y_mod - Math.floor(y_mod);
            y_int = y_mod - y_frac;

            weight_top = (1 - y_frac);
            weight_bottom = (y_frac);

            // y_int will be 0 on bottom/right borders and on block boundaries
            if (y_int > 0 || (y + 1) === data.height) {
                block_top = block_bottom = Math.floor(y / block_height);
            } else {
                block_top = Math.floor(y / block_height);
                block_bottom = Math.ceil(y / block_height);
            }
        }

        for (x = 0; x < data.width; x++) {
            var ii = (y * data.width + x) * 4;

            var avgvalue, alpha = data.data[ii+3];
            if (alpha === 0) {
                avgvalue = 765;
            } else {
                avgvalue = data.data[ii] + data.data[ii+1] + data.data[ii+2];
            }

            if (even_x) {
                block_left = block_right = Math.floor(x / block_width);
                weight_left = 1;
                weight_right = 0;
            } else {
                x_mod = (x + 1) % block_width;
                x_frac = x_mod - Math.floor(x_mod);
                x_int = x_mod - x_frac;

                weight_left = (1 - x_frac);
                weight_right = x_frac;

                // x_int will be 0 on bottom/right borders and on block boundaries
                if (x_int > 0 || (x + 1) === data.width) {
                    block_left = block_right = Math.floor(x / block_width);
                } else {
                    block_left = Math.floor(x / block_width);
                    block_right = Math.ceil(x / block_width);
                }
            }

            // add weighted pixel value to relevant blocks
            blocks[block_top][block_left] += avgvalue * weight_top * weight_left;
            blocks[block_top][block_right] += avgvalue * weight_top * weight_right;
            blocks[block_bottom][block_left] += avgvalue * weight_bottom * weight_left;
            blocks[block_bottom][block_right] += avgvalue * weight_bottom * weight_right;
        }
    }

    for (i = 0; i < bits; i++) {
        for (j = 0; j < bits; j++) {
            result.push(blocks[i][j]);
        }
    }

    translate_blocks_to_bits(result, block_width * block_height);
    return bits_to_hexhash(result);
}

/**
 * It takes an image and returns a hash
 * @param {Uint8Array | jpeg.Image} srcImageData - The image data to hash. This can be a Uint8Array or a jpeg.Image object.
 * @param {number} bits - The number of bits to use for the hash. The higher the number, the more accurate the hash, but
 * the longer it will take to compute. (Default is 10)
 * @returns A string of hexadecimal characters.
 */
export function imageHash(srcImageData: Uint8Array | jpeg.Image, bits?: number = 10): string {
    try {
        const mime = mimeType(srcImageData);
        if (mime !== 'image/jpeg') throw new Error("Unsupported image type");
        const imgData = (srcImageData instanceof jpeg.Image) ? srcImageData : jpeg.decode(srcImageData);
        if (!imgData) throw new Error("Couldn't decode image");

        return hashFromImage(imgData, bits);
    } catch (err) {
        throw new Error(err);
    }
}
