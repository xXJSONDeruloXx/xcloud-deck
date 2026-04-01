import Channel from "./channel";
import InputQueue from "./input-queue";
import GamepadInput from "./gamepad";
import InputPacket, { InputFrame, MetadataFrame, ReportTypes } from "./input-packet";

export interface VibrationFrame {
  gamepadIndex: number;
  leftMotorPercent: number;
  rightMotorPercent: number;
  leftTriggerMotorPercent: number;
  rightTriggerMotorPercent: number;
  durationMs: number;
  delayMs: number;
  repeat: number;
}

export default class InputChannel extends Channel {
  private serverVideoWidth = 0;
  private serverVideoHeight = 0;
  private inputQueue = new InputQueue(this.getPlayer());

  getChannelName() {
    return "input";
  }

  getChannelConfig() {
    return { ordered: true, protocol: "1.0" };
  }

  getServerVideoWidth() {
    return this.serverVideoWidth;
  }

  getServerVideoHeight() {
    return this.serverVideoHeight;
  }

  start() {
    const packet = new InputPacket(0);
    packet.setMetadata(navigator.maxTouchPoints > 1 ? navigator.maxTouchPoints : 1);
    this.send(packet.toBuffer().buffer);
    window.setTimeout(() => this.gamepadStateLoop(), 16);
  }

  onMessage(event: MessageEvent<ArrayBuffer>) {
    const dataView = new DataView(event.data);
    const reportType = dataView.getUint8(0);
    if (reportType === ReportTypes.Vibration) {
      const gamepadIndex = dataView.getUint8(3);
      const gamepad = this.getPlayer().channels.control.getGamepadHandler(gamepadIndex);
      if (!gamepad) {
        return;
      }
      gamepad.handleVibration({
        gamepadIndex,
        leftMotorPercent: dataView.getUint8(4) / 100,
        rightMotorPercent: dataView.getUint8(5) / 100,
        leftTriggerMotorPercent: dataView.getUint8(6) / 100,
        rightTriggerMotorPercent: dataView.getUint8(7) / 100,
        durationMs: dataView.getUint16(8, true),
        delayMs: dataView.getUint16(10, true),
        repeat: dataView.getUint8(12),
      });
    } else if (reportType === ReportTypes.ServerMetadata) {
      this.serverVideoHeight = dataView.getUint32(2, true);
      this.serverVideoWidth = dataView.getUint32(6, true);
    }
  }

  queueMetadataFrame(data: MetadataFrame) {
    this.inputQueue.queueMetadataFrame(data);
  }

  queueGamepadFrames(frames: InputFrame[]) {
    this.inputQueue.queueGamepadFrames(frames);
  }

  private gamepadStateLoop() {
    const frames: InputFrame[] = [];
    Object.values(this.getPlayer().channels.control.getGamepadHandlers()).forEach((handler) => {
      if (handler instanceof GamepadInput) {
        const frame = handler.getGamepadState();
        if (frame) {
          frames.push(frame);
        }
      }
    });

    if (frames.length > 0) {
      this.queueGamepadFrames(frames);
    }

    window.setTimeout(() => this.gamepadStateLoop(), 16);
  }
}
