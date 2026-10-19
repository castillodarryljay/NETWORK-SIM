import { NetworkDevice, NetworkLink, NetworkProject } from '../types/network';
import { DEVICE_CATALOG, createDeviceFromTemplate } from '../utils/networkMath';
import { synchronizeNetworkState } from '../engine/simulationEngine';

function makeDevice(
  type: NetworkDevice['type'],
  index: number,
  x: number,
  y: number,
  customName?: string
): NetworkDevice {
  const tpl = DEVICE_CATALOG.find((t) => t.type === type)!;
  const dev = createDeviceFromTemplate(tpl, index, x, y);
  if (customName) {
    dev.name = customName;
    dev.hostname = customName;
  }
  return dev;
}

export interface NetworkTemplateDefinition {
  id: string;
  name: string;
  category: 'Starter LAN' | 'Routing' | 'VLANs & Switching' | 'Services' | 'Enterprise' | 'Troubleshooting' | 'Network Topologies';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  learningObjectives: string[];
  buildProject: () => NetworkProject;
}

export const NETWORK_TEMPLATES: NetworkTemplateDefinition[] = [
  {
    id: 'tpl-two-pc-switch',
    name: '1. Two-PC Switched LAN (Verified Demo)',
    category: 'Starter LAN',
    difficulty: 'Beginner',
    description:
      'Two desktop PCs connected through a Catalyst 2960 Layer 2 switch on the 192.168.1.0/24 subnet. Ready for immediate ARP, MAC learning, and ICMP ping testing.',
    learningObjectives: [
      'Understand Ethernet Layer 2 frame switching and MAC address learning',
      'Observe ARP broadcast resolution prior to the first ICMP Echo Request',
      'Inspect the switch MAC address table using "show mac address-table"',
    ],
    buildProject: () => {
      const pc1 = makeDevice('pc', 1, 140, 220, 'PC1');
      pc1.interfaces[0].ipAddress = '192.168.1.10';
      pc1.interfaces[0].subnetMask = '255.255.255.0';
      pc1.defaultGateway = '192.168.1.1';

      const sw1 = makeDevice('l2-switch', 1, 420, 220, 'SW1');

      const pc2 = makeDevice('pc', 2, 700, 220, 'PC2');
      pc2.interfaces[0].ipAddress = '192.168.1.20';
      pc2.interfaces[0].subnetMask = '255.255.255.0';
      pc2.defaultGateway = '192.168.1.1';

      const links: NetworkLink[] = [
        {
          id: 'link-1',
          sourceDeviceId: pc1.id,
          sourceInterfaceId: pc1.interfaces[0].id,
          targetDeviceId: sw1.id,
          targetInterfaceId: sw1.interfaces[0].id, // Fa0/1
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'link-2',
          sourceDeviceId: pc2.id,
          sourceInterfaceId: pc2.interfaces[0].id,
          targetDeviceId: sw1.id,
          targetInterfaceId: sw1.interfaces[1].id, // Fa0/2
          type: 'ethernet',
          status: 'up',
        },
      ];

      const synced = synchronizeNetworkState([pc1, sw1, pc2], links);
      return {
        id: 'proj-two-pc-lan',
        version: '1.0.0',
        name: 'Two-PC Switched LAN',
        description: 'Verified Layer 2 LAN topology on 192.168.1.0/24.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        devices: synced.devices,
        links: synced.links,
        annotations: [
          {
            id: 'ann-1',
            text: 'Subnet: 192.168.1.0/24 — Try pinging 192.168.1.20 from PC1',
            x: 280,
            y: 110,
            color: 'cyan',
          },
        ],
      };
    },
  },
  {
    id: 'tpl-two-lan-routers',
    name: '2. Dual-LAN Static Routing Topology',
    category: 'Routing',
    difficulty: 'Intermediate',
    description:
      'Two separate LANs (192.168.10.0/24 and 192.168.20.0/24) interconnected by two Cisco ISR 4321 routers over a 10.0.0.0/30 transit link with static routes.',
    learningObjectives: [
      'Trace how packets cross Layer 3 router boundaries using Default Gateways',
      'Inspect TTL decrement and MAC header rewrite at each router hop',
      'Examine connected (C) and static (S) routes via "show ip route"',
    ],
    buildProject: () => {
      const pc1 = makeDevice('pc', 1, 100, 320, 'PC-West');
      pc1.interfaces[0].ipAddress = '192.168.10.10';
      pc1.interfaces[0].subnetMask = '255.255.255.0';
      pc1.defaultGateway = '192.168.10.1';

      const sw1 = makeDevice('l2-switch', 1, 280, 320, 'SW-West');

      const r1 = makeDevice('router', 1, 380, 160, 'R1-West');
      r1.interfaces[0].adminUp = true; // Gi0/0
      r1.interfaces[0].ipAddress = '192.168.10.1';
      r1.interfaces[0].subnetMask = '255.255.255.0';
      r1.interfaces[1].adminUp = true; // Gi0/1
      r1.interfaces[1].ipAddress = '10.0.0.1';
      r1.interfaces[1].subnetMask = '255.255.255.252';
      r1.routingTable.push({
        id: 'sr-r1',
        type: 'S',
        network: '192.168.20.0',
        mask: '255.255.255.0',
        nextHop: '10.0.0.2',
        interfaceName: 'Gi0/1',
        administrativeDistance: 1,
        metric: 0,
      });

      const r2 = makeDevice('router', 2, 640, 160, 'R2-East');
      r2.interfaces[0].adminUp = true; // Gi0/0
      r2.interfaces[0].ipAddress = '192.168.20.1';
      r2.interfaces[0].subnetMask = '255.255.255.0';
      r2.interfaces[1].adminUp = true; // Gi0/1
      r2.interfaces[1].ipAddress = '10.0.0.2';
      r2.interfaces[1].subnetMask = '255.255.255.252';
      r2.routingTable.push({
        id: 'sr-r2',
        type: 'S',
        network: '192.168.10.0',
        mask: '255.255.255.0',
        nextHop: '10.0.0.1',
        interfaceName: 'Gi0/1',
        administrativeDistance: 1,
        metric: 0,
      });

      const sw2 = makeDevice('l2-switch', 2, 740, 320, 'SW-East');

      const pc2 = makeDevice('pc', 2, 920, 320, 'PC-East');
      pc2.interfaces[0].ipAddress = '192.168.20.10';
      pc2.interfaces[0].subnetMask = '255.255.255.0';
      pc2.defaultGateway = '192.168.20.1';

      const links: NetworkLink[] = [
        {
          id: 'l-1',
          sourceDeviceId: pc1.id,
          sourceInterfaceId: pc1.interfaces[0].id,
          targetDeviceId: sw1.id,
          targetInterfaceId: sw1.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'l-2',
          sourceDeviceId: sw1.id,
          sourceInterfaceId: sw1.interfaces[6].id, // Gi0/1
          targetDeviceId: r1.id,
          targetInterfaceId: r1.interfaces[0].id, // Gi0/0
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'l-3',
          sourceDeviceId: r1.id,
          sourceInterfaceId: r1.interfaces[1].id, // Gi0/1
          targetDeviceId: r2.id,
          targetInterfaceId: r2.interfaces[1].id, // Gi0/1
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'l-4',
          sourceDeviceId: r2.id,
          sourceInterfaceId: r2.interfaces[0].id, // Gi0/0
          targetDeviceId: sw2.id,
          targetInterfaceId: sw2.interfaces[6].id, // Gi0/1
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'l-5',
          sourceDeviceId: sw2.id,
          sourceInterfaceId: sw2.interfaces[0].id, // Fa0/1
          targetDeviceId: pc2.id,
          targetInterfaceId: pc2.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
      ];

      const synced = synchronizeNetworkState([pc1, sw1, r1, r2, sw2, pc2], links);
      return {
        id: 'proj-dual-lan-routing',
        version: '1.0.0',
        name: 'Dual-LAN Static Routing',
        description: 'Two LANs routed across R1-West and R2-East.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        devices: synced.devices,
        links: synced.links,
        annotations: [
          { id: 'a1', text: 'West LAN: 192.168.10.0/24', x: 110, y: 420, color: 'cyan' },
          { id: 'a2', text: 'Transit Link: 10.0.0.0/30', x: 430, y: 95, color: 'emerald' },
          { id: 'a3', text: 'East LAN: 192.168.20.0/24', x: 760, y: 420, color: 'cyan' },
        ],
      };
    },
  },
  {
    id: 'tpl-vlan-classroom',
    name: '3. VLAN-Separated Classroom & Trunking',
    category: 'VLANs & Switching',
    difficulty: 'Intermediate',
    description:
      'Classroom topology with VLAN 10 (STUDENTS) and VLAN 20 (FACULTY) spanning two switches over an 802.1Q trunk link and routed by a Layer 3 Multilayer Switch.',
    learningObjectives: [
      'Observe broadcast isolation between VLAN 10 and VLAN 20',
      'Inspect 802.1Q VLAN tag preservation across trunk interfaces',
      'Understand Inter-VLAN routing using Switched Virtual Interfaces (SVIs)',
    ],
    buildProject: () => {
      const pcStud1 = makeDevice('pc', 1, 120, 160, 'Student-PC1');
      pcStud1.interfaces[0].ipAddress = '192.168.10.11';
      pcStud1.interfaces[0].subnetMask = '255.255.255.0';
      pcStud1.defaultGateway = '192.168.10.1';

      const pcFac1 = makeDevice('pc', 2, 120, 340, 'Faculty-PC1');
      pcFac1.interfaces[0].ipAddress = '192.168.20.11';
      pcFac1.interfaces[0].subnetMask = '255.255.255.0';
      pcFac1.defaultGateway = '192.168.20.1';

      const swAccess = makeDevice('l2-switch', 1, 380, 250, 'SW-Access');
      swAccess.interfaces[0].accessVlan = 10; // Fa0/1 -> Student-PC1
      swAccess.interfaces[1].accessVlan = 20; // Fa0/2 -> Faculty-PC1
      swAccess.interfaces[6].switchportMode = 'trunk'; // Gi0/1 -> MLS-Core

      const mlsCore = makeDevice('l3-switch', 1, 660, 250, 'MLS-Core');
      mlsCore.interfaces[0].switchportMode = 'trunk'; // Gi1/0/1 -> SW-Access
      mlsCore.interfaces[1].switchportMode = 'access'; // Gi1/0/2 -> Student-PC2
      mlsCore.interfaces[1].accessVlan = 10;
      // Configure SVIs Vlan10 and Vlan20
      const svi10 = mlsCore.interfaces.find((i) => i.shortName === 'Vlan10')!;
      svi10.ipAddress = '192.168.10.1';
      svi10.subnetMask = '255.255.255.0';
      const svi20 = mlsCore.interfaces.find((i) => i.shortName === 'Vlan20')!;
      svi20.ipAddress = '192.168.20.1';
      svi20.subnetMask = '255.255.255.0';

      const pcStud2 = makeDevice('pc', 3, 900, 250, 'Student-PC2');
      pcStud2.interfaces[0].ipAddress = '192.168.10.12';
      pcStud2.interfaces[0].subnetMask = '255.255.255.0';
      pcStud2.defaultGateway = '192.168.10.1';

      const links: NetworkLink[] = [
        {
          id: 'vl-1',
          sourceDeviceId: pcStud1.id,
          sourceInterfaceId: pcStud1.interfaces[0].id,
          targetDeviceId: swAccess.id,
          targetInterfaceId: swAccess.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'vl-2',
          sourceDeviceId: pcFac1.id,
          sourceInterfaceId: pcFac1.interfaces[0].id,
          targetDeviceId: swAccess.id,
          targetInterfaceId: swAccess.interfaces[1].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'vl-trunk',
          sourceDeviceId: swAccess.id,
          sourceInterfaceId: swAccess.interfaces[6].id,
          targetDeviceId: mlsCore.id,
          targetInterfaceId: mlsCore.interfaces[0].id,
          type: 'trunk',
          status: 'up',
        },
        {
          id: 'vl-3',
          sourceDeviceId: mlsCore.id,
          sourceInterfaceId: mlsCore.interfaces[1].id,
          targetDeviceId: pcStud2.id,
          targetInterfaceId: pcStud2.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
      ];

      const synced = synchronizeNetworkState([pcStud1, pcFac1, swAccess, mlsCore, pcStud2], links);
      return {
        id: 'proj-vlan-classroom',
        version: '1.0.0',
        name: 'VLAN Classroom & Inter-VLAN Routing',
        description: 'VLAN 10 & VLAN 20 connected via 802.1Q trunk and Layer 3 SVIs.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        devices: synced.devices,
        links: synced.links,
        annotations: [
          { id: 'va1', text: 'VLAN 10 (STUDENTS): 192.168.10.0/24', x: 100, y: 95, color: 'cyan' },
          { id: 'va2', text: 'VLAN 20 (FACULTY): 192.168.20.0/24', x: 100, y: 430, color: 'amber' },
          { id: 'va3', text: '802.1Q Trunk (VLANs 10, 20)', x: 450, y: 180, color: 'emerald' },
        ],
      };
    },
  },
  {
    id: 'tpl-services-dhcp-dns-http',
    name: '4. Campus Services: DHCP, DNS & Web Server',
    category: 'Services',
    difficulty: 'Beginner',
    description:
      'Small office network featuring an enterprise Server running DHCP, DNS (intranet.netlab.edu), and an HTTP Web Server alongside wired and wireless clients.',
    learningObjectives: [
      'Request dynamic IPv4 leases via DHCP ("ipconfig /renew" or Desktop DHCP button)',
      'Resolve domain names to IPv4 addresses using DNS ("nslookup intranet.netlab.edu")',
      'Fetch web pages over HTTP port 80 using the PC Web Browser application',
    ],
    buildProject: () => {
      const pc1 = makeDevice('pc', 1, 140, 160, 'Office-PC1');
      pc1.interfaces[0].ipAddress = '192.168.10.25';
      pc1.interfaces[0].subnetMask = '255.255.255.0';
      pc1.defaultGateway = '192.168.10.1';
      pc1.dnsServer = '192.168.10.10';

      const laptop1 = makeDevice('laptop', 1, 140, 340, 'Visitor-Laptop');
      laptop1.addressingMode = 'dhcp';
      laptop1.interfaces[0].ipAddress = '192.168.10.101';
      laptop1.interfaces[0].subnetMask = '255.255.255.0';
      laptop1.defaultGateway = '192.168.10.1';
      laptop1.dnsServer = '192.168.10.10';

      const sw1 = makeDevice('l2-switch', 1, 430, 250, 'SW-Campus');

      const srv1 = makeDevice('server', 1, 740, 250, 'SRV-Core');
      srv1.interfaces[0].ipAddress = '192.168.10.10';
      srv1.interfaces[0].subnetMask = '255.255.255.0';
      srv1.defaultGateway = '192.168.10.1';
      srv1.dnsServer = '192.168.10.10';

      const links: NetworkLink[] = [
        {
          id: 'sl-1',
          sourceDeviceId: pc1.id,
          sourceInterfaceId: pc1.interfaces[0].id,
          targetDeviceId: sw1.id,
          targetInterfaceId: sw1.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'sl-2',
          sourceDeviceId: laptop1.id,
          sourceInterfaceId: laptop1.interfaces[0].id,
          targetDeviceId: sw1.id,
          targetInterfaceId: sw1.interfaces[1].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'sl-3',
          sourceDeviceId: sw1.id,
          sourceInterfaceId: sw1.interfaces[6].id,
          targetDeviceId: srv1.id,
          targetInterfaceId: srv1.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
      ];

      const synced = synchronizeNetworkState([pc1, laptop1, sw1, srv1], links);
      return {
        id: 'proj-campus-services',
        version: '1.0.0',
        name: 'Campus DHCP, DNS & HTTP Services',
        description: 'Test DHCP leasing, DNS resolution, and HTTP web browsing.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        devices: synced.devices,
        links: synced.links,
        annotations: [
          {
            id: 'sa1',
            text: 'SRV-Core (192.168.10.10): Hosts HTTP, DNS (intranet.netlab.edu) & DHCP Pool',
            x: 490,
            y: 130,
            color: 'emerald',
          },
        ],
      };
    },
  },
  {
    id: 'tpl-broken-troubleshooting',
    name: '5. Deliberately Broken Network (Diagnostic Showcase)',
    category: 'Troubleshooting',
    difficulty: 'Intermediate',
    description:
      'An intentionally misconfigured network containing three classic errors: a shutdown router interface, a wrong Default Gateway on PC1, and a missing return route on R2.',
    learningObjectives: [
      'Use "Check Network" Diagnostics to pinpoint confirmed configuration errors',
      'Fix PC1 Default Gateway from 192.168.1.99 to 192.168.1.1',
      'Enable R1 Gi0/0 with "no shutdown" and add the missing return route on R2',
    ],
    buildProject: () => {
      const pc1 = makeDevice('pc', 1, 110, 260, 'PC1-Branch');
      pc1.interfaces[0].ipAddress = '192.168.1.10';
      pc1.interfaces[0].subnetMask = '255.255.255.0';
      pc1.defaultGateway = '192.168.99.1'; // Deliberate Error 1: Gateway outside subnet!

      const sw1 = makeDevice('l2-switch', 1, 310, 260, 'SW1');

      const r1 = makeDevice('router', 1, 510, 260, 'R1');
      r1.interfaces[0].adminUp = false; // Deliberate Error 2: Gi0/0 is shutdown!
      r1.interfaces[0].ipAddress = '192.168.1.1';
      r1.interfaces[0].subnetMask = '255.255.255.0';
      r1.interfaces[1].adminUp = true; // Gi0/1
      r1.interfaces[1].ipAddress = '10.10.10.1';
      r1.interfaces[1].subnetMask = '255.255.255.252';
      r1.routingTable.push({
        id: 'sr-broken-1',
        type: 'S',
        network: '192.168.2.0',
        mask: '255.255.255.0',
        nextHop: '10.10.10.2',
        interfaceName: 'Gi0/1',
        administrativeDistance: 1,
        metric: 0,
      });

      const r2 = makeDevice('router', 2, 730, 260, 'R2');
      r2.interfaces[0].adminUp = true; // Gi0/0 -> PC2
      r2.interfaces[0].ipAddress = '192.168.2.1';
      r2.interfaces[0].subnetMask = '255.255.255.0';
      r2.interfaces[1].adminUp = true; // Gi0/1 -> R1
      r2.interfaces[1].ipAddress = '10.10.10.2';
      r2.interfaces[1].subnetMask = '255.255.255.252';
      // Deliberate Error 3: R2 is missing static route back to 192.168.1.0/24!

      const pc2 = makeDevice('pc', 2, 930, 260, 'PC2-HQ');
      pc2.interfaces[0].ipAddress = '192.168.2.10';
      pc2.interfaces[0].subnetMask = '255.255.255.0';
      pc2.defaultGateway = '192.168.2.1';

      const links: NetworkLink[] = [
        {
          id: 'bl-1',
          sourceDeviceId: pc1.id,
          sourceInterfaceId: pc1.interfaces[0].id,
          targetDeviceId: sw1.id,
          targetInterfaceId: sw1.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'bl-2',
          sourceDeviceId: sw1.id,
          sourceInterfaceId: sw1.interfaces[6].id,
          targetDeviceId: r1.id,
          targetInterfaceId: r1.interfaces[0].id,
          type: 'ethernet',
          status: 'down',
        },
        {
          id: 'bl-3',
          sourceDeviceId: r1.id,
          sourceInterfaceId: r1.interfaces[1].id,
          targetDeviceId: r2.id,
          targetInterfaceId: r2.interfaces[1].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'bl-4',
          sourceDeviceId: r2.id,
          sourceInterfaceId: r2.interfaces[0].id,
          targetDeviceId: pc2.id,
          targetInterfaceId: pc2.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
      ];

      const synced = synchronizeNetworkState([pc1, sw1, r1, r2, pc2], links);
      return {
        id: 'proj-broken-network',
        version: '1.0.0',
        name: 'Broken Network Troubleshooting Scenario',
        description: 'Contains 3 intentional misconfigurations. Run Check Network to diagnose and repair!',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        devices: synced.devices,
        links: synced.links,
        annotations: [
          {
            id: 'ba1',
            text: 'Broken Scenario: Click "Check Network" in the toolbar to inspect the 3 faults',
            x: 260,
            y: 120,
            color: 'amber',
          },
        ],
      };
    },
  },
  {
    id: 'tpl-star-topology',
    name: 'Star Network Topology',
    category: 'Network Topologies',
    difficulty: 'Beginner',
    description:
      'Standard Star Topology where every station connects via a dedicated point-to-point link to a central Catalyst 2960 switch on 192.168.1.0/24. If one link or node fails, all other stations remain functional.',
    learningObjectives: [
      'Understand centralized star hub/switch architecture and dedicated full-duplex links',
      'Observe how single link/node failures do not disrupt other network stations',
      'Analyze the single point of failure risk of the central core switch',
      'Trace unicast ARP and ICMP Echo traffic radiating through the central switch',
    ],
    buildProject: () => {
      const swCore = makeDevice('l2-switch', 1, 520, 320, 'SW-Central');

      const pc1 = makeDevice('pc', 1, 520, 120, 'PC-Sales');
      pc1.interfaces[0].ipAddress = '192.168.1.10';
      pc1.interfaces[0].subnetMask = '255.255.255.0';
      pc1.defaultGateway = '192.168.1.1';

      const laptop1 = makeDevice('laptop', 1, 750, 200, 'Laptop-Exec');
      laptop1.interfaces[0].ipAddress = '192.168.1.11';
      laptop1.interfaces[0].subnetMask = '255.255.255.0';
      laptop1.defaultGateway = '192.168.1.1';

      const srv1 = makeDevice('server', 1, 750, 440, 'File-Server');
      srv1.interfaces[0].ipAddress = '192.168.1.12';
      srv1.interfaces[0].subnetMask = '255.255.255.0';
      srv1.defaultGateway = '192.168.1.1';

      const printer1 = makeDevice('printer', 1, 520, 520, 'Dept-Printer');
      printer1.interfaces[0].ipAddress = '192.168.1.13';
      printer1.interfaces[0].subnetMask = '255.255.255.0';
      printer1.defaultGateway = '192.168.1.1';

      const pc2 = makeDevice('pc', 2, 290, 440, 'PC-Support');
      pc2.interfaces[0].ipAddress = '192.168.1.14';
      pc2.interfaces[0].subnetMask = '255.255.255.0';
      pc2.defaultGateway = '192.168.1.1';

      const pc3 = makeDevice('pc', 3, 290, 200, 'PC-Finance');
      pc3.interfaces[0].ipAddress = '192.168.1.15';
      pc3.interfaces[0].subnetMask = '255.255.255.0';
      pc3.defaultGateway = '192.168.1.1';

      const links: NetworkLink[] = [
        {
          id: 'star-l1',
          sourceDeviceId: pc1.id,
          sourceInterfaceId: pc1.interfaces[0].id,
          targetDeviceId: swCore.id,
          targetInterfaceId: swCore.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'star-l2',
          sourceDeviceId: laptop1.id,
          sourceInterfaceId: laptop1.interfaces[0].id,
          targetDeviceId: swCore.id,
          targetInterfaceId: swCore.interfaces[1].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'star-l3',
          sourceDeviceId: srv1.id,
          sourceInterfaceId: srv1.interfaces[0].id,
          targetDeviceId: swCore.id,
          targetInterfaceId: swCore.interfaces[2].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'star-l4',
          sourceDeviceId: printer1.id,
          sourceInterfaceId: printer1.interfaces[0].id,
          targetDeviceId: swCore.id,
          targetInterfaceId: swCore.interfaces[3].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'star-l5',
          sourceDeviceId: pc2.id,
          sourceInterfaceId: pc2.interfaces[0].id,
          targetDeviceId: swCore.id,
          targetInterfaceId: swCore.interfaces[4].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'star-l6',
          sourceDeviceId: pc3.id,
          sourceInterfaceId: pc3.interfaces[0].id,
          targetDeviceId: swCore.id,
          targetInterfaceId: swCore.interfaces[5].id,
          type: 'ethernet',
          status: 'up',
        },
      ];

      const synced = synchronizeNetworkState([swCore, pc1, laptop1, srv1, printer1, pc2, pc3], links);
      return {
        id: 'proj-star-topology',
        version: '1.0.0',
        name: 'Star Network Topology',
        description: 'Standard Star Topology with a central Catalyst 2960 switch and 6 radiating departmental nodes.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        devices: synced.devices,
        links: synced.links,
        annotations: [
          {
            id: 'star-ann-1',
            text: 'Star Topology: All devices connect to central SW-Central. High fault isolation.',
            x: 230,
            y: 40,
            color: 'cyan',
          },
          {
            id: 'star-ann-2',
            text: 'Subnet 192.168.1.0/24 — Ping between any two nodes (e.g., PC-Sales to File-Server 192.168.1.12)',
            x: 230,
            y: 600,
            color: 'emerald',
          },
        ],
      };
    },
  },
  {
    id: 'tpl-bus-topology',
    name: 'Bus Network Topology',
    category: 'Network Topologies',
    difficulty: 'Beginner',
    description:
      'Classic linear bus network where multiple stations attach via drop cables along a single shared linear backbone conduit. Features terminating resistors at both ends.',
    learningObjectives: [
      'Examine linear bus architecture and shared transmission medium concepts',
      'Understand CSMA/CD half-duplex collision domains and cable reflection terminators',
      'Observe packet traversal across consecutive taps on the linear trunk bus',
      'Learn the vulnerability where a break anywhere in the backbone brings down communication',
    ],
    buildProject: () => {
      const tap1 = makeDevice('l2-switch', 1, 220, 320, 'Bus-Tap-1');
      const tap2 = makeDevice('l2-switch', 2, 440, 320, 'Bus-Tap-2');
      const tap3 = makeDevice('l2-switch', 3, 660, 320, 'Bus-Tap-3');
      const tap4 = makeDevice('l2-switch', 4, 880, 320, 'Bus-Tap-4');

      const pc1 = makeDevice('pc', 1, 220, 160, 'Station-A');
      pc1.interfaces[0].ipAddress = '10.0.1.11';
      pc1.interfaces[0].subnetMask = '255.255.255.0';

      const pc2 = makeDevice('pc', 2, 440, 480, 'Station-B');
      pc2.interfaces[0].ipAddress = '10.0.1.12';
      pc2.interfaces[0].subnetMask = '255.255.255.0';

      const srv1 = makeDevice('server', 1, 660, 160, 'Bus-Server');
      srv1.interfaces[0].ipAddress = '10.0.1.13';
      srv1.interfaces[0].subnetMask = '255.255.255.0';

      const laptop1 = makeDevice('laptop', 1, 880, 480, 'Station-C');
      laptop1.interfaces[0].ipAddress = '10.0.1.14';
      laptop1.interfaces[0].subnetMask = '255.255.255.0';

      const links: NetworkLink[] = [
        {
          id: 'bus-trunk-1',
          sourceDeviceId: tap1.id,
          sourceInterfaceId: tap1.interfaces[1].id,
          targetDeviceId: tap2.id,
          targetInterfaceId: tap2.interfaces[1].id,
          type: 'trunk',
          status: 'up',
        },
        {
          id: 'bus-trunk-2',
          sourceDeviceId: tap2.id,
          sourceInterfaceId: tap2.interfaces[2].id,
          targetDeviceId: tap3.id,
          targetInterfaceId: tap3.interfaces[1].id,
          type: 'trunk',
          status: 'up',
        },
        {
          id: 'bus-trunk-3',
          sourceDeviceId: tap3.id,
          sourceInterfaceId: tap3.interfaces[2].id,
          targetDeviceId: tap4.id,
          targetInterfaceId: tap4.interfaces[1].id,
          type: 'trunk',
          status: 'up',
        },
        {
          id: 'bus-drop-1',
          sourceDeviceId: pc1.id,
          sourceInterfaceId: pc1.interfaces[0].id,
          targetDeviceId: tap1.id,
          targetInterfaceId: tap1.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'bus-drop-2',
          sourceDeviceId: pc2.id,
          sourceInterfaceId: pc2.interfaces[0].id,
          targetDeviceId: tap2.id,
          targetInterfaceId: tap2.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'bus-drop-3',
          sourceDeviceId: srv1.id,
          sourceInterfaceId: srv1.interfaces[0].id,
          targetDeviceId: tap3.id,
          targetInterfaceId: tap3.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'bus-drop-4',
          sourceDeviceId: laptop1.id,
          sourceInterfaceId: laptop1.interfaces[0].id,
          targetDeviceId: tap4.id,
          targetInterfaceId: tap4.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
      ];

      const synced = synchronizeNetworkState([tap1, tap2, tap3, tap4, pc1, pc2, srv1, laptop1], links);
      return {
        id: 'proj-bus-topology',
        version: '1.0.0',
        name: 'Bus Network Topology',
        description: 'Linear bus topology with a central multi-tap transmission conduit, drop cables, and 50Ω terminators.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        devices: synced.devices,
        links: synced.links,
        annotations: [
          {
            id: 'bus-ann-1',
            text: 'Bus Topology: Linear shared backbone conduit (10.0.1.0/24). Single broadcast medium.',
            x: 240,
            y: 80,
            color: 'cyan',
          },
          {
            id: 'bus-ann-left-term',
            text: '◄ [50Ω Terminator]',
            x: 80,
            y: 320,
            color: 'amber',
          },
          {
            id: 'bus-ann-right-term',
            text: '[50Ω Terminator] ►',
            x: 940,
            y: 320,
            color: 'amber',
          },
        ],
      };
    },
  },
  {
    id: 'tpl-ring-topology',
    name: 'Ring Network Topology',
    category: 'Network Topologies',
    difficulty: 'Intermediate',
    description:
      'Circular ring topology where every intermediate node connects to exactly two neighbors, creating a continuous closed transmission loop with host stations.',
    learningObjectives: [
      'Analyze circular ring packet circulation and sequential frame forwarding',
      'Understand deterministic token-passing vs contention-based media access',
      'Observe loop topology design and Spanning Tree Protocol (STP) convergence',
      'Evaluate dual-ring counter-rotating redundancy for self-healing resiliency',
    ],
    buildProject: () => {
      const swA = makeDevice('l2-switch', 1, 520, 160, 'Ring-SW-A');
      const swB = makeDevice('l2-switch', 2, 780, 290, 'Ring-SW-B');
      const swC = makeDevice('l2-switch', 3, 680, 500, 'Ring-SW-C');
      const swD = makeDevice('l2-switch', 4, 360, 500, 'Ring-SW-D');
      const swE = makeDevice('l2-switch', 5, 260, 290, 'Ring-SW-E');

      const hostA = makeDevice('pc', 1, 520, 60, 'Host-A');
      hostA.interfaces[0].ipAddress = '172.16.1.10';
      hostA.interfaces[0].subnetMask = '255.255.255.0';

      const hostB = makeDevice('laptop', 1, 930, 290, 'Host-B');
      hostB.interfaces[0].ipAddress = '172.16.1.20';
      hostB.interfaces[0].subnetMask = '255.255.255.0';

      const hostC = makeDevice('server', 1, 740, 600, 'Ring-Server');
      hostC.interfaces[0].ipAddress = '172.16.1.30';
      hostC.interfaces[0].subnetMask = '255.255.255.0';

      const hostD = makeDevice('pc', 2, 280, 600, 'Host-D');
      hostD.interfaces[0].ipAddress = '172.16.1.40';
      hostD.interfaces[0].subnetMask = '255.255.255.0';

      const links: NetworkLink[] = [
        {
          id: 'ring-l-ab',
          sourceDeviceId: swA.id,
          sourceInterfaceId: swA.interfaces[1].id,
          targetDeviceId: swB.id,
          targetInterfaceId: swB.interfaces[2].id,
          type: 'trunk',
          status: 'up',
        },
        {
          id: 'ring-l-bc',
          sourceDeviceId: swB.id,
          sourceInterfaceId: swB.interfaces[1].id,
          targetDeviceId: swC.id,
          targetInterfaceId: swC.interfaces[2].id,
          type: 'trunk',
          status: 'up',
        },
        {
          id: 'ring-l-cd',
          sourceDeviceId: swC.id,
          sourceInterfaceId: swC.interfaces[1].id,
          targetDeviceId: swD.id,
          targetInterfaceId: swD.interfaces[2].id,
          type: 'trunk',
          status: 'up',
        },
        {
          id: 'ring-l-de',
          sourceDeviceId: swD.id,
          sourceInterfaceId: swD.interfaces[1].id,
          targetDeviceId: swE.id,
          targetInterfaceId: swE.interfaces[2].id,
          type: 'trunk',
          status: 'up',
        },
        {
          id: 'ring-l-ea',
          sourceDeviceId: swE.id,
          sourceInterfaceId: swE.interfaces[1].id,
          targetDeviceId: swA.id,
          targetInterfaceId: swA.interfaces[2].id,
          type: 'trunk',
          status: 'up',
        },
        {
          id: 'ring-h-a',
          sourceDeviceId: hostA.id,
          sourceInterfaceId: hostA.interfaces[0].id,
          targetDeviceId: swA.id,
          targetInterfaceId: swA.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'ring-h-b',
          sourceDeviceId: hostB.id,
          sourceInterfaceId: hostB.interfaces[0].id,
          targetDeviceId: swB.id,
          targetInterfaceId: swB.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'ring-h-c',
          sourceDeviceId: hostC.id,
          sourceInterfaceId: hostC.interfaces[0].id,
          targetDeviceId: swC.id,
          targetInterfaceId: swC.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'ring-h-d',
          sourceDeviceId: hostD.id,
          sourceInterfaceId: hostD.interfaces[0].id,
          targetDeviceId: swD.id,
          targetInterfaceId: swD.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
      ];

      const synced = synchronizeNetworkState([swA, swB, swC, swD, swE, hostA, hostB, hostC, hostD], links);
      return {
        id: 'proj-ring-topology',
        version: '1.0.0',
        name: 'Ring Network Topology',
        description: 'Circular 5-node closed loop ring with host attachments on 172.16.1.0/24.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        devices: synced.devices,
        links: synced.links,
        annotations: [
          {
            id: 'ring-ann-1',
            text: 'Ring Topology: Circular loop (SW-A → SW-B → SW-C → SW-D → SW-E → SW-A).',
            x: 230,
            y: 20,
            color: 'cyan',
          },
          {
            id: 'ring-ann-2',
            text: 'Subnet 172.16.1.0/24 — Sequential point-to-point ring links with redundant fallback paths.',
            x: 230,
            y: 670,
            color: 'emerald',
          },
        ],
      };
    },
  },
  {
    id: 'tpl-mesh-topology',
    name: 'Mesh Network Topology',
    category: 'Network Topologies',
    difficulty: 'Advanced',
    description:
      'Fully interconnected core mesh where all 4 core routers have direct point-to-point links with every other node ($N(N-1)/2 = 6$ mesh links), achieving zero single-point-of-failure.',
    learningObjectives: [
      'Master Full Mesh topology formula: Links = N(N - 1) / 2',
      'Understand redundant multi-path routing, alternate path failover, and high availability',
      'Analyze the trade-offs of cabling complexity vs unparalleled survivability',
      'Inspect dynamic point-to-point /30 subnet transit connections',
    ],
    buildProject: () => {
      const rA = makeDevice('router', 1, 360, 220, 'Mesh-Core-A');
      const rB = makeDevice('router', 2, 680, 220, 'Mesh-Core-B');
      const rC = makeDevice('router', 3, 680, 480, 'Mesh-Core-C');
      const rD = makeDevice('router', 4, 360, 480, 'Mesh-Core-D');

      rA.interfaces[0].adminUp = true;
      rA.interfaces[0].ipAddress = '10.1.12.1';
      rA.interfaces[0].subnetMask = '255.255.255.252';
      rA.interfaces[1].adminUp = true;
      rA.interfaces[1].ipAddress = '10.1.14.1';
      rA.interfaces[1].subnetMask = '255.255.255.252';
      rA.interfaces[2].adminUp = true;
      rA.interfaces[2].ipAddress = '10.1.10.1';
      rA.interfaces[2].subnetMask = '255.255.255.0';
      rA.interfaces[3].adminUp = true;
      rA.interfaces[3].ipAddress = '10.1.13.1';
      rA.interfaces[3].subnetMask = '255.255.255.252';

      rB.interfaces[0].adminUp = true;
      rB.interfaces[0].ipAddress = '10.1.12.2';
      rB.interfaces[0].subnetMask = '255.255.255.252';
      rB.interfaces[1].adminUp = true;
      rB.interfaces[1].ipAddress = '10.1.23.1';
      rB.interfaces[1].subnetMask = '255.255.255.252';
      rB.interfaces[2].adminUp = true;
      rB.interfaces[2].ipAddress = '10.1.20.1';
      rB.interfaces[2].subnetMask = '255.255.255.0';
      rB.interfaces[3].adminUp = true;
      rB.interfaces[3].ipAddress = '10.1.24.1';
      rB.interfaces[3].subnetMask = '255.255.255.252';

      rC.interfaces[0].adminUp = true;
      rC.interfaces[0].ipAddress = '10.1.23.2';
      rC.interfaces[0].subnetMask = '255.255.255.252';
      rC.interfaces[1].adminUp = true;
      rC.interfaces[1].ipAddress = '10.1.34.1';
      rC.interfaces[1].subnetMask = '255.255.255.252';
      rC.interfaces[3].adminUp = true;
      rC.interfaces[3].ipAddress = '10.1.13.2';
      rC.interfaces[3].subnetMask = '255.255.255.252';

      rD.interfaces[0].adminUp = true;
      rD.interfaces[0].ipAddress = '10.1.34.2';
      rD.interfaces[0].subnetMask = '255.255.255.252';
      rD.interfaces[1].adminUp = true;
      rD.interfaces[1].ipAddress = '10.1.14.2';
      rD.interfaces[1].subnetMask = '255.255.255.252';
      rD.interfaces[3].adminUp = true;
      rD.interfaces[3].ipAddress = '10.1.24.2';
      rD.interfaces[3].subnetMask = '255.255.255.252';

      const sw1 = makeDevice('l2-switch', 1, 160, 350, 'SW-Access-W');
      const pc1 = makeDevice('pc', 1, 60, 350, 'Branch-PC');
      pc1.interfaces[0].ipAddress = '10.1.10.10';
      pc1.interfaces[0].subnetMask = '255.255.255.0';
      pc1.defaultGateway = '10.1.10.1';

      const sw2 = makeDevice('l2-switch', 2, 880, 350, 'SW-Access-E');
      const srv1 = makeDevice('server', 1, 980, 350, 'HQ-DC-Server');
      srv1.interfaces[0].ipAddress = '10.1.20.10';
      srv1.interfaces[0].subnetMask = '255.255.255.0';
      srv1.defaultGateway = '10.1.20.1';

      const links: NetworkLink[] = [
        {
          id: 'mesh-l-ab',
          sourceDeviceId: rA.id,
          sourceInterfaceId: rA.interfaces[0].id,
          targetDeviceId: rB.id,
          targetInterfaceId: rB.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'mesh-l-bc',
          sourceDeviceId: rB.id,
          sourceInterfaceId: rB.interfaces[1].id,
          targetDeviceId: rC.id,
          targetInterfaceId: rC.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'mesh-l-cd',
          sourceDeviceId: rC.id,
          sourceInterfaceId: rC.interfaces[1].id,
          targetDeviceId: rD.id,
          targetInterfaceId: rD.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'mesh-l-da',
          sourceDeviceId: rD.id,
          sourceInterfaceId: rD.interfaces[1].id,
          targetDeviceId: rA.id,
          targetInterfaceId: rA.interfaces[1].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'mesh-l-ac-diag',
          sourceDeviceId: rA.id,
          sourceInterfaceId: rA.interfaces[3].id,
          targetDeviceId: rC.id,
          targetInterfaceId: rC.interfaces[3].id,
          type: 'serial',
          status: 'up',
        },
        {
          id: 'mesh-l-bd-diag',
          sourceDeviceId: rB.id,
          sourceInterfaceId: rB.interfaces[3].id,
          targetDeviceId: rD.id,
          targetInterfaceId: rD.interfaces[3].id,
          type: 'serial',
          status: 'up',
        },
        {
          id: 'mesh-edge-1',
          sourceDeviceId: pc1.id,
          sourceInterfaceId: pc1.interfaces[0].id,
          targetDeviceId: sw1.id,
          targetInterfaceId: sw1.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'mesh-edge-2',
          sourceDeviceId: sw1.id,
          sourceInterfaceId: sw1.interfaces[1].id,
          targetDeviceId: rA.id,
          targetInterfaceId: rA.interfaces[2].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'mesh-edge-3',
          sourceDeviceId: srv1.id,
          sourceInterfaceId: srv1.interfaces[0].id,
          targetDeviceId: sw2.id,
          targetInterfaceId: sw2.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'mesh-edge-4',
          sourceDeviceId: sw2.id,
          sourceInterfaceId: sw2.interfaces[1].id,
          targetDeviceId: rB.id,
          targetInterfaceId: rB.interfaces[2].id,
          type: 'ethernet',
          status: 'up',
        },
      ];

      const synced = synchronizeNetworkState([rA, rB, rC, rD, sw1, sw2, pc1, srv1], links);
      return {
        id: 'proj-mesh-topology',
        version: '1.0.0',
        name: 'Full Mesh Network Topology',
        description: 'High-availability Full Mesh core with 6 cross-connected links and multi-path resilience.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        devices: synced.devices,
        links: synced.links,
        annotations: [
          {
            id: 'mesh-ann-1',
            text: 'Full Mesh Core: N(N-1)/2 = 6 redundant links between Routers A, B, C, and D.',
            x: 230,
            y: 80,
            color: 'cyan',
          },
          {
            id: 'mesh-ann-2',
            text: 'Zero single point of failure — if any line or router fails, traffic dynamically reroutes through alternate diagonals.',
            x: 160,
            y: 580,
            color: 'emerald',
          },
        ],
      };
    },
  },
  {
    id: 'tpl-hybrid-topology',
    name: 'Hybrid Network Topology (Star-Bus Enterprise Campus)',
    category: 'Network Topologies',
    difficulty: 'Intermediate',
    description:
      'Combines two distinct topology patterns: multiple departmental Star LAN clusters interconnected across a high-speed backbone bus and redundant core switch.',
    learningObjectives: [
      'Learn how enterprise networks integrate different topology types for cost and performance',
      'Observe Star clusters attached to a shared backbone trunk',
      'Trace inter-departmental packet flow crossing from Star Cluster A to Star Cluster B',
      'Understand hierarchical campus network design (Access, Distribution, Core)',
    ],
    buildProject: () => {
      const coreSw = makeDevice('l3-switch', 1, 520, 260, 'Core-Backbone-SW');

      const salesSw = makeDevice('l2-switch', 1, 240, 260, 'Sales-Star-SW');
      const pcSales1 = makeDevice('pc', 1, 100, 150, 'Sales-PC-1');
      pcSales1.interfaces[0].ipAddress = '192.168.10.11';
      pcSales1.interfaces[0].subnetMask = '255.255.255.0';
      pcSales1.defaultGateway = '192.168.10.1';

      const pcSales2 = makeDevice('pc', 2, 100, 370, 'Sales-PC-2');
      pcSales2.interfaces[0].ipAddress = '192.168.10.12';
      pcSales2.interfaces[0].subnetMask = '255.255.255.0';
      pcSales2.defaultGateway = '192.168.10.1';

      const printSales = makeDevice('printer', 1, 240, 420, 'Sales-Printer');
      printSales.interfaces[0].ipAddress = '192.168.10.20';
      printSales.interfaces[0].subnetMask = '255.255.255.0';
      printSales.defaultGateway = '192.168.10.1';

      const engSw = makeDevice('l2-switch', 2, 800, 260, 'Eng-Star-SW');
      const pcDev1 = makeDevice('pc', 3, 940, 150, 'Dev-PC-1');
      pcDev1.interfaces[0].ipAddress = '192.168.20.11';
      pcDev1.interfaces[0].subnetMask = '255.255.255.0';
      pcDev1.defaultGateway = '192.168.20.1';

      const pcDev2 = makeDevice('laptop', 1, 940, 370, 'Dev-Laptop-2');
      pcDev2.interfaces[0].ipAddress = '192.168.20.12';
      pcDev2.interfaces[0].subnetMask = '255.255.255.0';
      pcDev2.defaultGateway = '192.168.20.1';

      const srvEng = makeDevice('server', 1, 800, 420, 'Git-Server');
      srvEng.interfaces[0].ipAddress = '192.168.20.50';
      srvEng.interfaces[0].subnetMask = '255.255.255.0';
      srvEng.defaultGateway = '192.168.20.1';

      const dcSrv = makeDevice('server', 2, 520, 480, 'Enterprise-Cloud-DC');
      dcSrv.interfaces[0].ipAddress = '192.168.1.100';
      dcSrv.interfaces[0].subnetMask = '255.255.255.0';
      dcSrv.defaultGateway = '192.168.1.1';

      const links: NetworkLink[] = [
        {
          id: 'hyb-s1',
          sourceDeviceId: pcSales1.id,
          sourceInterfaceId: pcSales1.interfaces[0].id,
          targetDeviceId: salesSw.id,
          targetInterfaceId: salesSw.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'hyb-s2',
          sourceDeviceId: pcSales2.id,
          sourceInterfaceId: pcSales2.interfaces[0].id,
          targetDeviceId: salesSw.id,
          targetInterfaceId: salesSw.interfaces[1].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'hyb-s3',
          sourceDeviceId: printSales.id,
          sourceInterfaceId: printSales.interfaces[0].id,
          targetDeviceId: salesSw.id,
          targetInterfaceId: salesSw.interfaces[2].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'hyb-e1',
          sourceDeviceId: pcDev1.id,
          sourceInterfaceId: pcDev1.interfaces[0].id,
          targetDeviceId: engSw.id,
          targetInterfaceId: engSw.interfaces[0].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'hyb-e2',
          sourceDeviceId: pcDev2.id,
          sourceInterfaceId: pcDev2.interfaces[0].id,
          targetDeviceId: engSw.id,
          targetInterfaceId: engSw.interfaces[1].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'hyb-e3',
          sourceDeviceId: srvEng.id,
          sourceInterfaceId: srvEng.interfaces[0].id,
          targetDeviceId: engSw.id,
          targetInterfaceId: engSw.interfaces[2].id,
          type: 'ethernet',
          status: 'up',
        },
        {
          id: 'hyb-trunk-w',
          sourceDeviceId: salesSw.id,
          sourceInterfaceId: salesSw.interfaces[6].id,
          targetDeviceId: coreSw.id,
          targetInterfaceId: coreSw.interfaces[0].id,
          type: 'trunk',
          status: 'up',
        },
        {
          id: 'hyb-trunk-e',
          sourceDeviceId: engSw.id,
          sourceInterfaceId: engSw.interfaces[6].id,
          targetDeviceId: coreSw.id,
          targetInterfaceId: coreSw.interfaces[1].id,
          type: 'trunk',
          status: 'up',
        },
        {
          id: 'hyb-srv-trunk',
          sourceDeviceId: dcSrv.id,
          sourceInterfaceId: dcSrv.interfaces[0].id,
          targetDeviceId: coreSw.id,
          targetInterfaceId: coreSw.interfaces[2].id,
          type: 'ethernet',
          status: 'up',
        },
      ];

      const synced = synchronizeNetworkState(
        [coreSw, salesSw, engSw, pcSales1, pcSales2, printSales, pcDev1, pcDev2, srvEng, dcSrv],
        links
      );

      return {
        id: 'proj-hybrid-topology',
        version: '1.0.0',
        name: 'Hybrid Star-Bus Network Topology',
        description: 'Hierarchical campus topology combining Sales & Engineering Star clusters over a Gigabit Backbone.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        devices: synced.devices,
        links: synced.links,
        annotations: [
          {
            id: 'hyb-ann-1',
            text: 'Hybrid Topology: Combines two departmental Star clusters (Sales & Eng) interconnected via Core Backbone.',
            x: 180,
            y: 40,
            color: 'cyan',
          },
          {
            id: 'hyb-ann-2',
            text: 'Scalable campus architecture: isolates departmental collision domains while providing centralized service access.',
            x: 180,
            y: 580,
            color: 'emerald',
          },
        ],
      };
    },
  },
];

