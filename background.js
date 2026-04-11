import { ChromeApi } from "./services/ChromeApi.js";
import { HeaderCapture } from "./workers/HeaderCapture.js";
import { TraceService } from "./services/TraceService.js";

const api = new ChromeApi();
const capture = new HeaderCapture(api);
const service = new TraceService(api);

capture.init();
service.listen();
