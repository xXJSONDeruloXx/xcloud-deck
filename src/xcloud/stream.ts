import XCloudApiClient from "./apiclient";

export default class StreamSession {
  private apiClient: XCloudApiClient;
  private sessionId: string;
  private sessionPath: string;
  private state = "New";

  constructor(apiClient: XCloudApiClient, response: { sessionId: string; sessionPath: string }) {
    this.apiClient = apiClient;
    this.sessionId = response.sessionId;
    this.sessionPath = `/${response.sessionPath}`;
  }

  getSessionId() {
    return this.sessionId;
  }

  getSessionPath() {
    return this.sessionPath;
  }

  getState() {
    return this.state;
  }

  async refreshState() {
    const response = (await this.apiClient.get(`${this.sessionPath}/state`)) as { state: string };
    this.state = response.state;
    return this.state;
  }

  async waitForState(desiredState: string, timeoutMs = 60000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const state = await this.refreshState();
      if (state === desiredState) {
        return state;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Timed out waiting for stream state ${desiredState}`);
  }

  async sendSdpOffer(sdpOffer: RTCSessionDescriptionInit, requestId: string | number = "1") {
    await this.apiClient.post(`${this.sessionPath}/sdp`, JSON.stringify({
      messageType: "offer",
      sdp: sdpOffer.sdp,
      requestId,
      configuration: requestId === 2
        ? { isMediaStreamsChatRenegotiation: true }
        : {
            chatConfiguration: {
              bytesPerSample: 2,
              expectedClipDurationMs: 20,
              format: { codec: "opus", container: "webm" },
              numChannels: 1,
              sampleFrequencyHz: 24000,
            },
            chat: { minVersion: 1, maxVersion: 1 },
            control: { minVersion: 1, maxVersion: 3 },
            input: { minVersion: 1, maxVersion: 9 },
            message: { minVersion: 1, maxVersion: 1 },
            reliableinput: { minVersion: 9, maxVersion: 9 },
            unreliableinput: { minVersion: 9, maxVersion: 9 },
          },
    }));
    return this.waitForExchange("sdp", 500);
  }

  async sendChatSdpOffer(sdpOffer: RTCSessionDescriptionInit) {
    return this.sendSdpOffer(sdpOffer, 2);
  }

  async sendIceCandidates(candidates: string[]) {
    await this.apiClient.post(`${this.sessionPath}/ice`, JSON.stringify({ candidates }));
    return this.waitForExchange("ice", 1000);
  }

  async sendKeepalive() {
    return this.apiClient.post(`${this.sessionPath}/keepalive`, "");
  }

  async sendMsalAuth(userToken: string) {
    return this.apiClient.post(`${this.sessionPath}/connect`, JSON.stringify({ userToken }));
  }

  async stop() {
    return this.apiClient.delete(this.sessionPath);
  }

  private async waitForExchange(kind: "sdp" | "ice", delayMs: number) {
    while (true) {
      const response = await this.apiClient.get(`${this.sessionPath}/${kind}`);
      if ((response as { status?: number }).status !== 204) {
        return response as { exchangeResponse: string };
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
