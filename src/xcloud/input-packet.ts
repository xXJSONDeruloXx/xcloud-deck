export interface InputFrame {
  GamepadIndex: number;
  Nexus: number;
  Menu: number;
  View: number;
  A: number;
  B: number;
  X: number;
  Y: number;
  DPadUp: number;
  DPadDown: number;
  DPadLeft: number;
  DPadRight: number;
  LeftShoulder: number;
  RightShoulder: number;
  LeftThumb: number;
  RightThumb: number;
  LeftThumbXAxis: number;
  LeftThumbYAxis: number;
  RightThumbXAxis: number;
  RightThumbYAxis: number;
  LeftTrigger: number;
  RightTrigger: number;
}

export interface MetadataFrame {
  serverDataKey: number;
  firstFramePacketArrivalTimeMs: number;
  frameSubmittedTimeMs: number;
  frameDecodedTimeMs: number;
  frameRenderedTimeMs: number;
}

export enum ReportTypes {
  None = 0,
  Metadata = 1,
  Gamepad = 2,
  ClientMetadata = 8,
  ServerMetadata = 16,
  Vibration = 128,
}

export default class InputPacket {
  private reportType = ReportTypes.None;
  private totalSize = -1;
  private sequence = -1;
  private metadataFrames: MetadataFrame[] = [];
  private gamepadFrames: InputFrame[] = [];
  private maxTouchpoints = 0;

  constructor(sequence: number) {
    this.sequence = sequence;
  }

  setMetadata(maxTouchpoints = 1) {
    this.reportType = ReportTypes.ClientMetadata;
    this.totalSize = 15;
    this.maxTouchpoints = maxTouchpoints;
  }

  setData(metadataQueue: MetadataFrame[], gamepadQueue: InputFrame[]) {
    let size = 14;
    if (metadataQueue.length > 0) {
      this.reportType |= ReportTypes.Metadata;
      size += 1 + (7 * 4) * metadataQueue.length;
      this.metadataFrames = metadataQueue;
    }
    if (gamepadQueue.length > 0) {
      this.reportType |= ReportTypes.Gamepad;
      size += 1 + 23 * gamepadQueue.length;
      this.gamepadFrames = gamepadQueue;
    }
    this.totalSize = size;
  }

  private writeMetadata(packet: DataView, offset: number, frames: MetadataFrame[]) {
    packet.setUint8(offset, frames.length);
    offset++;
    while (frames.length > 0) {
      const frame = frames.shift();
      if (!frame) break;
      packet.setUint32(offset, frame.serverDataKey, true);
      packet.setUint32(offset + 4, frame.firstFramePacketArrivalTimeMs, true);
      packet.setUint32(offset + 8, frame.frameSubmittedTimeMs, true);
      packet.setUint32(offset + 12, frame.frameDecodedTimeMs, true);
      packet.setUint32(offset + 16, frame.frameRenderedTimeMs, true);
      packet.setUint32(offset + 20, performance.now(), true);
      packet.setUint32(offset + 24, performance.now(), true);
      offset += 28;
    }
    return offset;
  }

  private writeGamepads(packet: DataView, offset: number, frames: InputFrame[]) {
    packet.setUint8(offset, frames.length);
    offset++;
    while (frames.length > 0) {
      const input = frames.shift();
      if (!input) break;
      packet.setUint8(offset, input.GamepadIndex);
      offset++;
      let buttonMask = 0;
      if (input.Nexus > 0) buttonMask |= 2;
      if (input.Menu > 0) buttonMask |= 4;
      if (input.View > 0) buttonMask |= 8;
      if (input.A > 0) buttonMask |= 16;
      if (input.B > 0) buttonMask |= 32;
      if (input.X > 0) buttonMask |= 64;
      if (input.Y > 0) buttonMask |= 128;
      if (input.DPadUp > 0) buttonMask |= 256;
      if (input.DPadDown > 0) buttonMask |= 512;
      if (input.DPadLeft > 0) buttonMask |= 1024;
      if (input.DPadRight > 0) buttonMask |= 2048;
      if (input.LeftShoulder > 0) buttonMask |= 4096;
      if (input.RightShoulder > 0) buttonMask |= 8192;
      if (input.LeftThumb > 0) buttonMask |= 16384;
      if (input.RightThumb > 0) buttonMask |= 32768;
      packet.setUint16(offset, buttonMask, true);
      packet.setInt16(offset + 2, this.normalizeAxis(input.LeftThumbXAxis), true);
      packet.setInt16(offset + 4, this.normalizeAxis(-input.LeftThumbYAxis), true);
      packet.setInt16(offset + 6, this.normalizeAxis(input.RightThumbXAxis), true);
      packet.setInt16(offset + 8, this.normalizeAxis(-input.RightThumbYAxis), true);
      packet.setUint16(offset + 10, this.normalizeTrigger(input.LeftTrigger), true);
      packet.setUint16(offset + 12, this.normalizeTrigger(input.RightTrigger), true);
      packet.setUint32(offset + 14, 1, true);
      packet.setUint32(offset + 18, 1, false);
      offset += 22;
    }
    return offset;
  }

  toBuffer() {
    const bytes = new Uint8Array(this.totalSize);
    const packet = new DataView(bytes.buffer);
    packet.setUint16(0, this.reportType, true);
    packet.setUint32(2, this.sequence, true);
    packet.setFloat64(6, performance.now(), true);
    let offset = 14;
    if (this.metadataFrames.length > 0) offset = this.writeMetadata(packet, offset, this.metadataFrames);
    if (this.gamepadFrames.length > 0) offset = this.writeGamepads(packet, offset, this.gamepadFrames);
    if (this.reportType === ReportTypes.ClientMetadata) {
      packet.setUint8(offset, this.maxTouchpoints);
    }
    return packet;
  }

  private normalizeTrigger(value: number) {
    return Math.max(0, Math.min(65535, Math.round(65535 * value)));
  }

  private normalizeAxis(value: number) {
    const scaled = Math.round(value * 32767);
    return Math.max(-32767, Math.min(32767, scaled));
  }
}
