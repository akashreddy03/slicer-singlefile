import crypto from 'node:crypto';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');

// Read the fully assembled index.html (with your asset interceptor & bundled payload)
let htmlContent = fs.readFileSync(indexPath, 'utf-8');

// 1. Compress with Gzip (Level 9)
console.log('🗜️ Compressing final HTML bundle...');
const htmlGzipped = zlib.gzipSync(Buffer.from(htmlContent, 'utf-8'), { level: 9 });

// 2. Encrypt with AES-256-GCM using a memorable password (via PBKDF2)
const USER_PASSWORD = "bundle-password"; // <--- CHANGE THIS TO YOUR PASSWORD
console.log('🔐 Encrypting HTML bundle...');

const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const derivedKey = crypto.pbkdf2Sync(USER_PASSWORD, salt, 100000, 32, 'sha256');

const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
const encrypted = Buffer.concat([cipher.update(htmlGzipped), cipher.final()]);
const authTag = cipher.getAuthTag();

const encryptedPayloadB64 = encrypted.toString('base64');
const saltB64 = salt.toString('base64');
const ivB64 = iv.toString('base64');
const authTagB64 = authTag.toString('base64');

// 3. Generate Minimalist Password-Protected Bootstrap Stub
const bootstrapStub = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Authentication Required</title>
    <style>
        body {
            background-color: #0b0f19;
            color: #f3f4f6;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            overflow: hidden;
        }
        .auth-box {
            background-color: #111827;
            border: 1px solid #1f2937;
            padding: 28px;
            border-radius: 10px;
            width: 300px;
            box-sizing: border-box;
            position: relative;
        }
        input[type="password"] {
            width: 100%;
            padding: 10px 12px;
            background-color: #090d16;
            border: 1px solid #1f2937;
            border-radius: 6px;
            color: #fff;
            font-size: 14px;
            box-sizing: border-box;
            outline: none;
        }
        input[type="password"]:focus {
            border-color: #3b82f6;
        }
        button {
            margin-top: 12px;
            width: 100%;
            background-color: #3b82f6;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
        }
        button:hover {
            background-color: #2563eb;
        }
        #error {
            color: #f87171;
            font-size: 12px;
            margin-top: 8px;
            text-align: center;
            min-height: 16px;
        }
        .loading-overlay {
            position: absolute;
            inset: 0;
            background-color: #111827;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s ease;
        }
        .loading-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }
        .spinner {
            width: 24px;
            height: 24px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="auth-box">
        <input type="password" id="pwd-input" placeholder="Password" autofocus autocomplete="current-password" />
        <button id="unlock-btn">Enter</button>
        <div id="error"></div>
        <div class="loading-overlay" id="loading-overlay">
            <div class="spinner"></div>
        </div>
    </div>

    <script>
    document.getElementById('unlock-btn').addEventListener('click', attemptUnlock);
    document.getElementById('pwd-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') attemptUnlock();
    });

    async function attemptUnlock() {
        const password = document.getElementById('pwd-input').value;
        const errorEl = document.getElementById('error');
        const overlay = document.getElementById('loading-overlay');

        if (!password) return;

        errorEl.innerText = "";
        overlay.classList.add('active');

        // Yield execution briefly so the browser can paint the loading spinner instantly
        await new Promise(resolve => setTimeout(resolve, 20));

        try {
            const payloadB64 = "${encryptedPayloadB64}";
            const saltB64 = "${saltB64}";
            const ivB64 = "${ivB64}";
            const authTagB64 = "${authTagB64}";

            const encEncoder = new TextEncoder();
            const passwordKey = await crypto.subtle.importKey(
                "raw", encEncoder.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
            );

            const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
            const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
            const authTag = Uint8Array.from(atob(authTagB64), c => c.charCodeAt(0));
            const ciphertext = Uint8Array.from(atob(payloadB64), c => c.charCodeAt(0));

            const aesKey = await crypto.subtle.deriveKey(
                { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
                passwordKey,
                { name: "AES-GCM", length: 256 },
                false,
                ["decrypt"]
            );

            const combined = new Uint8Array(ciphertext.length + authTag.length);
            combined.set(ciphertext);
            combined.set(authTag, ciphertext.length);

            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv, tagLength: 128 },
                aesKey,
                combined
            );

            const ds = new DecompressionStream('gzip');
            const writer = ds.writable.getWriter();
            writer.write(new Uint8Array(decrypted));
            writer.close();

            const response = new Response(ds.readable);
            const htmlText = await response.text();

            document.open();
            document.write(htmlText);
            document.close();

        } catch (err) {
            overlay.classList.remove('active');
            errorEl.innerText = "Incorrect password";
            document.getElementById('pwd-input').value = "";
            document.getElementById('pwd-input').focus();
        }
    }
    </script>
</body>
</html>`;

fs.writeFileSync(indexPath, bootstrapStub, 'utf-8');
console.log('✨ Success! dist/index.html is now compressed, encrypted, and wrapped with the login stub.');
