import XCloudPlayer from "./player";
import { InputFrame } from "./input-packet";
import { VibrationFrame } from "./input-channel";

export interface GamepadOptions {
  enableVibration?: boolean;
  deadzone?: number;
}

export default class GamepadInput {
  private player: XCloudPlayer | undefined;
  private index: number;
  private physicalGamepadId = -1;
  private isFocused = true;
  private rumbleInterval: number | undefined;
  private options: Required<GamepadOptions> = {
    enableVibration: true,
    deadzone: 0.2,
  };

  constructor(index: number, options: GamepadOptions = {}) {
    this.index = index;
    this.options = { ...this.options, ...options };
    this.onWindowBlur = this.onWindowBlur.bind(this);
    this.onWindowFocus = this.onWindowFocus.bind(this);
    this.onGamepadConnected = this.onGamepadConnected.bind(this);
    this.onGamepadDisconnected = this.onGamepadDisconnected.bind(this);
  }

  attach(player: XCloudPlayer) {
    this.player = player;
    this.player.channels.control.sendGamepadState(this.index, true, this);
    window.addEventListener("blur", this.onWindowBlur);
    window.addEventListener("focus", this.onWindowFocus);
    window.addEventListener("gamepadconnected", this.onGamepadConnected);
    window.addEventListener("gamepaddisconnected", this.onGamepadDisconnected);
    this.detectActiveGamepad();
  }

  detach() {
    this.player?.channels.control.sendGamepadState(this.index, false);
    this.physicalGamepadId = -1;
    if (this.rumbleInterval) {
      window.clearInterval(this.rumbleInterval);
    }
    window.removeEventListener("blur", this.onWindowBlur);
    window.removeEventListener("focus", this.onWindowFocus);
    window.removeEventListener("gamepadconnected", this.onGamepadConnected);
    window.removeEventListener("gamepaddisconnected", this.onGamepadDisconnected);
  }

  getPhysicalGamepadId() {
    return this.physicalGamepadId;
  }

  getGamepadState(): InputFrame | undefined {
    const gamepad = this.getGamepad(this.physicalGamepadId);
    if (!gamepad || !this.isFocused) {
      return undefined;
    }
    const frame: InputFrame = {
      GamepadIndex: this.index,
      Nexus: gamepad.buttons[16]?.value ?? 0,
      Menu: gamepad.buttons[9]?.value ?? 0,
      View: gamepad.buttons[8]?.value ?? 0,
      A: gamepad.buttons[0]?.value ?? 0,
      B: gamepad.buttons[1]?.value ?? 0,
      X: gamepad.buttons[2]?.value ?? 0,
      Y: gamepad.buttons[3]?.value ?? 0,
      DPadUp: gamepad.buttons[12]?.value ?? 0,
      DPadDown: gamepad.buttons[13]?.value ?? 0,
      DPadLeft: gamepad.buttons[14]?.value ?? 0,
      DPadRight: gamepad.buttons[15]?.value ?? 0,
      LeftShoulder: gamepad.buttons[4]?.value ?? 0,
      RightShoulder: gamepad.buttons[5]?.value ?? 0,
      LeftThumb: gamepad.buttons[10]?.value ?? 0,
      RightThumb: gamepad.buttons[11]?.value ?? 0,
      LeftThumbXAxis: this.normalizeAxis(gamepad.axes[0] ?? 0),
      LeftThumbYAxis: this.normalizeAxis(gamepad.axes[1] ?? 0),
      RightThumbXAxis: this.normalizeAxis(gamepad.axes[2] ?? 0),
      RightThumbYAxis: this.normalizeAxis(gamepad.axes[3] ?? 0),
      LeftTrigger: gamepad.buttons[6]?.value ?? 0,
      RightTrigger: gamepad.buttons[7]?.value ?? 0,
    };
    if (frame.View > 0 && frame.Menu > 0) {
      frame.View = 0;
      frame.Menu = 0;
      frame.Nexus = 1;
    }
    return frame;
  }

  handleVibration(report: VibrationFrame) {
    if (!this.options.enableVibration) {
      return;
    }
    const gamepad = this.getGamepad(this.physicalGamepadId) as Gamepad & {
      vibrationActuator?: {
        type?: string;
        playEffect: (type: string, params: Record<string, number>) => Promise<void>;
      };
    };
    if (!gamepad?.vibrationActuator || gamepad.vibrationActuator.type !== "dual-rumble") {
      return;
    }
    const rumbleData = {
      startDelay: 0,
      duration: report.durationMs,
      weakMagnitude: report.rightMotorPercent,
      strongMagnitude: report.leftMotorPercent,
    };
    void gamepad.vibrationActuator.playEffect("dual-rumble", rumbleData);
  }

  private detectActiveGamepad() {
    if (this.physicalGamepadId >= 0) {
      return;
    }
    navigator.getGamepads().forEach((gamepad) => {
      if (gamepad && this.physicalGamepadId < 0) {
        this.physicalGamepadId = gamepad.index;
      }
    });
  }

  private getGamepad(index: number) {
    return navigator.getGamepads()[index] ?? undefined;
  }

  private onGamepadConnected(event: GamepadEvent) {
    if (this.physicalGamepadId < 0) {
      this.physicalGamepadId = event.gamepad.index;
    }
  }

  private onGamepadDisconnected(event: GamepadEvent) {
    if (event.gamepad.index === this.physicalGamepadId) {
      this.physicalGamepadId = -1;
    }
  }

  private onWindowBlur() {
    this.isFocused = false;
  }

  private onWindowFocus() {
    this.isFocused = true;
  }

  private normalizeAxis(value: number) {
    if (Math.abs(value) < this.options.deadzone) {
      return 0;
    }
    const adjusted = value - Math.sign(value) * this.options.deadzone;
    return adjusted / (1 - this.options.deadzone);
  }
}
