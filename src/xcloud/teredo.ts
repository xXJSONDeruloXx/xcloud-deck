export default class Teredo {
  private ipv4Address: string;
  private ipv4Port: number;

  constructor(address: string) {
    const split = address.split(":");
    const ipv4Part = split[6] + split[7];
    const portPart = split[5];

    const ip1 = (~parseInt(ipv4Part.substring(0, 2), 16)) & 0xff;
    const ip2 = (~parseInt(ipv4Part.substring(2, 4), 16)) & 0xff;
    const ip3 = (~parseInt(ipv4Part.substring(4, 6), 16)) & 0xff;
    const ip4 = (~parseInt(ipv4Part.substring(6, 8), 16)) & 0xff;
    const port = (~parseInt(portPart.substring(0, 4), 16)) & 0xffff;

    this.ipv4Address = `${ip1}.${ip2}.${ip3}.${ip4}`;
    this.ipv4Port = port;
  }

  getIpv4Address() {
    return this.ipv4Address;
  }

  getIpv4Port() {
    return this.ipv4Port;
  }
}
