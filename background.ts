import { ChromeApi } from "./services/ChromeApi";
import { BadgeService } from "./services/BadgeService";
import { HeaderCapture } from "./workers/HeaderCapture";
import { TraceService } from "./services/TraceService";

const api = new ChromeApi();
const badge = new BadgeService(api);
const service = new TraceService(api, badge);
const capture = new HeaderCapture(
    api,
    () => service.refreshBadge(),
    () => badge.clear(),
);

badge.init();
capture.init();
service.listen();
