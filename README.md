# Slicer Katana (Single-File & Encrypted Fork)

This fork of Slicer Katana introduces custom post-processing pipelines that bundle the entire application into a **single, self-contained HTML file** (`dist/index.html`). It is fully optimized to run offline—including directly from the `file:///` protocol—while enforcing strict zero-network runtime policies and client-side password protection.

## ✨ Key Enhancements in This Fork

* **Single-File Bundling (`inline-assets.js`)**: Automatically discovers, downloads, packs, and compresses (Gzip Level 9) all application assets, manifests, and classes into a single Base64 payload embedded directly in `index.html`. Includes an in-memory asset interceptor with zero-network fallbacks.
* **Runtime Network Lockdown (`network-lockdown.js`)**: Hard-blocks outgoing `fetch`, `XMLHttpRequests (XHR)`, WebSockets, and tracking beacons to ensure complete local execution safety.
* **Client-Side Encryption (`compress-encrypt.js`)**: Secures the bundled payload using **AES-256-GCM** (derived via PBKDF2 with 100,000 iterations). Users must enter a password through a lightweight login bootstrap stub before the application decompresses and renders in memory.

---

## Default Security Configuration

This fork comes with a pre-configured default password for the encrypted bundle:

* **Default Password**: `bundle-password`
* **Where to Change It**: Open `compress-encrypt.js` and update the `USER_PASSWORD` constant:
  ```javascript
  const USER_PASSWORD = "your-secure-password-here"; // <--- CHANGE THIS


# slicer [![](https://img.shields.io/badge/documentation-here-red)](https://docs.slicer.run) [![](https://img.shields.io/badge/translate-here-red?logo=crowdin)](https://crowdin.com/project/slicer)

A modern Java reverse engineering tool for the web.

![](./assets/slicer.png)

|                                          Sponsored by 💖                                          |                                                                                                                |
| :-----------------------------------------------------------------------------------------------: | -------------------------------------------------------------------------------------------------------------- |
| [<img src="https://cdn.modrinth.com/logo.svg" width="64" alt="Modrinth" />](https://modrinth.com) | Discover, play, and create enjoyable and quality Minecraft mods on Modrinth, the open source modding platform. |

## Features

- disassembly and decompilation of Java class files
    - CFR, JASM, Vineflower, Procyon, ...
- graph visualization
    - inheritance, interface implementation within a workspace
    - bytecode control flow via a [CFG](https://en.wikipedia.org/wiki/Control-flow_graph)
- bytecode-level search
    - constant pool entries, instructions, member declarations or usages
- multi-pane workspace for viewing multiple files at once
- contextual actions (right-click) in code and all over the UI
    - go-to declaration, find usages/implementations, ...
- a simple JS scripting API for adding decompilers/disassemblers, manipulating workspace entries, ...
- [shadcn/ui](https://ui.shadcn.com/) design and theming support
- and many more... check [the documentation](https://docs.slicer.run) or see for yourself

## Installation

slicer and all decompilers/disassemblers run in the browser, no download necessary, just go to https://slicer.run!

If you want a desktop app (-ish) experience, you can also
[install slicer as a PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing).

## Motivation

All of this has stemmed from an experiment of running the [CFR](https://github.com/leibnitz27/cfr)
Java decompiler in a browser using TeaVM, which ended up working pretty well, so I made this thing around it.

slicer's being built for the sake of having fun building it, so don't expect any crazy features -
if you want to do serious reverse engineering, use [Recaf](https://github.com/Col-E/Recaf);
if you want to quickly look at a class file, and you don't want to set anything up locally, stay here.

_This is what happens when you let a backend developer do frontend, so enjoy the programmer art design._

## Licensing

slicer is licensed under the [MIT License](./LICENSE), however it also includes components
licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0),
such as the Vineflower and Procyon decompiler.
