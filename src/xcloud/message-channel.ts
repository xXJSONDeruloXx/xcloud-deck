import Channel from "./channel";

export default class MessageChannel extends Channel {
  getChannelName() {
    return "message";
  }

  getChannelConfig() {
    return { protocol: "messageV1", ordered: true };
  }

  onOpen() {
    this.send(JSON.stringify({
      type: "Handshake",
      version: "messageV1",
      id: crypto.randomUUID(),
      cv: "0",
    }));
  }

  onMessage(event: MessageEvent<string>) {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case "HandshakeAck":
        this.getPlayer().channels.control.sendAuthorization();
        this.getPlayer().channels.input.start();
        this.sendConfig();
        break;
      case "TransactionStart":
      case "Message":
        if (data.target === "/streaming/sessionLifetimeManagement/serverInitiatedDisconnect") {
          this.completeTransaction(data.id, "");
          this.getPlayer().destroy();
        } else if (data.target === "/streaming/systemUi/messages/ShowMessageDialog") {
          this.completeTransaction(data.id, { Result: 0 });
        }
        break;
    }
  }

  private sendConfig() {
    this.sendGenerated("/streaming/systemUi/configuration", {
      version: [0, 2, 0],
      systemUis: [],
    });
    this.sendGenerated("/streaming/properties/clientappinstallidchanged", {
      clientAppInstallId: crypto.randomUUID(),
    });
    this.sendGenerated("/streaming/characteristics/orientationchanged", { orientation: 0 });
    this.sendGenerated("/streaming/characteristics/touchinputenabledchanged", { touchInputEnabled: false });
    this.sendGenerated("/streaming/characteristics/clientdevicecapabilities", {});
    this.sendGenerated("/streaming/characteristics/dimensionschanged", {
      horizontal: 1920,
      vertical: 1080,
      preferredWidth: 1920,
      preferredHeight: 1080,
      safeAreaLeft: 0,
      safeAreaTop: 0,
      safeAreaRight: 1920,
      safeAreaBottom: 1080,
      supportsCustomResolution: true,
    });
  }

  private sendGenerated(target: string, content: object) {
    this.send(JSON.stringify({
      type: "Message",
      content: JSON.stringify(content),
      id: crypto.randomUUID(),
      target,
      cv: "",
    }));
  }

  private completeTransaction(id: string, data: object | string) {
    this.send(JSON.stringify({
      type: "TransactionComplete",
      content: JSON.stringify(data),
      id,
      cv: "",
    }));
  }
}
