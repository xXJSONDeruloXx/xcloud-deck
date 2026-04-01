import XCloudPlayer from "./player";
import Teredo from "./teredo";

export default class Ice {
  private peerConnection: RTCPeerConnection;
  private iceCandidates: RTCIceCandidate[] = [];

  constructor(player: XCloudPlayer) {
    this.peerConnection = player.peerConnection;
    this.peerConnection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        this.iceCandidates.push(event.candidate);
      }
    });
  }

  getCandidates() {
    return this.iceCandidates;
  }

  setRemoteCandidates(candidates: RTCIceCandidateInit[]) {
    candidates.forEach((candidate) => {
      if (!candidate.candidate || candidate.candidate === "a=end-of-candidates") {
        return;
      }
      const parts = candidate.candidate.split(" ");
      if (parts.length > 4 && parts[4].startsWith("2001")) {
        const teredo = new Teredo(parts[4]);
        void this.peerConnection.addIceCandidate({
          candidate: `a=candidate:10 1 UDP 1 ${teredo.getIpv4Address()} 9002 typ host `,
          sdpMLineIndex: candidate.sdpMLineIndex ?? 0,
          sdpMid: candidate.sdpMid ?? "0",
        });
        void this.peerConnection.addIceCandidate({
          candidate: `a=candidate:11 1 UDP 1 ${teredo.getIpv4Address()} ${teredo.getIpv4Port()} typ host `,
          sdpMLineIndex: candidate.sdpMLineIndex ?? 0,
          sdpMid: candidate.sdpMid ?? "0",
        });
      }
      void this.peerConnection.addIceCandidate(candidate);
    });
  }
}
