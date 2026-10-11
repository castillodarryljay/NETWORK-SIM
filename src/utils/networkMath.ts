import { DeviceFileSystem, DeviceModelTemplate, NetworkDevice, NetworkInterface } from '../types/network';

let macCounter = 100;

export function generateMacAddress(seed?: number): string {
  const num = seed !== undefined ? seed : ++macCounter;
  const hex = num.toString(16).padStart(6, '0').toUpperCase();
  return `00:50:79:${hex.slice(0, 2)}:${hex.slice(2, 4)}:${hex.slice(4, 6)}`;
}

export function ipToLong(ip: string): number | null {
  if (!ip || typeof ip !== 'string') return null;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = parseInt(part, 10);
    if (n < 0 || n > 255) return null;
    result = (result << 8) + n;
  }
  return result >>> 0;
}

export function longToIp(long: number): string {
  return [
    (long >>> 24) & 255,
    (long >>> 16) & 255,
    (long >>> 8) & 255,
    long & 255,
  ].join('.');
}

export function isValidIpv4(ip: string): boolean {
  return ipToLong(ip) !== null;
}

export function isValidSubnetMask(mask: string): boolean {
  const l = ipToLong(mask);
  if (l === null) return false;
  if (l === 0) return false;
  const inv = ~l >>> 0;
  return ((inv + 1) & inv) === 0;
}

export function maskToCidr(mask: string): number {
  const l = ipToLong(mask);
  if (l === null) return 24;
  return l.toString(2).split('1').length - 1;
}

export function cidrToMask(cidr: number): string {
  if (cidr < 0 || cidr > 32) return '255.255.255.0';
  const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
  return longToIp(mask);
}

export function getNetworkAddress(ip: string, mask: string): string {
  const ipL = ipToLong(ip);
  const maskL = ipToLong(mask);
  if (ipL === null || maskL === null) return '';
  return longToIp((ipL & maskL) >>> 0);
}

export function getBroadcastAddress(ip: string, mask: string): string {
  const ipL = ipToLong(ip);
  const maskL = ipToLong(mask);
  if (ipL === null || maskL === null) return '';
  const invMask = ~maskL >>> 0;
  return longToIp(((ipL & maskL) | invMask) >>> 0);
}

export function isSameSubnet(ip1: string, ip2: string, mask: string): boolean {
  const ip1L = ipToLong(ip1);
  const ip2L = ipToLong(ip2);
  const maskL = ipToLong(mask);
  if (ip1L === null || ip2L === null || maskL === null) return false;
  return ((ip1L & maskL) >>> 0) === ((ip2L & maskL) >>> 0);
}

export function ipMatchesSubnet(ip: string, network: string, mask: string): boolean {
  const ipL = ipToLong(ip);
  const netL = ipToLong(network);
  const maskL = ipToLong(mask);
  if (ipL === null || netL === null || maskL === null) return false;
  return ((ipL & maskL) >>> 0) === ((netL & maskL) >>> 0);
}

export function ipToBinaryString(ip: string): string {
  const parts = ip.split('.');
  if (parts.length !== 4) return '';
  return parts
    .map((p) => {
      const n = parseInt(p, 10);
      return isNaN(n) ? '00000000' : n.toString(2).padStart(8, '0');
    })
    .join('.');
}

export interface SubnetCalculationResult {
  valid: boolean;
  error?: string;
  ipAddress: string;
  subnetMask: string;
  wildcardMask: string;
  cidr: number;
  networkAddress: string;
  broadcastAddress: string;
  firstUsableHost: string;
  lastUsableHost: string;
  totalAddresses: number;
  usableHosts: number;
  ipClass: string;
  ipScope: string;
  binaryIp: string;
  binaryMask: string;
  binaryNetwork: string;
}

