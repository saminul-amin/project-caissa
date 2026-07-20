import { parseEpochTimestampMs, type WallClock } from "../../application/persistence";

/** The only persistence location that reads the ambient wall clock. */
export class BrowserWallClock implements WallClock {
  nowEpochMs() {
    return parseEpochTimestampMs(Date.now());
  }
}
