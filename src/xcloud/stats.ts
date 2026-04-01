import XCloudPlayer from "./player";

export interface StreamStatsSnapshot {
  videoCodec: string;
  audioCodec: string;
  videoWidth: number;
  videoHeight: number;
  videoFps: number;
  rtt: number;
}

export default class Stats {
  private peerConnection: RTCPeerConnection;
  private snapshot: StreamStatsSnapshot = {
    videoCodec: "",
    audioCodec: "",
    videoWidth: 0,
    videoHeight: 0,
    videoFps: 0,
    rtt: 0,
  };

  constructor(player: XCloudPlayer) {
    this.peerConnection = player.peerConnection;
    window.setInterval(() => void this.refresh(), 1000);
  }

  getSnapshot() {
    return this.snapshot;
  }

  async refresh() {
    const stats = await this.peerConnection.getStats();
    stats.forEach((report) => {
      if (report.type === "inbound-rtp" && report.kind === "video") {
        if (report.codecId?.includes("4d")) this.snapshot.videoCodec = "H264 (High)";
        else if (report.codecId?.includes("42e")) this.snapshot.videoCodec = "H264 (Main)";
        else if (report.codecId?.includes("420")) this.snapshot.videoCodec = "H264 (Low)";
        this.snapshot.videoWidth = report.frameWidth ?? this.snapshot.videoWidth;
        this.snapshot.videoHeight = report.frameHeight ?? this.snapshot.videoHeight;
        this.snapshot.videoFps = report.framesPerSecond ?? this.snapshot.videoFps;
      }
      if (report.type === "inbound-rtp" && report.kind === "audio") {
        this.snapshot.audioCodec = report.codecId ?? this.snapshot.audioCodec;
      }
      if (report.type === "candidate-pair" && report.currentRoundTripTime !== undefined) {
        this.snapshot.rtt = report.currentRoundTripTime;
      }
    });
    return this.snapshot;
  }
}
