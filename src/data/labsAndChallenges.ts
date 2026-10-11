import { NetworkProject } from '../types/network';
import { NETWORK_TEMPLATES } from './templates';
import { runPacketSimulation, synchronizeNetworkState } from '../engine/simulationEngine';
import { isValidIpv4 } from '../utils/networkMath';

export interface GuidedLabObjective {
  id: string;
  description: string;
  check: (project: NetworkProject) => { passed: boolean; feedback: string };
}

export interface GuidedLab {
  id: string;
  title: string;
  category: 'Switching & LANs' | 'IPv4 & Gateways' | 'Static Routing' | 'VLANs & Trunks' | 'Services & Security';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedMinutes: number;
  prerequisites: string[];
  summary: string;
  scenario: string;
  instructions: string[];
  hints: string[];
  solutionExplanation: string;
  createInitialProject: () => NetworkProject;
  objectives: GuidedLabObjective[];
}

export const GUIDED_LABS: GuidedLab[] = [
  {
    id: 'lab-1-first-lan',
    title: 'Lab 1: Building & Addressing a Two-PC Switched LAN',
    category: 'Switching & LANs',
    difficulty: 'Beginner',
    estimatedMinutes: 10,
    prerequisites: ['Networking Fundamentals', 'IPv4 Addressing'],
    summary:
      'Configure IPv4 addresses on two workstations connected to a Catalyst 2960 switch and verify Layer 2 reachability with ICMP Ping.',
    scenario:
      'You have been assigned to set up a small workbench network in Lab Room 101. PC1 and PC2 are physically cabled to Switch SW1, but PC2 has not been assigned an IPv4 address yet.',
    instructions: [
      'Select PC1 on the canvas and verify its IPv4 address is set to 192.168.1.10 with mask 255.255.255.0.',
      'Select PC2 and assign it IPv4 address 192.168.1.20 with subnet mask 255.255.255.0.',
      'Ensure both PC1 and PC2 have their Ethernet0 interfaces enabled (Up) and connected to SW1.',
      'Run a Ping from PC1 to 192.168.1.20 using either the Ping tool or PC1 Command Prompt ("ping 192.168.1.20").',
    ],
    hints: [
      'Click PC2 on the canvas to open the Device Inspector on the right.',
      'Under Interfaces -> Eth0, enter 192.168.1.20 and 255.255.255.0.',
      'Use the "Send Ping" button in the top simulator bar or open the CLI tab and type: ping 192.168.1.20',
    ],
    solutionExplanation:
      'Hosts on the same Layer 2 broadcast domain must share the same IPv4 network prefix (192.168.1.0/24) and have unique host identifiers (.10 and .20). When PC1 pings PC2, it broadcasts an ARP Request to learn PC2’s MAC address, and SW1 records both MAC addresses in its CAM table.',
    createInitialProject: () => {
      const base = NETWORK_TEMPLATES[0].buildProject();
      base.id = 'lab-proj-1';
      base.name = 'Lab 1: Two-PC Switched LAN';
      base.labId = 'lab-1-first-lan';
      // Clear PC2 IP so the student configures it
      const pc2 = base.devices.find((d) => d.name === 'PC2');
      if (pc2) {
        pc2.interfaces[0].ipAddress = '';
      }
      const synced = synchronizeNetworkState(base.devices, base.links);
      base.devices = synced.devices;
      base.links = synced.links;
      return base;
    },
    objectives: [
      {
        id: 'obj-1-pc1',
        description: 'PC1 Eth0 is configured with 192.168.1.10 / 255.255.255.0',
        check: (proj) => {
          const pc1 = proj.devices.find((d) => d.name === 'PC1');
          const intf = pc1?.interfaces[0];
          const ok = intf?.ipAddress === '192.168.1.10' && intf?.subnetMask === '255.255.255.0' && intf.adminUp;
          return {
            passed: !!ok,
            feedback: ok ? 'PC1 IP configuration verified.' : 'Set PC1 Eth0 to 192.168.1.10 / 255.255.255.0.',
          };
        },
      },
      {
        id: 'obj-1-pc2',
        description: 'PC2 Eth0 is configured with 192.168.1.20 / 255.255.255.0',
        check: (proj) => {
          const pc2 = proj.devices.find((d) => d.name === 'PC2');
          const intf = pc2?.interfaces[0];
          const ok = intf?.ipAddress === '192.168.1.20' && intf?.subnetMask === '255.255.255.0' && intf.adminUp;
          return {
            passed: !!ok,
            feedback: ok ? 'PC2 IP configuration verified.' : 'Assign 192.168.1.20 / 255.255.255.0 to PC2 Eth0.',
          };
        },
      },
      {
        id: 'obj-1-ping',
        description: 'End-to-end ICMP Ping succeeds between PC1 and PC2',
        check: (proj) => {
          const pc1 = proj.devices.find((d) => d.name === 'PC1');
          if (!pc1) return { passed: false, feedback: 'PC1 is missing from topology.' };
          const res = runPacketSimulation(pc1.id, '192.168.1.20', 'ICMP', proj.devices, proj.links);
          return {
            passed: res.session.overallSuccess,
            feedback: res.session.overallSuccess
              ? 'Ping succeeded between PC1 and PC2.'
              : res.session.summaryMessage,
          };
        },
      },
    ],
  },
  {
    id: 'lab-2-router-gateway',
    title: 'Lab 2: Configuring a Cisco Router Interface & Default Gateway',
    category: 'IPv4 & Gateways',
    difficulty: 'Beginner',
    estimatedMinutes: 15,
    prerequisites: ['Lab 1: Building & Addressing a Two-PC Switched LAN'],
    summary:
      'Bring up a Cisco router LAN interface using the IOS CLI ("ip address" and "no shutdown") and configure the PC Default Gateway.',
    scenario:
      'Branch Router R1 is connected to Switch SW1, but its GigabitEthernet0/0 interface is administratively shutdown and lacks an IP address. Additionally, PC1 is missing its Default Gateway.',
    instructions: [
      'Select Router R1 and open the CLI terminal (or Device Inspector).',
      'Configure R1 interface GigabitEthernet0/0 with IP address 192.168.10.1 and subnet mask 255.255.255.0.',
      'Enable GigabitEthernet0/0 using the "no shutdown" command.',
      'Select PC-West (192.168.10.10) and set its Default Gateway to 192.168.10.1.',
      'Verify that PC-West can ping its Default Gateway (192.168.10.1) and remote host PC-East (192.168.20.10).',
    ],
    hints: [
      'In R1 CLI, run: enable -> configure terminal -> interface Gi0/0 -> ip address 192.168.10.1 255.255.255.0 -> no shutdown',
      'Select PC-West and enter 192.168.10.1 in the Default Gateway field.',
    ],
    solutionExplanation:
      'Cisco router interfaces are administratively shutdown by default to prevent accidental routing before configuration is complete. Once Gi0/0 is given 192.168.10.1/24 and enabled via "no shutdown", PC-West uses 192.168.10.1 as its Layer 3 exit point to reach remote networks.',
    createInitialProject: () => {
      const base = NETWORK_TEMPLATES[1].buildProject();
      base.id = 'lab-proj-2';
      base.name = 'Lab 2: Router Interface & Default Gateway';
      base.labId = 'lab-2-router-gateway';
      const r1 = base.devices.find((d) => d.name === 'R1-West');
      if (r1) {
        r1.interfaces[0].ipAddress = '';
        r1.interfaces[0].subnetMask = '';
        r1.interfaces[0].adminUp = false;
      }
      const pc1 = base.devices.find((d) => d.name === 'PC-West');
      if (pc1) {
        pc1.defaultGateway = '';
      }
      const synced = synchronizeNetworkState(base.devices, base.links);
      base.devices = synced.devices;
      base.links = synced.links;
      return base;
    },
    objectives: [
      {
        id: 'obj-2-r1-ip',
        description: 'R1-West Gi0/0 has IP 192.168.10.1/24 and is enabled (no shutdown)',
        check: (proj) => {
          const r1 = proj.devices.find((d) => d.name === 'R1-West');
          const gi0 = r1?.interfaces[0];
          const ok = gi0?.ipAddress === '192.168.10.1' && gi0?.subnetMask === '255.255.255.0' && gi0.adminUp;
          return {
            passed: !!ok,
            feedback: ok
              ? 'R1-West Gi0/0 is up with 192.168.10.1/24.'
              : 'Configure R1-West Gi0/0 with 192.168.10.1 255.255.255.0 and enable it.',
          };
        },
      },
      {
        id: 'obj-2-pc-gw',
        description: 'PC-West Default Gateway is set to 192.168.10.1',
        check: (proj) => {
          const pc1 = proj.devices.find((d) => d.name === 'PC-West');
          const ok = pc1?.defaultGateway === '192.168.10.1';
          return {
            passed: !!ok,
            feedback: ok ? 'PC-West Default Gateway verified.' : 'Set PC-West Default Gateway to 192.168.10.1.',
          };
        },
      },
      {
        id: 'obj-2-reach',
        description: 'PC-West (192.168.10.10) can ping PC-East (192.168.20.10)',
        check: (proj) => {
          const pc1 = proj.devices.find((d) => d.name === 'PC-West');
          if (!pc1) return { passed: false, feedback: 'PC-West not found.' };
          const res = runPacketSimulation(pc1.id, '192.168.20.10', 'ICMP', proj.devices, proj.links);
          return {
            passed: res.session.overallSuccess,
            feedback: res.session.overallSuccess ? 'Inter-LAN ping succeeded!' : res.session.summaryMessage,
          };
        },
      },
    ],
  },
  {
    id: 'lab-3-static-routing',
    title: 'Lab 3: Implementing Bidirectional Static Routing',
    category: 'Static Routing',
    difficulty: 'Intermediate',
    estimatedMinutes: 20,
    prerequisites: ['Lab 2: Configuring a Cisco Router Interface & Default Gateway'],
    summary:
      'Configure static routes on two interconnected routers so traffic can travel both forward and backward between remote LAN subnets.',
    scenario:
      'Routers R1-West and R2-East have all interfaces online, but neither router knows how to reach the remote LAN behind its neighbor. Remember that ICMP Ping requires both a forward path and a return path!',
    instructions: [
      'On R1-West, add a static route to 192.168.20.0 255.255.255.0 via next-hop 10.0.0.2.',
      'On R2-East, add a static route to 192.168.10.0 255.255.255.0 via next-hop 10.0.0.1.',
      'Inspect both routing tables using "show ip route".',
      'Test connectivity from PC-West (192.168.10.10) to PC-East (192.168.20.10).',
    ],
    hints: [
      'On R1-West CLI: enable -> configure terminal -> ip route 192.168.20.0 255.255.255.0 10.0.0.2',
      'On R2-East CLI: enable -> configure terminal -> ip route 192.168.10.0 255.255.255.0 10.0.0.1',
    ],
    solutionExplanation:
      'Routers only learn directly connected networks automatically. To reach a non-connected subnet without dynamic routing protocols, every router along the path must have a route for the destination subnet, and remote routers must have a return route for the source subnet.',
    createInitialProject: () => {
      const base = NETWORK_TEMPLATES[1].buildProject();
      base.id = 'lab-proj-3';
      base.name = 'Lab 3: Bidirectional Static Routing';
      base.labId = 'lab-3-static-routing';
      for (const dev of base.devices) {
        dev.routingTable = dev.routingTable.filter((r) => r.type !== 'S' && r.type !== 'S*');
      }
      const synced = synchronizeNetworkState(base.devices, base.links);
      base.devices = synced.devices;
      base.links = synced.links;
      return base;
    },
    objectives: [
      {
        id: 'obj-3-r1',
        description: 'R1-West has a static route to 192.168.20.0/24 via 10.0.0.2',
        check: (proj) => {
          const r1 = proj.devices.find((d) => d.name === 'R1-West');
          const has = r1?.routingTable.some(
            (r) => r.type === 'S' && r.network === '192.168.20.0' && r.nextHop === '10.0.0.2'
          );
          return {
            passed: !!has,
            feedback: has ? 'R1-West static route present.' : 'Missing static route on R1-West to 192.168.20.0/24.',
          };
        },
      },
      {
        id: 'obj-3-r2',
        description: 'R2-East has a static route to 192.168.10.0/24 via 10.0.0.1',
        check: (proj) => {
          const r2 = proj.devices.find((d) => d.name === 'R2-East');
          const has = r2?.routingTable.some(
            (r) => r.type === 'S' && r.network === '192.168.10.0' && r.nextHop === '10.0.0.1'
          );
          return {
            passed: !!has,
            feedback: has ? 'R2-East return route present.' : 'Missing static route on R2-East to 192.168.10.0/24.',
          };
        },
      },
      {
        id: 'obj-3-ping',
        description: 'PC-West successfully pings PC-East (192.168.20.10)',
        check: (proj) => {
          const pc1 = proj.devices.find((d) => d.name === 'PC-West');
          if (!pc1) return { passed: false, feedback: 'PC-West missing.' };
          const res = runPacketSimulation(pc1.id, '192.168.20.10', 'ICMP', proj.devices, proj.links);
          return {
            passed: res.session.overallSuccess,
            feedback: res.session.overallSuccess ? 'End-to-end routed ping verified!' : res.session.summaryMessage,
          };
        },
      },
    ],
  },
  {
    id: 'lab-4-vlans-trunking',
    title: 'Lab 4: Configuring VLANs & 802.1Q Trunk Ports',
    category: 'VLANs & Trunks',
    difficulty: 'Intermediate',
    estimatedMinutes: 20,
    prerequisites: ['Ethernet and Switching', 'VLANs and Trunking'],
    summary:
      'Assign switch access ports to VLAN 10 and configure an 802.1Q Trunk uplink between SW-Access and MLS-Core.',
    scenario:
      'Student-PC1 (on SW-Access Fa0/1) and Student-PC2 (on MLS-Core Gi1/0/2) both belong to the 192.168.10.0/24 subnet (VLAN 10). However, SW-Access Fa0/1 is still in default VLAN 1, and the uplink Gi0/1 on SW-Access is set to access mode instead of trunk mode.',
    instructions: [
      'Select SW-Access and assign interface FastEthernet0/1 to Access VLAN 10.',
      'Configure SW-Access uplink interface GigabitEthernet0/1 as an 802.1Q Trunk port ("switchport mode trunk").',
      'Verify that Student-PC1 (192.168.10.11) can ping Student-PC2 (192.168.10.12) across the trunk.',
    ],
    hints: [
      'In SW-Access CLI: interface Fa0/1 -> switchport mode access -> switchport access vlan 10',
      'Then: interface Gi0/1 -> switchport mode trunk',
    ],
    solutionExplanation:
      'Access ports tag untagged frames from PCs with a single VLAN ID (VLAN 10). To carry multiple VLANs between switches over one physical cable, both ends of the inter-switch link must operate in 802.1Q Trunk mode.',
    createInitialProject: () => {
      const base = NETWORK_TEMPLATES[2].buildProject();
      base.id = 'lab-proj-4';
      base.name = 'Lab 4: VLANs & 802.1Q Trunking';
      base.labId = 'lab-4-vlans-trunking';
      const sw = base.devices.find((d) => d.name === 'SW-Access');
      if (sw) {
        sw.interfaces[0].accessVlan = 1; // Fa0/1 wrong VLAN
        sw.interfaces[6].switchportMode = 'access'; // Gi0/1 not trunk
      }
      const synced = synchronizeNetworkState(base.devices, base.links);
      base.devices = synced.devices;
      base.links = synced.links;
      return base;
    },
    objectives: [
      {
        id: 'obj-4-fa01',
        description: 'SW-Access Fa0/1 is in Access mode assigned to VLAN 10',
        check: (proj) => {
          const sw = proj.devices.find((d) => d.name === 'SW-Access');
          const fa01 = sw?.interfaces[0];
          const ok = fa01?.switchportMode === 'access' && fa01?.accessVlan === 10;
          return {
            passed: !!ok,
            feedback: ok ? 'Fa0/1 assigned to VLAN 10.' : 'Set SW-Access Fa0/1 to Access VLAN 10.',
          };
        },
      },
      {
        id: 'obj-4-gi01',
        description: 'SW-Access Gi0/1 is configured as an 802.1Q Trunk port',
        check: (proj) => {
          const sw = proj.devices.find((d) => d.name === 'SW-Access');
          const gi01 = sw?.interfaces[6];
          const ok = gi01?.switchportMode === 'trunk';
          return {
            passed: !!ok,
            feedback: ok ? 'Gi0/1 is operating as an 802.1Q Trunk.' : 'Set SW-Access Gi0/1 switchport mode to trunk.',
          };
        },
      },
      {
        id: 'obj-4-ping',
        description: 'Student-PC1 (192.168.10.11) can ping Student-PC2 (192.168.10.12)',
        check: (proj) => {
          const pc1 = proj.devices.find((d) => d.name === 'Student-PC1');
          if (!pc1) return { passed: false, feedback: 'Student-PC1 missing.' };
          const res = runPacketSimulation(pc1.id, '192.168.10.12', 'ICMP', proj.devices, proj.links);
          return {
            passed: res.session.overallSuccess,
            feedback: res.session.overallSuccess
              ? 'VLAN 10 traffic crossed the 802.1Q trunk successfully!'
              : res.session.summaryMessage,
          };
        },
      },
    ],
  },
  {
    id: 'lab-5-broken-network-fix',
    title: 'Lab 5: Troubleshooting a Multi-Fault Routed Network',
    category: 'Static Routing',
    difficulty: 'Advanced',
    estimatedMinutes: 25,
    prerequisites: ['Lab 3: Implementing Bidirectional Static Routing', 'Troubleshooting'],
    summary:
      'Use network diagnostics, CLI show commands, and packet tracing to repair three simultaneous network faults between PC1-Branch and PC2-HQ.',
    scenario:
      'Users at the Branch office (PC1-Branch, 192.168.1.10) report complete loss of connectivity to HQ (PC2-HQ, 192.168.2.10). Run "Check Network" or inspect devices manually to find and fix all three issues.',
    instructions: [
      'Fix PC1-Branch Default Gateway so it points to R1’s LAN IP (192.168.1.1).',
      'Enable R1’s LAN interface (GigabitEthernet0/0) using "no shutdown".',
      'Add a return static route on R2 for subnet 192.168.1.0 255.255.255.0 via next-hop 10.10.10.1.',
      'Verify two-way ICMP connectivity between PC1-Branch and PC2-HQ.',
    ],
    hints: [
      'Click "Check Network" in the top bar to see all 3 confirmed issues.',
      'On R2 CLI: ip route 192.168.1.0 255.255.255.0 10.10.10.1',
    ],
    solutionExplanation:
      'End-to-end communication requires every link and layer along both directions to function: (1) PC1 needed a valid Default Gateway in 192.168.1.0/24, (2) R1 Gi0/0 needed "no shutdown" to bring the physical and data-link layers up, and (3) R2 needed a static route back to 192.168.1.0/24 so ICMP Echo Replies could return.',
    createInitialProject: () => {
      const base = NETWORK_TEMPLATES[4].buildProject();
      base.id = 'lab-proj-5';
      base.name = 'Lab 5: Multi-Fault Troubleshooting';
      base.labId = 'lab-5-broken-network-fix';
      return base;
    },
    objectives: [
      {
        id: 'obj-5-gw',
        description: 'PC1-Branch Default Gateway corrected to 192.168.1.1',
        check: (proj) => {
          const pc1 = proj.devices.find((d) => d.name === 'PC1-Branch');
          const ok = pc1?.defaultGateway === '192.168.1.1';
          return {
            passed: !!ok,
            feedback: ok ? 'PC1-Branch Default Gateway is valid.' : 'Change PC1-Branch Default Gateway to 192.168.1.1.',
          };
        },
      },
      {
        id: 'obj-5-r1',
        description: 'R1 interface Gi0/0 is enabled (no shutdown)',
        check: (proj) => {
          const r1 = proj.devices.find((d) => d.name === 'R1');
          const ok = r1?.interfaces[0]?.adminUp;
          return {
            passed: !!ok,
            feedback: ok ? 'R1 Gi0/0 is up.' : 'Enable R1 Gi0/0 using "no shutdown".',
          };
        },
      },
      {
        id: 'obj-5-r2',
        description: 'R2 has a return route to 192.168.1.0/24 via 10.10.10.1',
        check: (proj) => {
          const r2 = proj.devices.find((d) => d.name === 'R2');
          const ok = r2?.routingTable.some(
            (r) =>
              (r.network === '192.168.1.0' || r.network === '0.0.0.0') &&
              isValidIpv4(r.nextHop)
          );
          return {
            passed: !!ok,
            feedback: ok
              ? 'R2 return route configured.'
              : 'Add static route on R2: ip route 192.168.1.0 255.255.255.0 10.10.10.1',
          };
        },
      },
      {
        id: 'obj-5-ping',
        description: 'PC1-Branch can ping PC2-HQ (192.168.2.10)',
        check: (proj) => {
          const pc1 = proj.devices.find((d) => d.name === 'PC1-Branch');
          if (!pc1) return { passed: false, feedback: 'PC1-Branch missing.' };
          const res = runPacketSimulation(pc1.id, '192.168.2.10', 'ICMP', proj.devices, proj.links);
          return {
            passed: res.session.overallSuccess,
            feedback: res.session.overallSuccess
              ? 'All network faults resolved! PC1-Branch can reach PC2-HQ.'
              : res.session.summaryMessage,
          };
        },
      },
    ],
  },
];

