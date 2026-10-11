export interface LessonQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LearningLesson {
  id: string;
  title: string;
  pathCategory:
    | 'Networking Fundamentals'
    | 'OSI & TCP/IP Models'
    | 'Ethernet & Switching'
    | 'IPv4 Addressing & Subnetting'
    | 'ARP & ICMP'
    | 'Routers & Static Routing'
    | 'VLANs & 802.1Q Trunking'
    | 'DHCP, DNS & Services'
    | 'OSPF, ACLs & NAT'
    | 'Troubleshooting & Documentation';
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  durationMinutes: number;
  prerequisites: string[];
  objectives: string[];
  explanation: string[];
  keyTerminology: { term: string; definition: string }[];
  practicalExample: {
    title: string;
    scenario: string;
    commands: string[];
    whyUsed: string;
    verification: string;
  };
  commonMistakes: string[];
  quiz: LessonQuizQuestion[];
  relatedLabId?: string;
  relatedInteractiveTool?: 'osi-explorer' | 'encapsulation' | 'subnet-tutor' | 'arp-demo' | 'vlan-demo';
}

export const LEARNING_LESSONS: LearningLesson[] = [
  {
    id: 'les-osi-tcpip',
    title: '1. The OSI 7-Layer Model & Packet Encapsulation',
    pathCategory: 'OSI & TCP/IP Models',
    level: 'Beginner',
    durationMinutes: 12,
    prerequisites: [],
    objectives: [
      'Identify the 7 layers of the OSI Reference Model and their Protocol Data Units (PDUs)',
      'Understand how application data is encapsulated into Segments, Packets, Frames, and Bits',
      'Distinguish between Layer 2 MAC addressing (hop-to-hop) and Layer 3 IP addressing (end-to-end)',
    ],
    explanation: [
      'Every network communication—from loading a web page to running an ICMP ping—travels through a layered protocol stack. The Open Systems Interconnection (OSI) model divides this workflow into seven clear layers so engineers can isolate hardware, switching, routing, and software responsibilities.',
      'As data moves down the stack on the sending host (Encapsulation), each layer prepends its own header: Layer 4 adds TCP/UDP port numbers (Segment), Layer 3 adds Source and Destination IPv4/IPv6 addresses (Packet), and Layer 2 adds Source and Destination MAC addresses plus an FCS trailer (Frame) before Layer 1 transmits physical signals across the cable.',
      'Critical CCNA rule: Source and Destination IP addresses remain constant from the original sender to the final destination (unless NAT is configured), whereas Source and Destination MAC addresses are rewritten at every single Layer 3 router hop.',
    ],
    keyTerminology: [
      {
        term: 'Protocol Data Unit (PDU)',
        definition: 'The unit of data at a specific OSI layer: Data (L7), Segment/Datagram (L4), Packet (L3), Frame (L2), Bits (L1).',
      },
      {
        term: 'Encapsulation',
        definition: 'Wrapping data with protocol headers (ports, IP addresses, MAC addresses) before transmission.',
      },
      {
        term: 'De-encapsulation',
        definition: 'Stripping away outer headers as a receiving device processes a frame up the protocol stack.',
      },
    ],
    practicalExample: {
      title: 'Inspecting Layer 1, Layer 2, and Layer 3 Status on a Cisco Router',
      scenario: 'Verify whether an interface is physically up (Layer 1), data-link operational (Layer 2), and IP-configured (Layer 3).',
      commands: ['enable', 'show ip interface brief', 'show interfaces GigabitEthernet0/0'],
      whyUsed:
        'In "show ip interface brief", the "Status" column reflects Layer 1 physical carrier status (or "administratively down" if shutdown), while the "Protocol" column reflects Layer 2 data-link keepalives.',
      verification: 'Confirm both Status and Protocol display "up" and an IPv4 address is assigned.',
    },
    commonMistakes: [
      'Confusing MAC addresses with IP addresses: MAC addresses only have local significance within a single VLAN/subnet.',
      'Assuming ICMP uses TCP or UDP ports: ICMP is a Layer 3 control protocol (IP Protocol 1) and has no Layer 4 port numbers.',
    ],
    quiz: [
      {
        question: 'When a packet crosses three routers on its way from PC1 to a remote web server, which header fields change at every router hop?',
        options: [
          'Source and Destination TCP Port Numbers',
          'Source and Destination MAC Addresses and the IPv4 TTL field',
          'Source and Destination IPv4 Addresses on every LAN',
          'The HTTP Application payload',
        ],
        correctIndex: 1,
        explanation:
          'Each router strips the incoming Layer 2 Ethernet frame, decrements the IPv4 Time-To-Live (TTL) by 1, and encapsulates the packet in a brand-new Layer 2 frame with the egress interface MAC as source and next-hop MAC as destination.',
      },
      {
        question: 'In "show ip interface brief", what does "administratively down" in the Status column indicate?',
        options: [
          'The Ethernet cable is physically unplugged',
          'The interface has been disabled with the "shutdown" command',
          'There is a duplicate IP address conflict',
          'The remote switch port is in the wrong VLAN',
        ],
        correctIndex: 1,
        explanation:
          '"Administratively down" always means the interface has the "shutdown" configuration applied. Run "no shutdown" in interface configuration mode to enable it.',
      },
    ],
    relatedLabId: 'lab-1-first-lan',
    relatedInteractiveTool: 'osi-explorer',
  },
  {
    id: 'les-ethernet-switching',
    title: '2. Ethernet Frames, MAC Learning & Layer 2 Switching',
    pathCategory: 'Ethernet & Switching',
    level: 'Beginner',
    durationMinutes: 15,
    prerequisites: ['1. The OSI 7-Layer Model & Packet Encapsulation'],
    objectives: [
      'Explain how a Layer 2 switch builds its MAC Address Table (CAM table) dynamically',
      'Predict when a switch will Flood, Forward, or Filter an incoming Ethernet frame',
      'Inspect learned MAC addresses using "show mac address-table"',
    ],
    explanation: [
      'Unlike legacy Ethernet hubs that blindly repeat electrical signals out every port, a Layer 2 Ethernet switch makes intelligent forwarding decisions in hardware based on 48-bit MAC addresses (e.g., 00:50:79:00:00:65).',
      'Step 1 — Learning: Every time a frame enters a switch port, the switch inspects the Source MAC address and records which port and VLAN it arrived on in its MAC address table.',
      'Step 2 — Forwarding vs. Flooding: The switch then looks up the Destination MAC address in its table. If a matching entry exists for that VLAN, the frame is unicast-forwarded solely out that target port. If the Destination MAC is unknown (unknown unicast) or is the Broadcast address (FF:FF:FF:FF:FF:FF), the switch floods the frame out all active ports in that same VLAN except the ingress port.',
    ],
    keyTerminology: [
      {
        term: 'CAM Table (MAC Address Table)',
        definition: 'High-speed memory in a switch mapping MAC addresses to physical switchports and VLAN IDs.',
      },
      {
        term: 'Unknown Unicast Flooding',
        definition: 'When a switch does not yet know which port owns a destination MAC, it floods the frame to all ports in the same VLAN.',
      },
      {
        term: 'Broadcast Address',
        definition: 'FF:FF:FF:FF:FF:FF — a Layer 2 MAC address delivered to every host in the current VLAN.',
      },
    ],
    practicalExample: {
      title: 'Inspecting the Switch MAC Address Table After a Ping',
      scenario: 'After PC1 pings PC2 through Switch SW1, view the learned dynamic MAC addresses on SW1.',
      commands: ['enable', 'show mac address-table', 'show interfaces status'],
      whyUsed:
        '"show mac address-table" verifies physical Layer 2 connectivity and reveals exactly which switchport each host MAC address is connected to.',
      verification: 'Verify that both PC1 and PC2 MAC addresses appear as DYNAMIC entries under VLAN 1.',
    },
    commonMistakes: [
      'Looking for MAC addresses in the switch table before any traffic has been sent—switches only learn MACs when hosts transmit frames.',
      'Trying to assign an host IP address directly to a Layer 2 switchport instead of an SVI (interface Vlan1).',
    ],
    quiz: [
      {
        question: 'How does a Cisco Catalyst switch populate its MAC address table by default?',
        options: [
          'By inspecting the Destination MAC address of outgoing frames',
          'By inspecting the Source MAC address of incoming frames on each port',
          'By querying the router routing table over OSPF',
          'By scanning all IP addresses with ICMP Ping',
        ],
        correctIndex: 1,
        explanation:
          'Switches learn where devices live by reading the Source MAC address of every frame that enters a switchport.',
      },
    ],
    relatedLabId: 'lab-1-first-lan',
    relatedInteractiveTool: 'encapsulation',
  },
  {
    id: 'les-ipv4-subnetting',
    title: '3. IPv4 Addressing, CIDR Prefixes & Subnetting Mastery',
    pathCategory: 'IPv4 Addressing & Subnetting',
    level: 'Beginner',
    durationMinutes: 20,
    prerequisites: ['1. The OSI 7-Layer Model & Packet Encapsulation'],
    objectives: [
      'Calculate Network ID, Broadcast IP, and Usable Host Range for any CIDR prefix (/8 to /30)',
      'Understand how a host uses its subnet mask to decide between local ARP and Default Gateway routing',
      'Avoid overlapping subnets and invalid network/broadcast host assignments',
    ],
    explanation: [
      'An IPv4 address is a 32-bit binary number written as four dotted-decimal octets (e.g., 192.168.10.25). Every IPv4 address is divided into two parts by its Subnet Mask: the Network Prefix (contiguous 1s in the mask) and the Host Identifier (contiguous 0s in the mask).',
      'For a /24 subnet (255.255.255.0), the first 24 bits identify the network (e.g., 192.168.10.0) and the remaining 8 host bits yield 2^8 = 256 total addresses. Because the first address (all host bits 0 -> .0) is reserved as the Network Address and the last address (all host bits 1 -> .255) is reserved as the Directed Broadcast Address, a /24 provides 256 - 2 = 254 usable host addresses (.1 through .254).',
      'When you borrow host bits to create smaller subnets (e.g., moving from /24 to /26 or 255.255.255.192), you leave 6 host bits (2^6 - 2 = 62 usable hosts per block) with subnets incrementing in blocks of 64 (.0, .64, .128, .192).',
    ],
    keyTerminology: [
      {
        term: 'CIDR (Classless Inter-Domain Routing)',
        definition: 'Slash notation (such as /24 or /27) indicating how many leading bits form the network prefix.',
      },
      {
        term: 'Network Address',
        definition: 'The first address in a subnet where all host bits are 0; identifies the subnet itself in routing tables.',
      },
      {
        term: 'Broadcast Address',
        definition: 'The final address in a subnet where all host bits are 1; sends packets to all hosts in that subnet.',
      },
    ],
    practicalExample: {
      title: 'Assigning a Subnet IP to a Router Interface',
      scenario: 'Configure Router R1 Gi0/0 as the first usable host (.1) on the 192.168.10.0/26 subnet.',
      commands: [
        'enable',
        'configure terminal',
        'interface GigabitEthernet0/0',
        'ip address 192.168.10.1 255.255.255.192',
        'no shutdown',
      ],
      whyUsed: 'Assigns the router interface IP and defines the /26 connected network range (192.168.10.1 – 192.168.10.62).',
      verification: 'Run "show ip route" to verify the router automatically creates a Connected (C) route for 192.168.10.0/26.',
    },
    commonMistakes: [
      'Assigning the Network Address (e.g., 192.168.1.64/26) or Broadcast Address (192.168.1.127/26) to a PC or router interface.',
      'Mismatched subnet masks between a PC (/25) and its router gateway (/24), causing communication failure with half of the LAN.',
    ],
    quiz: [
      {
        question: 'How many usable host IPv4 addresses are available in a /26 subnet (255.255.255.192)?',
        options: ['30 usable hosts', '62 usable hosts', '64 usable hosts', '126 usable hosts'],
        correctIndex: 1,
        explanation:
          'A /26 leaves 32 - 26 = 6 host bits. 2^6 = 64 total addresses, minus 2 (network and broadcast) = 62 usable hosts.',
      },
    ],
    relatedLabId: 'lab-2-router-gateway',
    relatedInteractiveTool: 'subnet-tutor',
  },
  {
    id: 'les-arp-icmp',
    title: '4. ARP Resolution & ICMP Connectivity Diagnostics',
    pathCategory: 'ARP & ICMP',
    level: 'Beginner',
    durationMinutes: 14,
    prerequisites: ['2. Ethernet Frames, MAC Learning & Layer 2 Switching'],
    objectives: [
      'Trace the step-by-step ARP Request (Broadcast) and ARP Reply (Unicast) workflow',
      'Explain why ARP resolves the Default Gateway MAC address when pinging a remote subnet',
      'Use "arp -a" and "show arp" to diagnose Layer 2/Layer 3 resolution issues',
    ],
    explanation: [
      'When an application or user pings an IPv4 address (e.g., 192.168.1.20), the sending host knows the destination IP address at Layer 3, but cannot put an Ethernet frame on the wire without knowing the destination MAC address at Layer 2.',
      'The host checks its local ARP Cache. If no entry exists for the next-hop IP, it pauses the ICMP packet and sends an ARP Request encapsulated in an Ethernet Broadcast frame (Destination MAC FF:FF:FF:FF:FF:FF) asking: "Who has 192.168.1.20? Tell 192.168.1.10".',
      'Every host in the VLAN receives the broadcast, but only the owner of 192.168.1.20 sends back a unicast ARP Reply with its MAC address. If the target IP is on a remote subnet, the sender ARPs for its Default Gateway IP instead!',
    ],
    keyTerminology: [
      {
        term: 'ARP (Address Resolution Protocol)',
        definition: 'Protocol that dynamically maps a known IPv4 address to a Layer 2 MAC address on the local broadcast domain.',
      },
      {
        term: 'Proxy / Gateway ARP Target',
        definition: 'When sending to a remote subnet, a host resolves the MAC address of its Default Gateway router, not the final remote host.',
      },
      {
        term: 'ICMP Echo Request / Reply',
        definition: 'Layer 3 diagnostic messages (Type 8 Request, Type 0 Reply) used by the ping utility to test two-way reachability.',
      },
    ],
    practicalExample: {
      title: 'Inspecting and Clearing the ARP Table on a PC and Router',
      scenario: 'Verify learned IP-to-MAC mappings after running a ping test.',
      commands: ['ping 192.168.1.20', 'arp -a', 'show ip arp'],
      whyUsed:
        'If "arp -a" is empty after a failed ping to a local neighbor, the failure is at Layer 1 or Layer 2 (cable, shutdown port, or VLAN mismatch) rather than Layer 3 routing.',
      verification: 'Check that the neighbor IPv4 address maps to a valid 00:50:79:XX:XX:XX hardware address.',
    },
    commonMistakes: [
      'Expecting a PC to learn the MAC address of a server on another side of a router—ARP never crosses a Layer 3 router boundary.',
    ],
    quiz: [
      {
        question: 'PC1 (192.168.10.10/24, GW 192.168.10.1) pings PC2 (192.168.20.10/24). Whose MAC address does PC1 put in the Destination MAC field of the Ethernet frame?',
        options: [
          'PC2’s MAC address',
          'Switch SW1’s VLAN 1 MAC address',
          'Default Gateway Router R1’s Gi0/0 MAC address (192.168.10.1)',
          'FF:FF:FF:FF:FF:FF on the ICMP packet',
        ],
        correctIndex: 2,
        explanation:
          'Because 192.168.20.10 is in a different subnet, PC1 ARPs for its Default Gateway (192.168.10.1) and addresses the Layer 2 frame to R1’s LAN MAC address.',
      },
    ],
    relatedLabId: 'lab-2-router-gateway',
    relatedInteractiveTool: 'arp-demo',
  },
  {
    id: 'les-static-routing',
    title: '5. Routers, Routing Tables & Static Routing',
    pathCategory: 'Routers & Static Routing',
    level: 'Intermediate',
    durationMinutes: 18,
    prerequisites: ['3. IPv4 Addressing, CIDR Prefixes & Subnetting Mastery'],
    objectives: [
      'Read a Cisco IOS routing table ("show ip route") including Connected (C), Static (S), and Default (S*) codes',
      'Apply Longest-Prefix Match rules when multiple routes match a destination IP',
      'Configure bidirectional static routes so both forward requests and return replies succeed',
    ],
    explanation: [
      'When a router receives a frame addressed to its own MAC address, it strips the Layer 2 header and inspects the Destination IPv4 address. It then searches its Routing Table for the most specific route (Longest Prefix Match: e.g., a /26 route beats a /24 route, which beats a /0 default route).',
      'If multiple routing sources advertise the exact same prefix length, the router prefers the route with the lowest Administrative Distance (AD): Connected (0), Static (1), OSPF (110), RIP (120).',
      'If no matching route exists and no Default Route (0.0.0.0 0.0.0.0) is configured, the router immediately drops the packet and returns an ICMP Destination Network Unreachable message to the sender.',
    ],
    keyTerminology: [
      {
        term: 'Longest Prefix Match',
        definition: 'Routing rule stating that the route with the highest number of matching leading network bits (/28 over /24) is always chosen.',
      },
      {
        term: 'Administrative Distance (AD)',
        definition: 'Trustworthiness rating of a route source (Connected = 0, Static = 1, OSPF = 110, RIP = 120). Lower is preferred.',
      },
      {
        term: 'Default Route (Gateway of Last Resort)',
        definition: '0.0.0.0 0.0.0.0 — matches any destination IP when no more specific route exists in the routing table.',
      },
    ],
    practicalExample: {
      title: 'Configuring a Static Route and Default Route in Cisco IOS',
      scenario: 'Teach Router R1 how to reach the 192.168.20.0/24 LAN via Router R2 (10.0.0.2).',
      commands: [
        'enable',
        'configure terminal',
        'ip route 192.168.20.0 255.255.255.0 10.0.0.2',
        'end',
        'show ip route',
      ],
      whyUsed: 'Explicitly instructs R1 to forward any packet destined for 192.168.20.0/24 to next-hop router 10.0.0.2.',
      verification: 'Look for "S 192.168.20.0/24 [1/0] via 10.0.0.2" in the output of "show ip route".',
    },
    commonMistakes: [
      'Forgetting the return route: Configuring R1 -> R2 without configuring R2 -> R1 causes pings to reach the destination host but fail on the Echo Reply.',
      'Using the local router’s own interface IP as the next-hop IP instead of the neighboring router’s interface IP.',
    ],
    quiz: [
      {
        question: 'A router has three routes in its table: 10.0.0.0/8 via 172.16.0.1, 10.10.0.0/16 via 172.16.0.2, and 10.10.5.0/24 via 172.16.0.3. Which next-hop will it choose for a packet to 10.10.5.99?',
        options: ['172.16.0.1 (/8)', '172.16.0.2 (/16)', '172.16.0.3 (/24)', 'It load-balances across all three'],
        correctIndex: 2,
        explanation:
          'Routers always follow Longest-Prefix Match first: /24 (24 matching bits) is more specific than /16 or /8.',
      },
    ],
    relatedLabId: 'lab-3-static-routing',
  },
  {
    id: 'les-vlans-trunking',
    title: '6. VLAN Segmentation, 802.1Q Trunks & Inter-VLAN Routing',
    pathCategory: 'VLANs & 802.1Q Trunking',
    level: 'Intermediate',
    durationMinutes: 18,
    prerequisites: ['2. Ethernet Frames, MAC Learning & Layer 2 Switching'],
    objectives: [
      'Create VLANs and assign switchports as Access ports ("switchport access vlan")',
      'Configure IEEE 802.1Q Trunk links between switches ("switchport mode trunk")',
      'Explain how a Layer 3 Switch or Router routes traffic between isolated VLANs',
    ],
    explanation: [
      'A Virtual Local Area Network (VLAN) logically partitions a single physical Layer 2 switch into multiple independent broadcast domains. Hosts in VLAN 10 (Students) and VLAN 20 (Faculty) cannot see each other’s ARP broadcasts or communicate directly at Layer 2, even when plugged into adjacent ports on the same switch.',
      'Access Ports connect to end devices (PCs, printers, servers) and belong to a single VLAN. Trunk Ports connect switches to other switches or routers and carry traffic for multiple VLANs simultaneously by inserting a 4-byte IEEE 802.1Q header tag into each Ethernet frame.',
      'To allow hosts in VLAN 10 to communicate with VLAN 20, traffic must pass through a Layer 3 device—either a router subinterface (Router-on-a-Stick) or Switched Virtual Interfaces (SVIs, such as "interface Vlan10" and "interface Vlan20") on a Layer 3 Multilayer Switch.',
    ],
    keyTerminology: [
      {
        term: 'Access Port',
        definition: 'A switchport assigned to a single VLAN that sends and receives untagged Ethernet frames to end devices.',
      },
      {
        term: 'IEEE 802.1Q Trunk',
        definition: 'An inter-switch or switch-to-router link that tags Ethernet frames with a 12-bit VLAN ID (1–4094).',
      },
      {
        term: 'SVI (Switched Virtual Interface)',
        definition: 'A virtual Layer 3 routed interface for a VLAN (e.g., interface Vlan10) on a multilayer switch acting as the default gateway for that VLAN.',
      },
    ],
    practicalExample: {
      title: 'Creating VLAN 10 and Configuring an 802.1Q Trunk',
      scenario: 'Place port Fa0/1 into VLAN 10 and configure Gi0/1 as an 802.1Q trunk uplink.',
      commands: [
        'enable',
        'configure terminal',
        'vlan 10',
        'name STUDENTS',
        'interface FastEthernet0/1',
        'switchport mode access',
        'switchport access vlan 10',
        'interface GigabitEthernet0/1',
        'switchport mode trunk',
        'end',
        'show vlan brief',
      ],
      whyUsed: 'Isolates Fa0/1 into the STUDENTS broadcast domain and tags VLAN 10 across uplink Gi0/1.',
      verification: 'Run "show vlan brief" to verify Fa0/1 is listed beside VLAN 10.',
    },
    commonMistakes: [
      'Leaving one side of an inter-switch cable in "access" mode while setting the other side to "trunk" mode.',
      'Pruning an active VLAN from the trunk allowed VLAN list ("switchport trunk allowed vlan").',
    ],
    quiz: [
      {
        question: 'What protocol standard inserts a 4-byte VLAN tag into Ethernet frames traversing a trunk link?',
        options: ['IEEE 802.11ac', 'IEEE 802.1Q', 'IEEE 802.1D', 'RFC 1918'],
        correctIndex: 1,
        explanation: 'IEEE 802.1Q is the industry standard for VLAN tagging over Ethernet trunk links.',
      },
    ],
    relatedLabId: 'lab-4-vlans-trunking',
    relatedInteractiveTool: 'vlan-demo',
  },
  {
    id: 'les-dhcp-dns-services',
    title: '7. Network Services: DHCP DORA Process & DNS Resolution',
    pathCategory: 'DHCP, DNS & Services',
    level: 'Intermediate',
    durationMinutes: 14,
    prerequisites: ['4. ARP Resolution & ICMP Connectivity Diagnostics'],
    objectives: [
      'Trace the four-step DHCP DORA exchange (Discover, Offer, Request, Acknowledge)',
      'Configure DNS resource records (A records) and resolve domain names to IPv4 addresses',
      'Troubleshoot DHCP lease failures and NXDOMAIN / unreachable DNS errors',
    ],
    explanation: [
      'Dynamic Host Configuration Protocol (DHCP) automates IPv4 configuration so administrators do not have to manually type IP addresses, subnet masks, default gateways, and DNS servers on hundreds of client workstations.',
      'When a DHCP client boots, it initiates the four-step DORA process over UDP ports 67 and 68: (1) DHCP Discover (client broadcast 0.0.0.0 -> 255.255.255.255), (2) DHCP Offer (server proposes an IP lease), (3) DHCP Request (client formally requests the offered IP), and (4) DHCP ACK (server confirms the lease and options).',
      'Domain Name System (DNS, UDP/TCP port 53) translates human-friendly domain names (such as intranet.netlab.edu) into IPv4/IPv6 addresses so browsers and CLI tools can route packets to the server.',
    ],
    keyTerminology: [
      {
        term: 'DORA (Discover, Offer, Request, Acknowledge)',
        definition: 'The 4-packet handshake used by DHCP clients and servers to allocate an IPv4 lease.',
      },
      {
        term: 'DNS A Record',
        definition: 'An Address record mapping a hostname (e.g., portal.netlab.edu) to a 32-bit IPv4 address.',
      },
    ],
    practicalExample: {
      title: 'Renewing a DHCP Lease and Testing DNS Resolution on a PC',
      scenario: 'Obtain a dynamic IP lease from SRV-Core and resolve intranet.netlab.edu.',
      commands: ['ipconfig /renew', 'ipconfig /all', 'nslookup intranet.netlab.edu'],
      whyUsed: '"ipconfig /renew" triggers a DHCP Discover/Request cycle; "nslookup" queries the configured DNS server on UDP port 53.',
      verification: 'Verify the PC receives an IP in the 192.168.10.100–150 range and resolves intranet.netlab.edu to 192.168.10.10.',
    },
    commonMistakes: [
      'Enabling DHCP on a client when no DHCP server exists in the VLAN or when a trunk/access port blocks broadcast frames.',
      'Testing a domain name in the Web Browser when the PC’s DNS Server field is blank.',
    ],
    quiz: [
      {
        question: 'Which transport protocol and port numbers are used by DHCP clients and servers?',
        options: ['TCP Ports 80 and 443', 'UDP Ports 67 (Server) and 68 (Client)', 'UDP Port 53', 'ICMP Type 8'],
        correctIndex: 1,
        explanation: 'DHCP clients transmit from UDP port 68 to DHCP servers listening on UDP port 67.',
      },
    ],
  },
  {
    id: 'les-ospf-acls-security',
    title: '8. Dynamic Routing (OSPF) & Access-Control Lists (ACLs)',
    pathCategory: 'OSPF, ACLs & NAT',
    level: 'Advanced',
    durationMinutes: 20,
    prerequisites: ['5. Routers, Routing Tables & Static Routing'],
    objectives: [
      'Configure single-area OSPF ("router ospf 1") using wildcard masks',
      'Create Standard and Extended IPv4 Access-Control Lists to filter traffic',
      'Understand the Implicit Deny rule at the end of every Cisco ACL',
    ],
    explanation: [
      'Open Shortest Path First (OSPF) is a link-state dynamic routing protocol (Administrative Distance 110) that automatically exchanges topology Link-State Advertisements (LSAs) with neighboring routers and runs Dijkstra’s Shortest Path First (SPF) algorithm to populate the routing table.',
      'Access-Control Lists (ACLs) act as stateless packet filters on router interfaces. Rules are evaluated sequentially from top to bottom—the first rule that matches a packet’s protocol, source IP, and destination IP determines whether the packet is permitted or denied.',
      'Every Cisco IOS ACL ends with an invisible "deny ip any any" (Implicit Deny). If you create an ACL with only "deny" statements and no "permit" statement, all traffic on that interface will be dropped!',
    ],
    keyTerminology: [
      {
        term: 'Wildcard Mask',
        definition: 'Inverted subnet mask used by OSPF and ACLs where 0 bits must match and 1 bits are "don’t care" (e.g., 0.0.0.255 matches a /24).',
      },
      {
        term: 'Implicit Deny',
        definition: 'Unwritten rule at the bottom of every ACL that drops any packet not matched by an earlier permit statement.',
      },
    ],
    practicalExample: {
      title: 'Enabling OSPF Area 0 and Inspecting ACLs',
      scenario: 'Advertise 192.168.10.0/24 and 10.0.0.0/30 in OSPF Process 1 Area 0.',
      commands: [
        'enable',
        'configure terminal',
        'router ospf 1',
        'network 192.168.10.0 0.0.0.255 area 0',
        'network 10.0.0.0 0.0.0.3 area 0',
        'end',
        'show ip route',
      ],
      whyUsed: 'Enables dynamic route exchange with neighboring OSPF routers in backbone Area 0.',
      verification: 'Verify remote routes appear with the "O" code and Administrative Distance [110/10] in "show ip route".',
    },
    commonMistakes: [
      'Applying an ACL with a single "deny" line and forgetting "access-list 101 permit ip any any", inadvertently blocking all network traffic.',
    ],
    quiz: [
      {
        question: 'What happens to a packet if it does not match any configured statement in an active Cisco IOS Access-Control List?',
        options: [
          'It is permitted by default',
          'It is dropped by the Implicit Deny at the end of the ACL',
          'It is flooded out all switchports',
          'It triggers an OSPF recalculation',
        ],
        correctIndex: 1,
        explanation:
          'Every Cisco ACL has an unseen "deny ip any any" at the end. You must include at least one permit statement for valid traffic to pass.',
      },
    ],
    relatedLabId: 'lab-5-broken-network-fix',
  },
];

