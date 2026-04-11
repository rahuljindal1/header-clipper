import { ChromeApi } from "./services/ChromeApi.js";
import { PopupController } from "./ui/PopupController.js";

document.addEventListener("DOMContentLoaded", () => {
    const api = new ChromeApi();
    new PopupController(api).init();
});
