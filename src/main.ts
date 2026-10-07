import "@xyflow/svelte/dist/style.css";
import { mount } from "svelte";
import App from "./app.svelte";
import "./main.css";

const appElement = document.getElementById("app");

if (appElement) {
    mount(App, { target: appElement });
} else {
    console.error("Fatal: #app element not found in the DOM.");
}
