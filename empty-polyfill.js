// empty-polyfill.js
export default {};
export const promises = {};
export const readFile = async () => { throw new Error("Filesystem not supported in browser"); };
export const pathToFileURL = (p) => p;
export const fileURLToPath = (u) => u;
