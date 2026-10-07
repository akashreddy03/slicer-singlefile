import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
    base: './',
    plugins: [
        tailwindcss(),
        svelte(),
        wasm(),
        viteSingleFile({
            // Force-inline all remaining JS chunks, CSS, and WASM runtimes into index.html
            inlinePattern: ['**/*.js', '**/*.css', '**/*.wasm']
        })
    ],
    build: {
        sourcemap: false,
        rolldownOptions: {
            checks: {
                pluginTimings: false,
            },
            output: {
                comments: false,
            },
        },
    },
    optimizeDeps: {
        exclude: ["@run-slicer/jasm", "@run-slicer/vf", "@run-slicer/cfr", "@run-slicer/procyon"],
    },
    server: {
        fs: { strict: false },
    },
    resolve: {
        alias: {
            $lib: resolve("./src/lib"),
            // Point all Node built-ins directly to our physical polyfill file
            'node:fs/promises': resolve(__dirname, './empty-polyfill.js'),
            'node:fs': resolve(__dirname, './empty-polyfill.js'),
            'node:url': resolve(__dirname, './empty-polyfill.js'),
            'fs': resolve(__dirname, './empty-polyfill.js'),
            'url': resolve(__dirname, './empty-polyfill.js'),
        }
    },
    worker: {
        format: "iife",
        plugins: () => [wasm()],
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            }
        }
    },
    envPrefix: "WORKERS_CI_",
});
