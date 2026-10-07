import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexPath)) {
    console.error('❌ dist/index.html not found! Run the asset interceptor step first.');
    process.exit(1);
}

// Read the current htmlContent from dist/index.html
let htmlContent = fs.readFileSync(indexPath, 'utf-8');

console.log('🔒 Injecting runtime network lockdown script...');

const runtimeLockdownScript = `
<script>
(function() {
    // 1. Hard-block standard Fetch requests not handled by the local bundle
    const originalFetch = window.fetch;
    window.fetch = async function(resource, init) {
        let url = typeof resource === 'string' ? resource : (resource && resource.url) ? resource.url : '';
        if (url && (url.startsWith('blob:') || url.startsWith('data:'))) {
            return originalFetch.apply(this, arguments);
        }
        console.error("🚫 RUNTIME LOCKDOWN: Blocked outgoing fetch ->", url);
        throw new Error("Zero-network runtime policy: Fetch blocked.");
    };

    // 2. Hard-block XMLHttpRequests (XHR)
    const OriginalXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new OriginalXHR();
        xhr.open = function(method, url) {
            console.error("🚫 RUNTIME LOCKDOWN: Blocked outgoing XHR ->", url);
            throw new Error("Zero-network runtime policy: XHR blocked.");
        };
        return xhr;
    };

    // 3. Kill WebSockets (Stops background sockets from phoning home)
    if (window.WebSocket) {
        window.WebSocket = function(url) {
            console.error("🚫 RUNTIME LOCKDOWN: Blocked WebSocket connection ->", url);
            throw new Error("Zero-network runtime policy: WebSockets blocked.");
        };
    }

    // 4. Block Tracking Beacons
    if (navigator.sendBeacon) {
        navigator.sendBeacon = function(url) {
            console.warn("🚫 RUNTIME LOCKDOWN: Blocked beacon ->", url);
            return false;
        };
    }
})();
</script>
`;

// Inject the lockdown script into <head>
if (htmlContent.includes('<head>')) {
    htmlContent = htmlContent.replace('<head>', `<head>${runtimeLockdownScript}`);
} else {
    htmlContent = runtimeLockdownScript + htmlContent;
}

// Write the updated content back to disk
fs.writeFileSync(indexPath, htmlContent, 'utf-8');
console.log('✅ Runtime network lockdown successfully injected into index.html.');