export interface CommandReferenceEntry {
  command: string;
  syntax: string;
  mode: string;
  deviceTypes: string;
  description: string;
  example: string;
  relatedLessonId: string;
}

export const COMMAND_REFERENCE: CommandReferenceEntry[] = [
  {
    command: 'enable',
    syntax: 'enable',
    mode: 'User EXEC (>)',
    deviceTypes: 'Router, L2 Switch, L3 Switch, Firewall',
    description: 'Elevates the CLI session from User EXEC mode (>) to Privileged EXEC mode (#) for viewing full configurations and entering config mode.',
    example: 'R1> enable\nR1#',
    relatedLessonId: 'les-osi-tcpip',
  },
  {
    command: 'configure terminal',
    syntax: 'configure terminal',
    mode: 'Privileged EXEC (#)',
    deviceTypes: 'Router, L2 Switch, L3 Switch, Firewall',
    description: 'Enters Global Configuration mode (config)# to modify device-wide settings, interfaces, VLANs, and routing.',
    example: 'R1# configure terminal\nR1(config)#',
    relatedLessonId: 'les-osi-tcpip',
  },
  {
    command: 'hostname',
    syntax: 'hostname <name>',
    mode: 'Global Config (config)#',
    deviceTypes: 'Router, Switch, Firewall',
    description: 'Sets the administrative hostname displayed in the CLI prompt and system configuration.',
    example: 'R1(config)# hostname Branch-RTR\nBranch-RTR(config)#',
    relatedLessonId: 'les-osi-tcpip',
  },
  {
    command: 'interface',
    syntax: 'interface <type/number>',
    mode: 'Global Config (config)#',
    deviceTypes: 'Router, Switch, Firewall',
    description: 'Enters Interface Configuration mode (config-if)# for a specific physical port or VLAN SVI.',
    example: 'R1(config)# interface GigabitEthernet0/0\nR1(config-if)#',
    relatedLessonId: 'les-ipv4-subnetting',
  },
  {
    command: 'ip address',
    syntax: 'ip address <ipv4-address> <subnet-mask>',
    mode: 'Interface Config (config-if)#',
    deviceTypes: 'Router, L3 Switch, Firewall',
    description: 'Assigns an IPv4 address and subnet mask to a Layer 3 routed interface or VLAN SVI.',
    example: 'R1(config-if)# ip address 192.168.10.1 255.255.255.0',
    relatedLessonId: 'les-ipv4-subnetting',
  },
  {
    command: 'no shutdown / shutdown',
    syntax: 'no shutdown | shutdown',
    mode: 'Interface Config (config-if)#',
    deviceTypes: 'Router, Switch, Firewall',
    description: 'Enables ("no shutdown") or administratively disables ("shutdown") a physical or virtual interface.',
    example: 'R1(config-if)# no shutdown',
    relatedLessonId: 'les-osi-tcpip',
  },
  {
    command: 'ip route',
    syntax: 'ip route <prefix> <mask> <next-hop-ip>',
    mode: 'Global Config (config)#',
    deviceTypes: 'Router, L3 Switch, Firewall',
    description: 'Adds a static route in the IPv4 routing table pointing to a next-hop IP address.',
    example: 'R1(config)# ip route 192.168.20.0 255.255.255.0 10.0.0.2',
    relatedLessonId: 'les-static-routing',
  },
  {
    command: 'switchport mode',
    syntax: 'switchport mode <access | trunk>',
    mode: 'Interface Config (config-if)#',
    deviceTypes: 'L2 Switch, L3 Switch',
    description: 'Configures a switchport as an untagged single-VLAN access port or an 802.1Q multi-VLAN trunk port.',
    example: 'SW1(config-if)# switchport mode trunk',
    relatedLessonId: 'les-vlans-trunking',
  },
  {
    command: 'switchport access vlan',
    syntax: 'switchport access vlan <vlan-id>',
    mode: 'Interface Config (config-if)#',
    deviceTypes: 'L2 Switch, L3 Switch',
    description: 'Assigns an access switchport to a specific VLAN ID (1–4094), creating the VLAN if it does not yet exist.',
    example: 'SW1(config-if)# switchport access vlan 10',
    relatedLessonId: 'les-vlans-trunking',
  },
  {
    command: 'show ip interface brief',
    syntax: 'show ip interface brief',
    mode: 'EXEC (> or #)',
    deviceTypes: 'Router, Switch, Firewall',
    description: 'Displays a concise table of all interfaces, their IPv4 addresses, Layer 1 Status, and Layer 2 Protocol state.',
    example: 'R1# show ip interface brief',
    relatedLessonId: 'les-osi-tcpip',
  },
  {
    command: 'show ip route',
    syntax: 'show ip route',
    mode: 'EXEC (> or #)',
    deviceTypes: 'Router, L3 Switch, Firewall',
    description: 'Displays all active Connected (C), Static (S), Default (S*), OSPF (O), and RIP (R) routes in the routing table.',
    example: 'R1# show ip route',
    relatedLessonId: 'les-static-routing',
  },
  {
    command: 'show vlan brief',
    syntax: 'show vlan brief',
    mode: 'EXEC (> or #)',
    deviceTypes: 'L2 Switch, L3 Switch',
    description: 'Lists all configured VLANs in the switch database along with their status and assigned access ports.',
    example: 'SW1# show vlan brief',
    relatedLessonId: 'les-vlans-trunking',
  },
  {
    command: 'show mac address-table',
    syntax: 'show mac address-table',
    mode: 'EXEC (> or #)',
    deviceTypes: 'L2 Switch, L3 Switch',
    description: 'Displays the Layer 2 CAM forwarding table mapping learned MAC addresses to VLANs and physical ports.',
    example: 'SW1# show mac address-table',
    relatedLessonId: 'les-ethernet-switching',
  },
  {
    command: 'ipconfig',
    syntax: 'ipconfig [/all | /renew]',
    mode: 'PC Command Prompt',
    deviceTypes: 'PC, Laptop, Server, Printer',
    description: 'Displays IPv4/IPv6 addressing, MAC address, DNS server, or renews a dynamic DHCP lease.',
    example: 'C:\\Users\\PC1> ipconfig /all',
    relatedLessonId: 'les-dhcp-dns-services',
  },
  {
    command: 'ping',
    syntax: 'ping <ip-address | hostname>',
    mode: 'PC Command Prompt & IOS EXEC',
    deviceTypes: 'All Devices',
    description: 'Transmits ICMP Echo Requests to test end-to-end Layer 3 reachability and measure round-trip time.',
    example: 'C:\\Users\\PC1> ping 192.168.1.20',
    relatedLessonId: 'les-arp-icmp',
  },
];
