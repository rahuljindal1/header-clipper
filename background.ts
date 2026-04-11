import { ChromeApi } from "./services/ChromeApi";
import { HeaderCapture } from "./workers/HeaderCapture";
import { TraceService } from "./services/TraceService";

const api = new ChromeApi();
const capture = new HeaderCapture(api);
const service = new TraceService(api);

capture.init();
service.listen();
