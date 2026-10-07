import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');
const localManifestPath = path.join(distDir, 'manifest.json');
const cacheDir = path.resolve('.slicer-cache');

if (!fs.existsSync(indexPath)) {
    console.error('❌ dist/index.html not found! Run build step first.');
    process.exit(1);
}

if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}

async function fetchWithCache(url, cacheKey) {
    const safeFilename = cacheKey.replace(/[/\\?%*:|"<>]/g, '_');
    const cachedFilePath = path.join(cacheDir, safeFilename);

    if (fs.existsSync(cachedFilePath)) {
        return fs.readFileSync(cachedFilePath);
    }

    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(cachedFilePath, buffer);
        return buffer;
    } catch (err) {
        return null;
    }
}

// 1. Fetch index.json
console.log('⏳ Downloading index.json from data.slicer.run/25/index.json...');
const indexJsonBuffer = await fetchWithCache('https://data.slicer.run/25/index.json', 'index.json');
const indexJsonContent = indexJsonBuffer ? indexJsonBuffer.toString('utf-8') : '';

// 2. Extract ALL class paths (The whole set)
function extractClassPaths(jsonRaw) {
    const classPaths = new Set();
    function addPath(p) {
        if (!p || typeof p !== 'string') return;
        let clean = p.trim().replace(/['"]/g, '').replace(/^\//, '');
        if (!clean || clean.endsWith('.json') || clean.endsWith('.js')) return;
        if (!clean.endsWith('.class') && clean.includes('/')) clean += '.class';
        if (clean.endsWith('.class')) classPaths.add(clean);
    }

    try {
        const parsed = JSON.parse(jsonRaw);
        function traverse(obj, currentModule = '') {
            if (!obj) return;
            if (typeof obj === 'string') {
                addPath(currentModule ? `${currentModule}/${obj}` : obj);
            } else if (Array.isArray(obj)) {
                for (const item of obj) traverse(item, currentModule);
            } else if (typeof obj === 'object') {
                for (const [key, value] of Object.entries(obj)) {
                    const isModule = key.startsWith('java.') || key.startsWith('jdk.');
                    traverse(value, isModule ? key : currentModule);
                }
            }
        }
        traverse(parsed);
    } catch (e) {
        const regex = /["']([^"'\s]+)["']/g;
        let match;
        while ((match = regex.exec(jsonRaw)) !== null) addPath(match[1]);
    }

    return Array.from(classPaths);
}

const classRelativePaths = extractClassPaths(indexJsonContent);
console.log(`📋 Discovered all ${classRelativePaths.length} class files.`);

// 3. Download all class files
async function downloadAllClasses(paths, concurrency = 50) {
    console.log(`⏳ Downloading & caching all classes (Concurrency: ${concurrency})...`);
    const results = {};
    const queue = [...paths];
    let downloadedCount = 0;

    async function worker() {
        while (queue.length > 0) {
            const relPath = queue.shift();
            let buffer = await fetchWithCache(`https://data.slicer.run/25/${relPath}`, relPath);
            if (!buffer && relPath.includes('/')) {
                const parts = relPath.split('/');
                if (parts[0].startsWith('java.') || parts[0].startsWith('jdk.')) {
                    const withoutModule = parts.slice(1).join('/');
                    buffer = await fetchWithCache(`https://data.slicer.run/25/${withoutModule}`, withoutModule);
                }
            }
            if (buffer) {
                results[relPath] = buffer;
                downloadedCount++;
            }
        }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));
    console.log(`✅ Successfully downloaded ${downloadedCount} classes.`);
    return results;
}

const downloadedClasses = await downloadAllClasses(classRelativePaths);

// 4. Pack into a single binary buffer and compress with Gzip
console.log('📦 Packing and Gzipping all assets...');
const buffersList = [];
const indexTable = {};
let currentOffset = 0;

function addAssetToBlob(key, buffer, mime) {
    buffersList.push(buffer);
    indexTable[key] = [currentOffset, buffer.length, mime];
    currentOffset += buffer.length;
}

let manifestContent = '';
if (fs.existsSync(localManifestPath)) {
    manifestContent = fs.readFileSync(localManifestPath, 'utf-8');
    addAssetToBlob('manifest.json', Buffer.from(manifestContent), 'application/json');
}

if (indexJsonContent) {
    addAssetToBlob('index.json', Buffer.from(indexJsonContent), 'application/json');
}

for (const [relPath, buffer] of Object.entries(downloadedClasses)) {
    addAssetToBlob(relPath, buffer, 'application/java-vm');
}

const uncompressedBuffer = Buffer.concat(buffersList);
console.log(`📊 Raw Uncompressed Bundle Size: ${(uncompressedBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

const gzippedBuffer = zlib.gzipSync(uncompressedBuffer, { level: 9 });
console.log(`🗜️ Final Gzipped Payload Size: ${(gzippedBuffer.length / (1024 * 1024)).toFixed(2)} MB`);

const gzippedBase64 = gzippedBuffer.toString('base64');

let htmlContent = fs.readFileSync(indexPath, 'utf-8');

// 5. Inline Manifest as Data URI
if (manifestContent) {
    console.log('🔄 Replacing manifest link with Data URI...');
    const manifestB64 = Buffer.from(manifestContent).toString('base64');
    htmlContent = htmlContent.replace(
        /<link\s+rel=["']manifest["']\s+href=["'][^"']+["']\s*\/?>/i,
        `<link rel="manifest" href="data:application/manifest+json;base64,${manifestB64}" />`
    );
}

// 6. Inject Robust Interceptor Script (file:/// compatible + loop protection)
const singleFileScript = `
<script>
(function() {
    const GZIPPED_B64 = "${gzippedBase64}";
    const INDEX = ${JSON.stringify(indexTable)};
    let MASTER_BUFFER = null;
    let FILENAME_MAP = null;

    const binaryStr = atob(GZIPPED_B64);
    const compressedBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) compressedBytes[i] = binaryStr.charCodeAt(i);

    const decompressPromise = (async () => {
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(compressedBytes);
        writer.close();
        const response = new Response(ds.readable);
        MASTER_BUFFER = new Uint8Array(await response.arrayBuffer());
        return MASTER_BUFFER;
    })();

    function resolveAsset(urlStr) {
        if (!urlStr || !INDEX) return null;
        let clean = decodeURIComponent(urlStr).split('?')[0].split('#')[0];
        if (INDEX[clean]) return INDEX[clean];

        // Robust path cleaning for file:/// and http:// protocols
        let relative = clean
            .replace(/^[a-zA-Z]+:\\/\\/[^/]+\\//, '')
            .replace(/^file:\\/\\/\\/[A-Za-z]:\\//, '')
            .replace(/^file:\\/\\//, '')
            .replace(/^\\//, '');

        if (INDEX[relative]) return INDEX[relative];

        let withoutVersion = relative.replace(/^25\\//, '');
        if (INDEX[withoutVersion]) return INDEX[withoutVersion];

        // Fallback by filename
        const filename = relative.split('/').pop();
        if (filename) {
            if (!FILENAME_MAP) {
                FILENAME_MAP = {};
                for (const k of Object.keys(INDEX)) {
                    const fn = k.split('/').pop();
                    if (fn && !FILENAME_MAP[fn]) FILENAME_MAP[fn] = INDEX[k];
                }
            }
            if (FILENAME_MAP[filename]) return FILENAME_MAP[filename];
        }
        return null;
    }

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async function(resource, config) {
        let urlStr = typeof resource === 'string' ? resource : (resource && resource.url) ? resource.url : '';
        const meta = resolveAsset(urlStr);
        if (meta) {
            if (!MASTER_BUFFER) await decompressPromise;
            const [offset, length, mime] = meta;
            const slice = MASTER_BUFFER.subarray(offset, offset + length);
            return new Response(slice, { status: 200, headers: { 'Content-Type': mime } });
        }

        // Prevent infinite loops on missing assets by returning a clean 404 instead of throwing
        return new Response('Not found in bundle', { status: 404, statusText: 'Not Found' });
    };
})();
</script>
`;

if (htmlContent.includes('<head>')) {
    htmlContent = htmlContent.replace('<head>', `<head>${singleFileScript}`);
} else {
    htmlContent = singleFileScript + htmlContent;
}

fs.writeFileSync(indexPath, htmlContent, 'utf-8');

// Clean up loose build files in dist/
const looseFiles = fs.readdirSync(distDir);
for (const file of looseFiles) {
    if (file !== 'index.html') {
        const fullPath = path.join(distDir, file);
        if (fs.statSync(fullPath).isFile()) {
            fs.unlinkSync(fullPath);
        }
    }
}

console.log('✨ Success! Created the complete single-file dist/index.html with all assets embedded.');
