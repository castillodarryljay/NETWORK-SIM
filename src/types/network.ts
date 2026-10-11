export type DeviceCategory = 'end-devices' | 'routers' | 'switches' | 'wireless' | 'security-wan';

export type DeviceType =
  | 'pc'
  | 'laptop'
  | 'server'
  | 'printer'
  | 'router'
  | 'l2-switch'
  | 'l3-switch'
  | 'wireless-ap'
  | 'wireless-router'
  | 'firewall'
  | 'wan-cloud';

export type InterfaceMediaType = 'ethernet' | 'fiber' | 'serial' | 'wireless';

export type LinkType = 'ethernet' | 'trunk' | 'serial' | 'fiber' | 'wireless';

export type SwitchportMode = 'access' | 'trunk' | 'routed';

export interface NetworkInterface {
  id: string;
  name: string; // e.g., "GigabitEthernet0/0", "FastEthernet0/1", "Eth0", "Serial0/0/0", "Wlan0"
  shortName: string; // e.g., "Gi0/0", "Fa0/1", "Eth0", "Se0/0/0"
  mediaType: InterfaceMediaType;
  macAddress: string;
  adminUp: boolean; // true = no shutdown, false = shutdown
  lineProtocolUp: boolean; // computed based on link and remote adminUp
  ipAddress: string; // IPv4 address or ""
  subnetMask: string; // e.g., "255.255.255.0" or ""
  ipv6Address?: string; // e.g., "2001:db8:1::1/64"
  description?: string;
  // Switchport properties
  switchportMode: SwitchportMode;
  accessVlan: number;
  trunkAllowedVlans: number[]; // e.g. [1, 10, 20, 30, 99]
  nativeVlan: number;
  stpState?: 'forwarding' | 'blocking' | 'learning' | 'disabled';
  connectedLinkId?: string;
  aclIn?: number;
  aclOut?: number;
  natDirection?: 'inside' | 'outside' | 'none';
}

export interface RouteEntry {
  id: string;
  type: 'C' | 'S' | 'S*' | 'O' | 'R'; // Connected, Static, Default Static, OSPF, RIP
  network: string;
  mask: string;
  nextHop: string; // IP or "Directly connected"
  interfaceName: string;
  administrativeDistance: number;
  metric: number;
}

export interface ArpEntry {
  ipAddress: string;
  macAddress: string;
  interfaceName: string;
  type: 'dynamic' | 'static';
  timestamp: number;
}

export interface MacTableEntry {
  vlan: number;
  macAddress: string;
  type: 'DYNAMIC' | 'STATIC';
  interfaceName: string;
}

export interface VlanDefinition {
  id: number;
  name: string;
  status: 'active' | 'suspended';
}

export interface DhcpPool {
  name: string;
  network: string;
  mask: string;
  defaultRouter: string;
  dnsServer: string;
  startIp: string;
  endIp: string;
  leases: Record<string, string>; // mac -> ip
}

export interface DnsRecord {
  id: string;
  hostname: string;
  ipAddress: string;
  type: 'A' | 'AAAA' | 'CNAME';
}

export interface AclRule {
  id: string;
  aclNumber: number; // 1-99 standard, 100-199 extended
  action: 'permit' | 'deny';
  protocol: 'ip' | 'icmp' | 'tcp' | 'udp';
  sourceIp: string; // "any" or IP
  sourceWildcard: string; // "0.0.0.0" or wildcard
  destIp: string; // "any" or IP
  destWildcard: string;
  dstPort?: number;
}

export type CliMode =
  | 'user_exec'
  | 'priv_exec'
  | 'global_config'
  | 'interface_config'
  | 'vlan_config'
  | 'router_ospf_config'
  | 'router_rip_config'
  | 'pc_shell';

export interface CliSessionState {
  mode: CliMode;
  selectedInterfaceId?: string;
  selectedVlanId?: number;
  history: string[];
  outputLines: { id: string; text: string; type?: 'input' | 'output' | 'error' | 'info' | 'success' }[];
}

