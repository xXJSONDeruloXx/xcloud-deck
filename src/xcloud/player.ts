import AudioComponent from "./audio";
import ChatChannel from "./chat-channel";
import ControlChannel from "./control-channel";
import Ice from "./ice";
import InputChannel from "./input-channel";
import MessageChannel from "./message-channel";
import Sdp from "./sdp";
import Stats from "./stats";
import VideoComponent from "./video";

export interface XCloudPlayerConfig {
  audioMono?: boolean;
  audioBitrate?: number;
  videoBitrate?: number;
  keyframeInterval?: number;
}

export default class XCloudPlayer {
  peerConnection = new RTCPeerConnection({});
  channels = {
    chat: new ChatChannel(this),
    control: new ControlChannel(this),
    input: new InputChannel(this),
    message: new MessageChannel(this),
  };
  config: Required<XCloudPlayerConfig> = {
    audioMono: false,
    audioBitrate: 0,
    videoBitrate: 0,
    keyframeInterval: 5,
  };

  private elementId: string;
  private destroyed = false;
  private sdpHelper = new Sdp(this);
  private iceHelper = new Ice(this);
  private statsHelper = new Stats(this);
  private videoComponent: VideoComponent | undefined;
  private audioComponent: AudioComponent | undefined;
  private chatSdpHandler: ((offer: RTCSessionDescriptionInit) => void) | undefined;

  constructor(elementId: string, options: XCloudPlayerConfig = {}) {
    this.elementId = elementId;
    this.config = { ...this.config, ...options };
    this.peerConnection.addTransceiver("audio", { direction: "sendrecv" });
    const videoTransceiver = this.peerConnection.addTransceiver("video", { direction: "recvonly" });
    videoTransceiver.setCodecPreferences(this.sdpHelper.getDefaultCodecPreferences());
    this.peerConnection.ontrack = (event) => {
      if (event.track.kind === "video") {
        this.videoComponent = new VideoComponent(this);
        this.videoComponent.create(event.streams[0]);
      } else if (event.track.kind === "audio") {
        this.audioComponent = new AudioComponent(this);
        this.audioComponent.create(event.streams[0]);
      }
    };
  }

  getElementId() {
    return this.elementId;
  }

  onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void) {
    this.peerConnection.onconnectionstatechange = () => callback(this.peerConnection.connectionState);
  }

  setChatSdpHandler(callback: (offer: RTCSessionDescriptionInit) => void) {
    this.chatSdpHandler = callback;
  }

  handleChatOffer(offer: RTCSessionDescriptionInit) {
    this.chatSdpHandler?.(offer);
  }

  createOffer() {
    return this.peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true }).then((offer) => {
      const playerOffer = this.sdpHelper.setLocalSDP(offer);
      void this.peerConnection.setLocalDescription(playerOffer);
      return playerOffer;
    });
  }

  setRemoteOffer(sdpRemote: string) {
    const sdp = this.sdpHelper.setRemoteSDP(sdpRemote);
    return this.peerConnection.setRemoteDescription({ type: "answer", sdp });
  }

  getIceCandidates() {
    return this.iceHelper.getCandidates();
  }

  setRemoteIceCandidates(candidates: RTCIceCandidateInit[]) {
    this.iceHelper.setRemoteCandidates(candidates);
  }

  getStats() {
    return this.statsHelper;
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.peerConnection.close();
    Object.values(this.channels).forEach((channel) => channel.destroy());
    this.videoComponent?.destroy();
    this.audioComponent?.destroy();
    this.destroyed = true;
  }
}
