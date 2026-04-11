import { ChromeApi } from "./services/ChromeApi";
import { BadgeService } from "./services/BadgeService";
import { HeaderCapture } from "./workers/HeaderCapture";
import { TraceService } from "./services/TraceService";

const api = new ChromeApi();
const badge = new BadgeService(api);
const capture = new HeaderCapture(api, badge);
const service = new TraceService(api, badge);

badge.init();
capture.init();
service.listen();
