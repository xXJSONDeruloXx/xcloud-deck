import XCloudPlayer from "./player";
import InputPacket, { InputFrame, MetadataFrame } from "./input-packet";

export default class InputQueue {
  private player: XCloudPlayer;
  private sequence = 0;
  private metadataQueue: MetadataFrame[] = [];
  private gamepadQueue: InputFrame[] = [];

  constructor(player: XCloudPlayer) {
    this.player = player;
  }

  queueMetadataFrame(data: MetadataFrame) {
    this.metadataQueue.push(data);
    this.checkQueueAndSend();
  }

  queueGamepadFrames(frames: InputFrame[]) {
    this.gamepadQueue.push(...frames);
    this.checkQueueAndSend();
  }

  private checkQueueAndSend() {
    if (this.metadataQueue.length > 0 || this.gamepadQueue.length > 0) {
      this.sendQueue();
    }
  }

  private sendQueue() {
    const packet = new InputPacket(++this.sequence);
    packet.setData(this.metadataQueue, this.gamepadQueue);
    this.player.channels.input.send(packet.toBuffer().buffer);
    this.metadataQueue = [];
    this.gamepadQueue = [];
  }
}
