import Channel from "./channel";

export default class ChatChannel extends Channel {
  private micPermissions: PermissionState | "prompt" = "prompt";
  private micStream: MediaStream | undefined;

  constructor(player: any) {
    super(player);
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: "microphone" as PermissionName }).then((status) => {
        this.micPermissions = status.state;
        status.onchange = () => {
          this.micPermissions = status.state;
        };
      }).catch(() => undefined);
    }
  }

  getChannelName() {
    return "chat";
  }

  getChannelConfig() {
    return { ordered: true, protocol: "chatV1" };
  }

  startMicrophone() {
    if (this.micPermissions === "denied" || this.micStream) {
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 24000 } }).then((stream) => {
      if (this.micStream) {
        return;
      }
      this.micStream = stream;
      this.getPlayer().peerConnection.addTrack(stream.getAudioTracks()[0], stream);
      this.getPlayer().createOffer().then((offer) => this.getPlayer().handleChatOffer(offer));
    }).catch(() => undefined);
  }

  stopMicrophone() {
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = undefined;
  }
}
