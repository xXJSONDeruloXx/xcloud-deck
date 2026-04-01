import XCloudPlayer from "./player";

export default class VideoComponent {
  private player: XCloudPlayer;
  private element: HTMLVideoElement | undefined;

  constructor(player: XCloudPlayer) {
    this.player = player;
  }

  create(stream: MediaStream) {
    const videoElement = document.createElement("video");
    videoElement.srcObject = stream;
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.style.width = "100%";
    videoElement.style.height = "100%";
    videoElement.style.objectFit = "contain";
    videoElement.style.backgroundColor = "black";
    const holder = document.getElementById(this.player.getElementId());
    if (!holder) return;
    this.element = videoElement;
    holder.appendChild(videoElement);
    if (typeof videoElement.requestVideoFrameCallback === "function") {
      videoElement.requestVideoFrameCallback(this.processMetadata.bind(this));
    }
  }

  private processMetadata(_timestamp: number, data: VideoFrameCallbackMetadata) {
    if (!this.element || typeof this.element.requestVideoFrameCallback !== "function") {
      return;
    }
    this.element.requestVideoFrameCallback(this.processMetadata.bind(this));
    this.player.channels.input.queueMetadataFrame({
      serverDataKey: data.rtpTimestamp ?? 0,
      firstFramePacketArrivalTimeMs: data.receiveTime ?? 0,
      frameSubmittedTimeMs: data.receiveTime ?? 0,
      frameDecodedTimeMs: data.expectedDisplayTime ?? 0,
      frameRenderedTimeMs: data.expectedDisplayTime ?? 0,
    });
  }

  getElement() {
    return this.element;
  }

  destroy() {
    this.element?.remove();
    this.element = undefined;
  }
}
