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
  category: 'Starter LAN' | 'Routing' | 'VLANs & Switching' | 'Services' | 'Enterprise' | 'Troubleshooting';
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
];