export interface NetworkDevice {
  id: string;
  name: string; // Display label on canvas
  hostname: string; // Configured hostname in OS/CLI
  type: DeviceType;
  model: string;
  category: DeviceCategory;
  x: number;
  y: number;
  interfaces: NetworkInterface[];
  // End-device settings
   addressingMode?: 'static' | 'dhcp';
  defaultGateway: string;
  dnsServer: string;
  ipv6Gateway?: string;
  // Tables & Protocol states
  arpTable: ArpEntry[];
  macTable: MacTableEntry[];
  routingTable: RouteEntry[];
  vlans: VlanDefinition[];
  // Routing protocols
  ipRoutingEnabled: boolean; // true for routers, configurable on L3 switch
  ospfEnabled?: boolean;
  ospfProcessId?: number;
  ospfNetworks?: { network: string; wildcard: string; area: number }[];
  ripEnabled?: boolean;
  ripNetworks?: string[];
  // Security & NAT
  acls: AclRule[];
  natEnabled?: boolean;
  // Server Services
  services?: {
    httpEnabled: boolean;
    httpContent: string;
    dhcpEnabled: boolean;
    dhcpPools: DhcpPool[];
    dnsEnabled: boolean;
    dnsRecords: DnsRecord[];
  };
  // Wireless settings
  ssid?: string;
  wirelessChannel?: number;
  wirelessSecurity?: 'open' | 'wpa2-psk';
  wirelessPassphrase?: string;
  // Config persistence
  startupConfigSaved: boolean;
  annotations?: string;
  fileSystem?: DeviceFileSystem;
}

export interface NetworkLink {
  id: string;
  sourceDeviceId: string;
  sourceInterfaceId: string;
  targetDeviceId: string;
  targetInterfaceId: string;
  type: LinkType;
  status: 'up' | 'down' | 'amber';
  vlanId?: number;
  label?: string;
}

export interface CanvasAnnotation {
  id: string;
  text: string;
  x: number;
  y: number;
  color: 'slate' | 'cyan' | 'emerald' | 'amber';
}

export type ProtocolType = 'ARP' | 'ICMP' | 'DHCP' | 'DNS' | 'HTTP' | 'SMB' | 'FTP' | 'OSPF' | 'STP';

export interface VirtualFileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string | null; // null = root
  extension?: 'txt' | 'conf' | 'html' | 'json' | 'log' | 'md' | 'csv';
  content?: string;
  sizeBytes: number;
  permissions: 'rw-r--r--' | 'rwxr-xr-x' | 'rw-rw-rw-' | 'r--r--r--';
  isShared: boolean; // If true, exposed under \\IP\Shared or \\Hostname\Shared
  authorDeviceName: string;
  updatedAt: string;
}

export interface DeviceFileSystem {
  smbSharingEnabled: boolean;
  ftpServerEnabled: boolean;
  shareName: string; // e.g., "PublicShare" or "NetDocs"
  allowRemoteWrite: boolean; // Whether remote peers can live-edit shared files
  files: VirtualFileNode[];
}

export interface PacketStepEvent {
  id: string;
  stepIndex: number;
  timestamp: number;
  fromDeviceId: string;
  fromDeviceName: string;
  fromInterface: string;
  toDeviceId?: string;
  toDeviceName?: string;
  toInterface?: string;
  linkId?: string;
  protocol: ProtocolType;
  srcMac: string;
  dstMac: string;
  srcIp: string;
  dstIp: string;
  srcPort?: number;
  dstPort?: number;
  ttl: number;
  vlanId?: number;
  action: 'originate' | 'forward' | 'flood' | 'receive' | 'reply' | 'drop' | 'nat-translate' | 'encapsulate';
  summary: string;
  reason: string;
  osiLayers: {
    layer1: string;
    layer2: string;
    layer3?: string;
    layer4?: string;
    layer7?: string;
  };
  status: 'success' | 'warning' | 'error' | 'info';
}

export interface SimulationSession {
  id: string;
  title: string;
  sourceDeviceId: string;
  targetIp: string;
  protocol: ProtocolType;
  events: PacketStepEvent[];
  overallSuccess: boolean;
  summaryMessage: string;
  rttMs?: number;
}

export interface DiagnosticIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  confirmed: boolean; // true = Confirmed problem, false = Possible explanation
  deviceId: string;
  deviceName: string;
  interfaceName?: string;
  title: string;
  evidence: string;
  probableCause: string;
  suggestedAction: string;
  cliHint?: string;
}

export interface NetworkProject {
  id: string;
  version: string; // e.g., "1.0.0"
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  devices: NetworkDevice[];
  links: NetworkLink[];
  annotations: CanvasAnnotation[];
  labId?: string;
  challengeId?: string;
}

export interface DeviceModelTemplate {
  type: DeviceType;
  model: string;
  namePrefix: string;
  category: DeviceCategory;
  description: string;
  interfaceSummary: string;
  capabilities: string[];
  unsupportedFeatures: string[];
  defaultInterfaces: Omit<NetworkInterface, 'id' | 'macAddress' | 'lineProtocolUp'>[];
}