export interface TroubleshootingChallenge {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  symptom: string;
  goal: string;
  hints: string[];
  diagnosticCommandsSuggested: string[];
  postMortemExplanation: {
    whatWasWrong: string;
    howIdentified: string;
    whatFixedIt: string;
    keyTakeaway: string;
  };
  buildChallengeProject: () => NetworkProject;
  verifySolved: (project: NetworkProject) => { solved: boolean; details: string };
}

export const TROUBLESHOOTING_CHALLENGES: TroubleshootingChallenge[] = [
  {
    id: 'chal-subnet-mask-mismatch',
    title: 'Challenge 1: The Unreachable Local Neighbor (Subnet Mask Fault)',
    difficulty: 'Beginner',
    symptom:
      'PC1 (192.168.1.10) cannot ping PC2 (192.168.1.200) even though both are plugged into SW1 and their link lights are green.',
    goal: 'Identify why PC1 treats 192.168.1.200 as a remote network and restore direct Layer 2 LAN communication.',
    hints: [
      'Inspect PC1’s subnet mask closely. What is the broadcast address of a /25 (255.255.255.128) subnet?',
      '192.168.1.10/25 only covers 192.168.1.1 through 192.168.1.126!',
    ],
    diagnosticCommandsSuggested: ['ipconfig /all', 'ping 192.168.1.200', 'arp -a'],
    postMortemExplanation: {
      whatWasWrong:
        'PC1 was configured with subnet mask 255.255.255.128 (/25) instead of 255.255.255.0 (/24). Because .200 is outside the .0–.127 block, PC1 believed PC2 was on a remote network.',
      howIdentified:
        'Running "ipconfig" on PC1 revealed a 255.255.255.128 mask while PC2 had 255.255.255.0.',
      whatFixedIt: 'Updating PC1’s subnet mask to 255.255.255.0 (/24) placed both hosts in the same broadcast domain.',
      keyTakeaway:
        'A host performs a bitwise AND of its IP, destination IP, and its own subnet mask to decide whether to ARP directly or send to a Default Gateway.',
    },
    buildChallengeProject: () => {
      const proj = NETWORK_TEMPLATES[0].buildProject();
      proj.id = 'chal-proj-1';
      proj.name = 'Challenge 1: Subnet Mask Fault';
      proj.challengeId = 'chal-subnet-mask-mismatch';
      proj.devices[0].interfaces[0].subnetMask = '255.255.255.128'; // /25 fault
      proj.devices[0].defaultGateway = '';
      proj.devices[2].interfaces[0].ipAddress = '192.168.1.200';
      const synced = synchronizeNetworkState(proj.devices, proj.links);
      proj.devices = synced.devices;
      proj.links = synced.links;
      return proj;
    },
    verifySolved: (proj) => {
      const pc1 = proj.devices.find((d) => d.name === 'PC1');
      if (!pc1) return { solved: false, details: 'PC1 missing.' };
      const sim = runPacketSimulation(pc1.id, '192.168.1.200', 'ICMP', proj.devices, proj.links);
      return {
        solved: sim.session.overallSuccess,
        details: sim.session.overallSuccess
          ? 'Challenge Solved! PC1 and PC2 can communicate directly on 192.168.1.0/24.'
          : sim.session.summaryMessage,
      };
    },
  },
  {
    id: 'chal-vlan-isolation-fault',
    title: 'Challenge 2: Isolated Trunk & Missing Allowed VLAN',
    difficulty: 'Intermediate',
    symptom:
      'Student-PC1 (192.168.10.11) on SW-Access cannot reach Student-PC2 (192.168.10.12) or its default gateway 192.168.10.1 on MLS-Core.',
    goal: 'Inspect the 802.1Q trunk between SW-Access and MLS-Core and permit VLAN 10 across the link.',
    hints: [
      'Check which VLANs are allowed on SW-Access interface Gi0/1.',
      'Use "show interfaces" or "show running-config" on SW-Access.',
    ],
    diagnosticCommandsSuggested: ['show vlan brief', 'show running-config', 'switchport trunk allowed vlan 1,10,20'],
    postMortemExplanation: {
      whatWasWrong:
        'SW-Access uplink Gi0/1 was configured as a trunk, but its allowed VLAN list only permitted VLANs 1 and 20, pruning VLAN 10 traffic.',
      howIdentified:
        'Running a packet simulation showed the frame being dropped at the trunk egress port due to VLAN 10 not being in the trunk allowed list.',
      whatFixedIt:
        'Adding VLAN 10 to the trunk allowed VLAN list on SW-Access Gi0/1 restored 802.1Q tagging for Student-PC1.',
      keyTakeaway:
        '802.1Q trunks must permit all active VLANs on both ends of the inter-switch link.',
    },
    buildChallengeProject: () => {
      const proj = NETWORK_TEMPLATES[2].buildProject();
      proj.id = 'chal-proj-2';
      proj.name = 'Challenge 2: Pruned Trunk VLAN';
      proj.challengeId = 'chal-vlan-isolation-fault';
      const sw = proj.devices.find((d) => d.name === 'SW-Access');
      if (sw) {
        sw.interfaces[6].trunkAllowedVlans = [1, 20]; // Removed VLAN 10!
      }
      const synced = synchronizeNetworkState(proj.devices, proj.links);
      proj.devices = synced.devices;
      proj.links = synced.links;
      return proj;
    },
    verifySolved: (proj) => {
      const pc1 = proj.devices.find((d) => d.name === 'Student-PC1');
      if (!pc1) return { solved: false, details: 'Student-PC1 missing.' };
      const sim = runPacketSimulation(pc1.id, '192.168.10.12', 'ICMP', proj.devices, proj.links);
      return {
        solved: sim.session.overallSuccess,
        details: sim.session.overallSuccess
          ? 'Challenge Solved! VLAN 10 frames now traverse the 802.1Q trunk between switches.'
          : sim.session.summaryMessage,
      };
    },
  },
  {
    id: 'chal-acl-blocking',
    title: 'Challenge 3: Investigating an Access-Control List (ACL) Block',
    difficulty: 'Advanced',
    symptom:
      'PC-West (192.168.10.10) can ping R1-West (192.168.10.1), and all routes exist on both routers, yet pings to PC-East (192.168.20.10) are dropped by R2-East.',
    goal: 'Inspect R2-East for a restrictive inbound ACL on Gi0/1 and either permit traffic from 192.168.10.0/24 or remove the blocking ACL filter.',
    hints: [
      'Select R2-East and run "show access-lists" and "show running-config" in the CLI.',
      'Check interface Gi0/1 on R2-East for an inbound ACL assignment.',
    ],
    diagnosticCommandsSuggested: ['show access-lists', 'show running-config', 'no access-list 101'],
    postMortemExplanation: {
      whatWasWrong:
        'An extended ACL (101) was applied inbound on R2-East Gi0/1 with a "deny icmp" rule blocking all ping requests from 192.168.10.0/24.',
      howIdentified:
        'Packet step visualization showed the packet reaching R2-East Gi0/1 and dropping with an Inbound ACL 101 violation.',
      whatFixedIt:
        'Removing the ACL rule or adding a permit statement on R2-East allowed ICMP traffic through to the East LAN.',
      keyTakeaway:
        'When Layer 1–3 routing is verified but packets drop at a router boundary, always inspect inbound and outbound Access-Control Lists ("show ip interface" and "show access-lists").',
    },
    buildChallengeProject: () => {
      const proj = NETWORK_TEMPLATES[1].buildProject();
      proj.id = 'chal-proj-3';
      proj.name = 'Challenge 3: ACL Traffic Block';
      proj.challengeId = 'chal-acl-blocking';
      const r2 = proj.devices.find((d) => d.name === 'R2-East');
      if (r2) {
        r2.acls = [
          {
            id: 'acl-block-icmp',
            aclNumber: 101,
            action: 'deny',
            protocol: 'icmp',
            sourceIp: 'any',
            sourceWildcard: '0.0.0.0',
            destIp: 'any',
            destWildcard: '0.0.0.0',
          },
        ];
        r2.interfaces[1].aclIn = 101; // Gi0/1 inbound ACL
      }
      const synced = synchronizeNetworkState(proj.devices, proj.links);
      proj.devices = synced.devices;
      proj.links = synced.links;
      return proj;
    },
    verifySolved: (proj) => {
      const pc1 = proj.devices.find((d) => d.name === 'PC-West');
      if (!pc1) return { solved: false, details: 'PC-West missing.' };
      const sim = runPacketSimulation(pc1.id, '192.168.20.10', 'ICMP', proj.devices, proj.links);
      return {
        solved: sim.session.overallSuccess,
        details: sim.session.overallSuccess
          ? 'Challenge Solved! ACL 101 no longer blocks ICMP traffic between West and East LANs.'
          : sim.session.summaryMessage,
      };
    },
  },
];
