# deno-imagehash

> Perceptual JPEG image hashing for Deno via Blockhash.js

## Usage

```javascript
import { imageHash, jpeg } from "https://deno.land/x/deno_imagehash/mod.ts";

serve(async (request: Request) => {
    const rawImageData: Uint8Array = request.body
    const hash = await imageHash(rawImageData, 10);
    
    // OR
    
    const decodedImage = jpeg.decode(rawImageData)
    const hash = await imageHash(decodedImage, 10);
    
    return new Response(JSON.stringify({hash}), {status: 200})

```

## API

## imageHash(imgData, bits?)
Returns: `string`

Returns the hash value as a string of hexadecimal characters.

### imgData 
Type: `Uint8Array` or `jpeg.Image`

The image data to hash. This can be a `Uint8Array` or a `jpeg.Image` object.

>    The return value of `jpeg.decode()` is a `jpeg.Image` object

### bits = 10 
#### (Optional)

Type: `number` / Default: 10

The number of bits to use for the hash. The higher the number, the more accurate the hash, but
the longer it will take to compute.


## Credits

This module uses the following projects with some changes to work with Deno:

- [Blockhash.js](https://github.com/commonsmachinery/blockhash-js)

- [jpeg.ts](https://github.com/fakoua/jpeg.ts)

Inspired by: [deno-image](https://github.com/MariusVatasoiu/deno-image)
