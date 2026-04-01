import XCloudPlayer from "./player";

export default class AudioComponent {
  private player: XCloudPlayer;
  private element: HTMLAudioElement | undefined;

  constructor(player: XCloudPlayer) {
    this.player = player;
  }

  create(stream: MediaStream) {
    const audioElement = document.createElement("audio");
    audioElement.srcObject = stream;
    audioElement.autoplay = true;
    const holder = document.getElementById(this.player.getElementId());
    if (!holder) return;
    this.element = audioElement;
    holder.appendChild(audioElement);
  }

  getElement() {
    return this.element;
  }

  destroy() {
    this.element?.remove();
    this.element = undefined;
  }
}