export function calculateSubnetDetails(ipInput: string, maskOrCidrInput: string): SubnetCalculationResult {
  const cleanIp = ipInput.trim();
  const ipL = ipToLong(cleanIp);
  if (ipL === null) {
    return {
      valid: false,
      error: 'Enter a valid IPv4 address (e.g., 192.168.10.25).',
      ipAddress: cleanIp,
      subnetMask: '',
      wildcardMask: '',
      cidr: 0,
      networkAddress: '',
      broadcastAddress: '',
      firstUsableHost: '',
      lastUsableHost: '',
      totalAddresses: 0,
      usableHosts: 0,
      ipClass: '',
      ipScope: '',
      binaryIp: '',
      binaryMask: '',
      binaryNetwork: '',
    };
  }

  let cidr = 24;
  let maskStr = '255.255.255.0';
  const cleanMask = maskOrCidrInput.trim().replace(/^\//, '');
  if (/^\d+$/.test(cleanMask)) {
    const c = parseInt(cleanMask, 10);
    if (c < 1 || c > 32) {
      return {
        valid: false,
        error: 'Prefix length must be between /1 and /32.',
        ipAddress: cleanIp,
        subnetMask: '',
        wildcardMask: '',
        cidr: c,
        networkAddress: '',
        broadcastAddress: '',
        firstUsableHost: '',
        lastUsableHost: '',
        totalAddresses: 0,
        usableHosts: 0,
        ipClass: '',
        ipScope: '',
        binaryIp: '',
        binaryMask: '',
        binaryNetwork: '',
      };
    }
    cidr = c;
    maskStr = cidrToMask(c);
  } else {
    if (!isValidSubnetMask(cleanMask)) {
      return {
        valid: false,
        error: 'Invalid subnet mask. Must contain contiguous 1 bits (e.g., 255.255.255.0).',
        ipAddress: cleanIp,
        subnetMask: cleanMask,
        wildcardMask: '',
        cidr: 0,
        networkAddress: '',
        broadcastAddress: '',
        firstUsableHost: '',
        lastUsableHost: '',
        totalAddresses: 0,
        usableHosts: 0,
        ipClass: '',
        ipScope: '',
        binaryIp: '',
        binaryMask: '',
        binaryNetwork: '',
      };
    }
    maskStr = cleanMask;
    cidr = maskToCidr(cleanMask);
  }

  const maskL = ipToLong(maskStr)!;
  const wildcardL = ~maskL >>> 0;
  const netL = (ipL & maskL) >>> 0;
  const bcastL = (netL | wildcardL) >>> 0;

  const totalAddresses = Math.pow(2, 32 - cidr);
  let usableHosts = Math.max(0, totalAddresses - 2);
  let firstHost = longToIp(netL + 1);
  let lastHost = longToIp(bcastL - 1);

  if (cidr === 31) {
    usableHosts = 2;
    firstHost = longToIp(netL);
    lastHost = longToIp(bcastL);
  } else if (cidr === 32) {
    usableHosts = 1;
    firstHost = cleanIp;
    lastHost = cleanIp;
  }

  const firstOctet = (ipL >>> 24) & 255;
  const secondOctet = (ipL >>> 16) & 255;
  let ipClass = 'Class A';
  if (firstOctet >= 128 && firstOctet <= 191) ipClass = 'Class B';
  else if (firstOctet >= 192 && firstOctet <= 223) ipClass = 'Class C';
  else if (firstOctet >= 224 && firstOctet <= 239) ipClass = 'Class D (Multicast)';
  else if (firstOctet >= 240) ipClass = 'Class E (Experimental)';

  let ipScope = 'Public Unicast';
  if (
    firstOctet === 10 ||
    (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
    (firstOctet === 192 && secondOctet === 168)
  ) {
    ipScope = 'Private (RFC 1918)';
  } else if (firstOctet === 127) {
    ipScope = 'Loopback';
  } else if (firstOctet === 169 && secondOctet === 254) {
    ipScope = 'Link-Local (APIPA)';
  }

  return {
    valid: true,
    ipAddress: cleanIp,
    subnetMask: maskStr,
    wildcardMask: longToIp(wildcardL),
    cidr,
    networkAddress: longToIp(netL),
    broadcastAddress: cidr === 32 ? 'N/A (/32 Host Route)' : longToIp(bcastL),
    firstUsableHost: firstHost,
    lastUsableHost: lastHost,
    totalAddresses,
    usableHosts,
    ipClass,
    ipScope,
    binaryIp: ipToBinaryString(cleanIp),
    binaryMask: ipToBinaryString(maskStr),
    binaryNetwork: ipToBinaryString(longToIp(netL)),
  };
}

export const DEVICE_CATALOG: DeviceModelTemplate[] = [
  {
    type: 'pc',
    model: 'NetStation Desktop PC-100',
    namePrefix: 'PC',
    category: 'end-devices',
    description: 'Standard desktop workstation with Gigabit Ethernet, IPv4/IPv6 stack, DHCP client, ARP cache, and desktop diagnostic tools.',
    interfaceSummary: '1x GigabitEthernet (Eth0)',
    capabilities: ['IPv4 & IPv6 Static/DHCP', 'ICMP Ping & Traceroute', 'ARP Inspection', 'HTTP Web Client', 'DNS Resolver'],
    unsupportedFeatures: ['OSPF/RIP Routing', '802.1Q Trunking'],
    defaultInterfaces: [
      {
        name: 'Ethernet0',
        shortName: 'Eth0',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '',
        subnetMask: '255.255.255.0',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
    ],
  },
  {
    type: 'laptop',
    model: 'NetBook Pro LT-200',
    namePrefix: 'Laptop',
    category: 'end-devices',
    description: 'Portable student workstation supporting both wired Ethernet and 802.11ac Wireless LAN association.',
    interfaceSummary: '1x Ethernet (Eth0), 1x Wireless (Wlan0)',
    capabilities: ['Wired & Wireless Association', 'DHCP Client', 'Command Prompt', 'Browser & DNS Tools'],
    unsupportedFeatures: ['Layer 3 Forwarding', 'VLAN Tagging'],
    defaultInterfaces: [
      {
        name: 'Ethernet0',
        shortName: 'Eth0',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '',
        subnetMask: '255.255.255.0',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'Wireless0',
        shortName: 'Wlan0',
        mediaType: 'wireless',
        adminUp: true,
        ipAddress: '',
        subnetMask: '255.255.255.0',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
    ],
  },
  {
    type: 'server',
    model: 'NetRack Server SRV-500',
    namePrefix: 'SRV',
    category: 'end-devices',
    description: 'Multi-service rack server hosting configurable HTTP web pages, authoritative DNS records, and DHCP address pools.',
    interfaceSummary: '2x GigabitEthernet (Eth0, Eth1)',
    capabilities: ['HTTP Server (Port 80)', 'DNS Server (Port 53)', 'DHCP Server (IP Pools)', 'ICMP & ARP Responder'],
    unsupportedFeatures: ['BGP Peering', 'Hardware RAID Emulation'],
    defaultInterfaces: [
      {
        name: 'Ethernet0',
        shortName: 'Eth0',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '',
        subnetMask: '255.255.255.0',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'Ethernet1',
        shortName: 'Eth1',
        mediaType: 'ethernet',
        adminUp: false,
        ipAddress: '',
        subnetMask: '255.255.255.0',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
    ],
  },
  {
    type: 'printer',
    model: 'LaserJet NetPrint PRN-10',
    namePrefix: 'Printer',
    category: 'end-devices',
    description: 'Networked enterprise printer endpoint for testing static IP reservations, VLAN segmentation, and ACL reachability.',
    interfaceSummary: '1x FastEthernet (Fa0)',
    capabilities: ['Static/DHCP IPv4', 'ICMP Echo Reply', 'ARP Resolution'],
    unsupportedFeatures: ['Interactive Web Browser', 'Routing'],
    defaultInterfaces: [
      {
        name: 'FastEthernet0',
        shortName: 'Fa0',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '',
        subnetMask: '255.255.255.0',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
    ],
  },
  {
    type: 'router',
    model: 'Cisco ISR 4321 Router',
    namePrefix: 'R',
    category: 'routers',
    description: 'Enterprise modular router with Gigabit Ethernet, Serial WAN, and Fiber SFP ports. Full IOS-style CLI for static routing, OSPF, RIP, ACLs, and NAT.',
    interfaceSummary: '3x GigabitEthernet, 1x Serial WAN, 1x Fiber',
    capabilities: ['Cisco IOS CLI', 'Connected & Static Routing', 'OSPF & RIP', 'Standard/Extended ACLs', 'NAT/PAT'],
    unsupportedFeatures: ['BGP/EIGRP', 'Hardware Crypto IPSec'],
    defaultInterfaces: [
      {
        name: 'GigabitEthernet0/0',
        shortName: 'Gi0/0',
        mediaType: 'ethernet',
        adminUp: false,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'GigabitEthernet0/1',
        shortName: 'Gi0/1',
        mediaType: 'ethernet',
        adminUp: false,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'GigabitEthernet0/2',
        shortName: 'Gi0/2',
        mediaType: 'ethernet',
        adminUp: false,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'Serial0/0/0',
        shortName: 'Se0/0/0',
        mediaType: 'serial',
        adminUp: false,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'GigabitEthernet0/3-SFP',
        shortName: 'Gi0/3',
        mediaType: 'fiber',
        adminUp: false,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
    ],
  },
  {
    type: 'l2-switch',
    model: 'Catalyst 2960-24TT Switch',
    namePrefix: 'SW',
    category: 'switches',
    description: 'Managed Layer 2 Ethernet switch supporting MAC learning, VLAN segmentation, 802.1Q trunking, and Spanning Tree Protocol (STP).',
    interfaceSummary: '6x FastEthernet (Fa0/1–Fa0/6), 2x Gigabit Uplink (Gi0/1–Gi0/2)',
    capabilities: ['MAC Learning & Aging', 'VLAN Access Ports', '802.1Q Trunk Ports', 'Spanning Tree Loop Prevention', 'IOS CLI'],
    unsupportedFeatures: ['Layer 3 IP Routing', 'NAT'],
    defaultInterfaces: [
      ...[1, 2, 3, 4, 5, 6].map((num) => ({
        name: `FastEthernet0/${num}`,
        shortName: `Fa0/${num}`,
        mediaType: 'ethernet' as const,
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'access' as const,
        accessVlan: 1,
        trunkAllowedVlans: [1, 10, 20, 30, 99],
        nativeVlan: 1,
      })),
      {
        name: 'GigabitEthernet0/1',
        shortName: 'Gi0/1',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'access',
        accessVlan: 1,
        trunkAllowedVlans: [1, 10, 20, 30, 99],
        nativeVlan: 1,
      },
      {
        name: 'GigabitEthernet0/2',
        shortName: 'Gi0/2',
        mediaType: 'fiber',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'trunk',
        accessVlan: 1,
        trunkAllowedVlans: [1, 10, 20, 30, 99],
        nativeVlan: 1,
      },
    ],
  },
  {
    type: 'l3-switch',
    model: 'Catalyst 3650 Multilayer Switch',
    namePrefix: 'MLS',
    category: 'switches',
    description: 'Enterprise Layer 3 multilayer switch combining wire-speed VLAN switching with inter-VLAN routing and routed ports.',
    interfaceSummary: '4x GigabitEthernet (Gi1/0/1–Gi1/0/4), 2x Routed/Trunk Uplinks',
    capabilities: ['Layer 2 VLAN Switching', 'Inter-VLAN Routing', 'Routed Ports (no switchport)', 'Static & OSPF Routing', 'IOS CLI'],
    unsupportedFeatures: ['Serial WAN Interfaces'],
    defaultInterfaces: [
      ...[1, 2, 3, 4].map((num) => ({
        name: `GigabitEthernet1/0/${num}`,
        shortName: `Gi1/0/${num}`,
        mediaType: 'ethernet' as const,
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'access' as const,
        accessVlan: 1,
        trunkAllowedVlans: [1, 10, 20, 30, 99],
        nativeVlan: 1,
      })),
      {
        name: 'Vlan10',
        shortName: 'Vlan10',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'routed',
        accessVlan: 10,
        trunkAllowedVlans: [10],
        nativeVlan: 10,
      },
      {
        name: 'Vlan20',
        shortName: 'Vlan20',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'routed',
        accessVlan: 20,
        trunkAllowedVlans: [20],
        nativeVlan: 20,
      },
    ],
  },
  {
    type: 'wireless-ap',
    model: 'Aironet 1830 Wireless AP',
    namePrefix: 'AP',
    category: 'wireless',
    description: 'Dual-band 802.11ac Wireless Access Point bridging wireless laptops and devices onto the wired Ethernet LAN.',
    interfaceSummary: '1x GigabitEthernet (Gi0), 2x Wireless Associations (Wlan0–Wlan1)',
    capabilities: ['SSID & Channel Config', 'WPA2-PSK Security', 'Layer 2 Bridging between Wi-Fi & Ethernet'],
    unsupportedFeatures: ['WLC CAPWAP Tunneling', 'RADIUS 802.1X'],
    defaultInterfaces: [
      {
        name: 'GigabitEthernet0',
        shortName: 'Gi0',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'access',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'Wireless0',
        shortName: 'Wlan0',
        mediaType: 'wireless',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'access',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'Wireless1',
        shortName: 'Wlan1',
        mediaType: 'wireless',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'access',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
    ],
  },
  {
    type: 'wireless-router',
    model: 'NetLink SOHO WRT-300N',
    namePrefix: 'WRT',
    category: 'wireless',
    description: 'All-in-one small office router with 1 WAN port, 2 LAN switch ports, and integrated Wi-Fi Access Point.',
    interfaceSummary: '1x Internet WAN (Gi0/0), 2x LAN (Fa0/1–0/2), 1x Wi-Fi (Wlan0)',
    capabilities: ['Routing & Default Gateway', 'Wireless SSID Broadcasting', 'Built-in NAT/Firewall'],
    unsupportedFeatures: ['Enterprise OSPF', 'Serial WAN'],
    defaultInterfaces: [
      {
        name: 'GigabitEthernet0/0',
        shortName: 'Gi0/0',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '192.168.1.1',
        subnetMask: '255.255.255.0',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'GigabitEthernet0/1',
        shortName: 'Gi0/1',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'Wireless0',
        shortName: 'Wlan0',
        mediaType: 'wireless',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'access',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
    ],
  },
  {
    type: 'firewall',
    model: 'SecureGate ASA-5506-X',
    namePrefix: 'FW',
    category: 'security-wan',
    description: 'Next-gen security appliance enforcing stateful packet filtering, extended ACL rules, and perimeter NAT.',
    interfaceSummary: '2x GigabitEthernet (Gi0/0 Inside, Gi0/1 Outside), 1x DMZ (Gi0/2)',
    capabilities: ['Inbound/Outbound ACL Filtering', 'Layer 3 Routing', 'Perimeter NAT Inspection', 'IOS-style Security CLI'],
    unsupportedFeatures: ['Deep Packet SSL Decryption', 'Site-to-Site IPSec VPN'],
    defaultInterfaces: [
      {
        name: 'GigabitEthernet0/0',
        shortName: 'Gi0/0',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        description: 'INSIDE-LAN',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'GigabitEthernet0/1',
        shortName: 'Gi0/1',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        description: 'OUTSIDE-WAN',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'GigabitEthernet0/2',
        shortName: 'Gi0/2',
        mediaType: 'ethernet',
        adminUp: false,
        ipAddress: '',
        subnetMask: '',
        description: 'DMZ-SEGMENT',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
    ],
  },
  {
    type: 'wan-cloud',
    model: 'ISP Metro WAN Cloud',
    namePrefix: 'ISP-WAN',
    category: 'security-wan',
    description: 'Simulated Service Provider WAN backbone connecting Serial, Fiber, and Ethernet edge routers across sites.',
    interfaceSummary: '2x Serial (Se0/0/0–0/0/1), 1x Fiber (Gi0/1), 1x Ethernet (Gi0/0)',
    capabilities: ['Multi-Site WAN Transit', 'Public IP Routing', 'Serial & Fiber Terminations'],
    unsupportedFeatures: ['MPLS Traffic Engineering'],
    defaultInterfaces: [
      {
        name: 'GigabitEthernet0/0',
        shortName: 'Gi0/0',
        mediaType: 'ethernet',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'GigabitEthernet0/1-SFP',
        shortName: 'Gi0/1',
        mediaType: 'fiber',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'Serial0/0/0',
        shortName: 'Se0/0/0',
        mediaType: 'serial',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
      {
        name: 'Serial0/0/1',
        shortName: 'Se0/0/1',
        mediaType: 'serial',
        adminUp: true,
        ipAddress: '',
        subnetMask: '',
        switchportMode: 'routed',
        accessVlan: 1,
        trunkAllowedVlans: [1],
        nativeVlan: 1,
      },
    ],
  },
];

export function createDefaultFileSystem(deviceName: string, type: NetworkDevice['type']): DeviceFileSystem {
  const now = new Date().toISOString();
  const isServer = type === 'server';

  return {
    smbSharingEnabled: true,
    ftpServerEnabled: isServer,
    shareName: isServer ? 'EnterpriseShare' : 'SharedDocs',
    allowRemoteWrite: true,
    files: [
      {
        id: `dir-docs-${deviceName}`,
        name: 'Documents',
        type: 'folder',
        parentId: null,
        sizeBytes: 0,
        permissions: 'rwxr-xr-x',
        isShared: false,
        authorDeviceName: deviceName,
        updatedAt: now,
      },
      {
        id: `dir-shared-${deviceName}`,
        name: 'Shared_Network_Folder',
        type: 'folder',
        parentId: null,
        sizeBytes: 0,
        permissions: 'rwxr-xr-x',
        isShared: true,
        authorDeviceName: deviceName,
        updatedAt: now,
      },
      {
        id: `dir-configs-${deviceName}`,
        name: 'Router_Configs',
        type: 'folder',
        parentId: null,
        sizeBytes: 0,
        permissions: 'rwxr-xr-x',
        isShared: true,
        authorDeviceName: deviceName,
        updatedAt: now,
      },
      {
        id: `file-readme-${deviceName}`,
        name: 'Lab_Notes.md',
        type: 'file',
        extension: 'md',
        parentId: `dir-docs-${deviceName}`,
        content: `# ${deviceName} Workstation Notes\n\n- Hostname: ${deviceName}\n- Use the **Shared_Network_Folder** to share files over SMB (TCP Port 445) or FTP (TCP Port 21) with other reachable PCs and Servers.\n- Any file marked as **Shared** can be opened and live-edited remotely if network routing and ACLs permit connectivity!`,
        sizeBytes: 342,
        permissions: 'rw-r--r--',
        isShared: false,
        authorDeviceName: deviceName,
        updatedAt: now,
      },
      {
        id: `file-shared-plan-${deviceName}`,
        name: `${deviceName}_Subnet_Plan.txt`,
        type: 'file',
        extension: 'txt',
        parentId: `dir-shared-${deviceName}`,
        content: `=== ${deviceName} Shared Network Plan ===\nVLAN 10 (Students): 192.168.10.0/24 (GW: 192.168.10.1)\nVLAN 20 (Faculty):  192.168.20.0/24 (GW: 192.168.20.1)\n\n[Live Collaborative File: Edit this file from any reachable PC on the network!]`,
        sizeBytes: 248,
        permissions: 'rw-rw-rw-',
        isShared: true,
        authorDeviceName: deviceName,
        updatedAt: now,
      },
      {
        id: `file-ios-backup-${deviceName}`,
        name: 'R1_startup_backup.conf',
        type: 'file',
        extension: 'conf',
        parentId: `dir-configs-${deviceName}`,
        content: `!\nhostname R1-Backup\n!\ninterface GigabitEthernet0/0\n ip address 192.168.10.1 255.255.255.0\n no shutdown\n!\nip route 0.0.0.0 0.0.0.0 10.0.0.2\n!\nend`,
        sizeBytes: 164,
        permissions: 'rw-rw-rw-',
        isShared: true,
        authorDeviceName: deviceName,
        updatedAt: now,
      },
      ...(isServer
        ? [
            {
              id: `file-srv-index-${deviceName}`,
              name: 'index.html',
              type: 'file' as const,
              extension: 'html' as const,
              parentId: `dir-shared-${deviceName}`,
              content: `<h1>Welcome to ${deviceName} Enterprise Portal</h1><p>This HTML file is stored in the Server File System. Edit it to update the live website!</p>`,
              sizeBytes: 156,
              permissions: 'rw-rw-rw-' as const,
              isShared: true,
              authorDeviceName: deviceName,
              updatedAt: now,
            },
          ]
        : []),
    ],
  };
}

export function createDeviceFromTemplate(
  template: DeviceModelTemplate,
  indexNumber: number,
  x: number,
  y: number
): NetworkDevice {
  const id = `dev-${template.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const name = `${template.namePrefix}${indexNumber}`;

  const interfaces: NetworkInterface[] = template.defaultInterfaces.map((intf, idx) => ({
    ...intf,
    id: `${id}-if-${idx}`,
    macAddress: generateMacAddress(),
    lineProtocolUp: false,
  }));

  const isL3 =
    template.type === 'router' ||
    template.type === 'l3-switch' ||
    template.type === 'wireless-router' ||
    template.type === 'firewall' ||
    template.type === 'wan-cloud';

  return {
    id,
    name,
    hostname: name,
    type: template.type,
    model: template.model,
    category: template.category,
    x,
    y,
    interfaces,
    addressingMode: 'static',
    defaultGateway: '',
    dnsServer: '',
    arpTable: [],
    macTable: [],
    routingTable: [],
    vlans: [
      { id: 1, name: 'default', status: 'active' },
      { id: 10, name: 'STUDENTS', status: 'active' },
      { id: 20, name: 'FACULTY', status: 'active' },
      { id: 30, name: 'SERVERS', status: 'active' },
      { id: 99, name: 'MANAGEMENT', status: 'active' },
    ],
    ipRoutingEnabled: isL3,
    ospfEnabled: false,
    ospfProcessId: 1,
    ospfNetworks: [],
    ripEnabled: false,
    ripNetworks: [],
    acls: [],
    natEnabled: template.type === 'wireless-router',
    services:
      template.type === 'server'
        ? {
            httpEnabled: true,
            httpContent: `<h1>Welcome to ${name} Enterprise Portal</h1><p>Server Status: Operational (HTTP/1.1 200 OK)</p>`,
            dhcpEnabled: true,
            dhcpPools: [
              {
                name: 'LAN_POOL',
                network: '192.168.10.0',
                mask: '255.255.255.0',
                defaultRouter: '192.168.10.1',
                dnsServer: '192.168.10.10',
                startIp: '192.168.10.100',
                endIp: '192.168.10.150',
                leases: {},
              },
            ],
            dnsEnabled: true,
            dnsRecords: [
              { id: 'dns-1', hostname: 'intranet.netlab.edu', ipAddress: '192.168.10.10', type: 'A' },
              { id: 'dns-2', hostname: 'portal.netlab.edu', ipAddress: '10.0.0.100', type: 'A' },
            ],
          }
        : undefined,
    ssid: template.type === 'wireless-ap' || template.type === 'wireless-router' ? 'NetLab-Campus-WiFi' : undefined,
    wirelessChannel: template.type === 'wireless-ap' || template.type === 'wireless-router' ? 6 : undefined,
    wirelessSecurity: 'wpa2-psk',
    wirelessPassphrase: 'CCNA2026',
    startupConfigSaved: true,
    fileSystem:
      template.type === 'pc' || template.type === 'laptop' || template.type === 'server'
        ? createDefaultFileSystem(name, template.type)
        : undefined,
  };
}
