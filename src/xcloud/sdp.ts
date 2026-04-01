import XCloudPlayer from "./player";

export default class Sdp {
  private player: XCloudPlayer;

  constructor(player: XCloudPlayer) {
    this.player = player;
  }

  setLocalSDP(sdp: RTCSessionDescriptionInit) {
    if (!sdp.sdp) {
      return sdp;
    }
    if (this.player.config.videoBitrate > 0) {
      sdp.sdp = this.setBitrate(sdp.sdp, "video", this.player.config.videoBitrate);
    }
    if (this.player.config.audioBitrate > 0) {
      sdp.sdp = this.setBitrate(sdp.sdp, "audio", this.player.config.audioBitrate);
    }
    if (!this.player.config.audioMono) {
      sdp.sdp = sdp.sdp.replace("useinbandfec=1", "useinbandfec=1; stereo=1");
    }
    return sdp;
  }

  setRemoteSDP(sdp: string) {
    return sdp;
  }

  getDefaultCodecPreferences() {
    const capabilities = RTCRtpReceiver.getCapabilities("video")?.codecs;
    if (!capabilities) {
      return [];
    }
    const high = capabilities.filter((codec) => codec.mimeType.includes("H264") && codec.sdpFmtpLine?.includes("profile-level-id=4d"));
    const mid = capabilities.filter((codec) => codec.mimeType.includes("H264") && codec.sdpFmtpLine?.includes("profile-level-id=42e"));
    const low = capabilities.filter((codec) => codec.mimeType.includes("H264") && codec.sdpFmtpLine?.includes("profile-level-id=420"));
    const rest = capabilities.filter((codec) => !codec.mimeType.includes("H264"));
    return [...high, ...mid, ...low, ...rest];
  }

  private setBitrate(sdp: string, media: string, bitrate: number) {
    const lines = sdp.split("\n");
    let line = lines.findIndex((entry) => entry.startsWith(`m=${media}`));
    if (line === -1) {
      return sdp;
    }
    line++;
    while (lines[line]?.startsWith("i=") || lines[line]?.startsWith("c=")) {
      line++;
    }
    if (lines[line]?.startsWith("b=")) {
      lines[line] = `b=AS:${bitrate}`;
      return lines.join("\n");
    }
    return [...lines.slice(0, line), `b=AS:${bitrate}`, ...lines.slice(line)].join("\n");
  }
}
