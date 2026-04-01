import XCloudPlayer from "./player";

export default class Channel {
  private player: XCloudPlayer;
  private dataChannel: RTCDataChannel;

  constructor(player: XCloudPlayer) {
    this.player = player;
    this.dataChannel = this.player.peerConnection.createDataChannel(this.getChannelName(), this.getChannelConfig());
    this.dataChannel.onopen = this.onOpen.bind(this);
    this.dataChannel.onmessage = this.onMessage.bind(this);
    this.dataChannel.onclosing = this.onClosing.bind(this);
    this.dataChannel.onclose = this.onClose.bind(this);
    this.dataChannel.onerror = this.onError.bind(this);
  }

  getChannelName() {
    return "channel";
  }

  getChannelConfig(): RTCDataChannelInit {
    return {};
  }

  onOpen(_event: Event) {}
  onMessage(_event: MessageEvent) {}
  onClosing(_event: Event) {}
  onClose(_event: Event) {}
  onError(_event: Event) {}

  send(data: string | BufferSource) {
    if (this.dataChannel.readyState !== "open") {
      return;
    }
    if (typeof data === "string") {
      this.dataChannel.send(new TextEncoder().encode(data));
      return;
    }
    if (data instanceof ArrayBuffer) {
      this.dataChannel.send(data);
      return;
    }
    this.dataChannel.send(data as ArrayBufferView);
  }

  getPlayer() {
    return this.player;
  }

  destroy() {}
}
