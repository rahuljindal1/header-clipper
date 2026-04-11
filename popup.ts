import { ChromeApi } from "./services/ChromeApi";
import { PopupController } from "./ui/PopupController";

document.addEventListener("DOMContentLoaded", () => {
    const api = new ChromeApi();
    new PopupController(api).init();
});
