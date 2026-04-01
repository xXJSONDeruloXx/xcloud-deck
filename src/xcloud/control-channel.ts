import Channel from "./channel";
import GamepadInput from "./gamepad";

export default class ControlChannel extends Channel {
  private keyframeInterval: number | undefined;
  private gamepadHandlers: Record<number, GamepadInput | undefined> = {
    0: undefined,
    1: undefined,
    2: undefined,
    3: undefined,
  };

  getChannelName() {
    return "control";
  }

  getChannelConfig() {
    return { protocol: "controlV1", ordered: true };
  }

  sendAuthorization() {
    this.send(JSON.stringify({
      message: "authorizationRequest",
      accessKey: "4BDB3609-C1F1-4195-9B37-FEFF45DA8B8E",
    }));

    this.sendGamepadState(0, true);
    this.sendGamepadState(0, false);

    if (this.getPlayer().config.keyframeInterval > 0) {
      this.keyframeInterval = window.setInterval(() => this.requestKeyframe(), this.getPlayer().config.keyframeInterval * 1000);
    }
  }

  sendGamepadState(gamepadIndex: number, wasAdded = true, handler?: GamepadInput) {
    if (wasAdded) {
      if (handler) {
        this.gamepadHandlers[gamepadIndex]?.detach();
        this.gamepadHandlers[gamepadIndex] = handler;
      }
    } else {
      this.gamepadHandlers[gamepadIndex] = undefined;
    }

    this.send(JSON.stringify({ message: "gamepadChanged", gamepadIndex, wasAdded }));
  }

  requestKeyframe(ifrRequested = true) {
    this.send(JSON.stringify({ message: "videoKeyframeRequested", ifrRequested }));
  }

  getGamepadHandlers() {
    return this.gamepadHandlers;
  }

  getGamepadHandler(index: number) {
    return Object.values(this.gamepadHandlers).find((handler) => handler?.getPhysicalGamepadId() === index);
  }

  destroy() {
    if (this.keyframeInterval) {
      window.clearInterval(this.keyframeInterval);
    }
    Object.values(this.gamepadHandlers).forEach((handler) => handler?.detach());
  }
}
