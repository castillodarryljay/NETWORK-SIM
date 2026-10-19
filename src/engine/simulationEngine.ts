import {
  AclRule,
  DiagnosticIssue,
  NetworkDevice,
  NetworkInterface,
  NetworkLink,
  PacketStepEvent,
  ProtocolType,
  RouteEntry,
  SimulationSession,
} from '../types/network';
import {
  createDefaultFileSystem,
  getNetworkAddress,
  ipMatchesSubnet,
  ipToLong,
  isSameSubnet,
  isValidIpv4,
  isValidSubnetMask,
  longToIp,
  maskToCidr,
} from '../utils/networkMath';

/**
 * Synchronizes link operational statuses, line protocols, and connected/dynamic routing tables
 * across all devices in the topology.
 */
export function synchronizeNetworkState(
  devices: NetworkDevice[],
  links: NetworkLink[]
): { devices: NetworkDevice[]; links: NetworkLink[] } {
  const deviceMap = new Map<string, NetworkDevice>();
  const clonedDevices: NetworkDevice[] = devices.map((d) => ({
    ...d,
    interfaces: d.interfaces.map((i) => ({ ...i, lineProtocolUp: false, connectedLinkId: undefined })),
    routingTable: d.routingTable.filter((r) => r.type === 'S' || r.type === 'S*'),
  }));

  for (const dev of clonedDevices) {
    if (
      (dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server') &&
      !dev.fileSystem
    ) {
      dev.fileSystem = createDefaultFileSystem(dev.name, dev.type);
    }
  }

  clonedDevices.forEach((d) => deviceMap.set(d.id, d));

  const updatedLinks: NetworkLink[] = links.map((link) => {
    const srcDev = deviceMap.get(link.sourceDeviceId);
    const dstDev = deviceMap.get(link.targetDeviceId);
    const srcIf = srcDev?.interfaces.find((i) => i.id === link.sourceInterfaceId);
    const dstIf = dstDev?.interfaces.find((i) => i.id === link.targetInterfaceId);

    if (!srcDev || !dstDev || !srcIf || !dstIf) {
      return { ...link, status: 'down' };
    }

    srcIf.connectedLinkId = link.id;
    dstIf.connectedLinkId = link.id;

    const bothUp = srcIf.adminUp && dstIf.adminUp;
    srcIf.lineProtocolUp = bothUp;
    dstIf.lineProtocolUp = bothUp;

    return {
      ...link,
      status: bothUp ? 'up' : 'down',
    };
  });

  // Also ensure L3 Switch Virtual Interfaces (SVIs like Vlan10, Vlan20) are lineProtocolUp if adminUp and at least one switchport is up
  for (const dev of clonedDevices) {
    if (dev.type === 'l3-switch') {
      const anyPortUp = dev.interfaces.some(
        (i) => !i.name.toLowerCase().startsWith('vlan') && i.adminUp && i.lineProtocolUp
      );
      for (const intf of dev.interfaces) {
        if (intf.name.toLowerCase().startsWith('vlan') && intf.adminUp) {
          intf.lineProtocolUp = anyPortUp;
        }
      }
    }
  }

  // Rebuild Connected routes (C) for all L3 devices
  for (const dev of clonedDevices) {
    if (dev.ipRoutingEnabled || dev.type === 'router' || dev.type === 'l3-switch' || dev.type === 'firewall' || dev.type === 'wan-cloud' || dev.type === 'wireless-router') {
      for (const intf of dev.interfaces) {
        if (intf.adminUp && intf.lineProtocolUp && isValidIpv4(intf.ipAddress) && isValidSubnetMask(intf.subnetMask)) {
          const netAddr = getNetworkAddress(intf.ipAddress, intf.subnetMask);
          if (netAddr) {
            dev.routingTable.unshift({
              id: `conn-${dev.id}-${intf.id}`,
              type: 'C',
              network: netAddr,
              mask: intf.subnetMask,
              nextHop: 'Directly connected',
              interfaceName: intf.shortName,
              administrativeDistance: 0,
              metric: 0,
            });
          }
        }
      }
    }
  }

  // Dynamic Routing Propagation (OSPF & RIP) across active L3 devices
  const ospfRouters = clonedDevices.filter((d) => d.ospfEnabled && d.ipRoutingEnabled);
  if (ospfRouters.length > 1) {
    for (const rDst of ospfRouters) {
      for (const rSrc of ospfRouters) {
        if (rDst.id === rSrc.id) continue;
        const srcConnRoutes = rSrc.routingTable.filter((r) => r.type === 'C');
        for (const cRoute of srcConnRoutes) {
          // If ospfNetworks are configured on rSrc, verify cRoute matches at least one network statement
          if (rSrc.ospfNetworks && rSrc.ospfNetworks.length > 0) {
            const matchesOspfNet = rSrc.ospfNetworks.some((n) =>
              wildcardMatches(cRoute.network, n.network, n.wildcard)
            );
            if (!matchesOspfNet) continue;
          }
          const alreadyHas = rDst.routingTable.some(
            (r) => r.network === cRoute.network && r.mask === cRoute.mask
          );
          if (!alreadyHas) {
            const hopInfo = findNextHopTowardDevice(rDst, rSrc, clonedDevices, updatedLinks);
            if (hopInfo) {
              rDst.routingTable.push({
                id: `ospf-${rDst.id}-${cRoute.network}`,
                type: 'O',
                network: cRoute.network,
                mask: cRoute.mask,
                nextHop: hopInfo.nextHopIp,
                interfaceName: hopInfo.outInterfaceShortName,
                administrativeDistance: 110,
                metric: hopInfo.hops * 10,
              });
            }
          }
        }
      }
    }
  }

  const ripRouters = clonedDevices.filter((d) => d.ripEnabled && d.ipRoutingEnabled);
  if (ripRouters.length > 1) {
    for (const rDst of ripRouters) {
      for (const rSrc of ripRouters) {
        if (rDst.id === rSrc.id) continue;
        const srcConnRoutes = rSrc.routingTable.filter((r) => r.type === 'C');
        for (const cRoute of srcConnRoutes) {
          const alreadyHas = rDst.routingTable.some(
            (r) => r.network === cRoute.network && r.mask === cRoute.mask
          );
          if (!alreadyHas) {
            const hopInfo = findNextHopTowardDevice(rDst, rSrc, clonedDevices, updatedLinks);
            if (hopInfo && hopInfo.hops < 16) {
              rDst.routingTable.push({
                id: `rip-${rDst.id}-${cRoute.network}`,
                type: 'R',
                network: cRoute.network,
                mask: cRoute.mask,
                nextHop: hopInfo.nextHopIp,
                interfaceName: hopInfo.outInterfaceShortName,
                administrativeDistance: 120,
                metric: hopInfo.hops,
              });
            }
          }
        }
      }
    }
  }

  return { devices: clonedDevices, links: updatedLinks };
}

function findNextHopTowardDevice(
  startRouter: NetworkDevice,
  targetRouter: NetworkDevice,
  devices: NetworkDevice[],
  links: NetworkLink[]
): { nextHopIp: string; outInterfaceShortName: string; hops: number } | null {
  // BFS across L3 links
  const queue: {
    device: NetworkDevice;
    firstOutIntf?: string;
    firstNextHopIp?: string;
    hops: number;
  }[] = [{ device: startRouter, hops: 0 }];
  const visited = new Set<string>([startRouter.id]);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.device.id === targetRouter.id && curr.firstOutIntf && curr.firstNextHopIp) {
      return {
        nextHopIp: curr.firstNextHopIp,
        outInterfaceShortName: curr.firstOutIntf,
        hops: curr.hops,
      };
    }

    for (const intf of curr.device.interfaces) {
      if (!intf.adminUp || !intf.lineProtocolUp || !intf.connectedLinkId) continue;
      const link = links.find((l) => l.id === intf.connectedLinkId);
      if (!link || link.status !== 'up') continue;

      const peerDevId = link.sourceDeviceId === curr.device.id ? link.targetDeviceId : link.sourceDeviceId;
      const peerIfId = link.sourceDeviceId === curr.device.id ? link.targetInterfaceId : link.sourceInterfaceId;
      if (visited.has(peerDevId)) continue;

      const peerDev = devices.find((d) => d.id === peerDevId);
      const peerIf = peerDev?.interfaces.find((i) => i.id === peerIfId);
      if (!peerDev || !peerIf) continue;

      visited.add(peerDevId);
      const nextHopIp = curr.firstNextHopIp || peerIf.ipAddress;
      const outIntf = curr.firstOutIntf || intf.shortName;
      if (nextHopIp) {
        queue.push({
          device: peerDev,
          firstOutIntf: outIntf,
          firstNextHopIp: nextHopIp,
          hops: curr.hops + 1,
        });
      }
    }
  }
  return null;
}

/**
 * Longest-prefix match lookup on a device's routing table.
 */
export function lookupRoute(device: NetworkDevice, dstIp: string): RouteEntry | null {
  const candidates = device.routingTable.filter((route) => {
    if (route.network === '0.0.0.0' && route.mask === '0.0.0.0') return true;
    return ipMatchesSubnet(dstIp, route.network, route.mask);
  });

  if (candidates.length === 0) return null;

  // Sort by longest prefix (highest CIDR) first, then lowest Administrative Distance
  candidates.sort((a, b) => {
    const cidrA = a.network === '0.0.0.0' ? 0 : maskToCidr(a.mask);
    const cidrB = b.network === '0.0.0.0' ? 0 : maskToCidr(b.mask);
    if (cidrB !== cidrA) return cidrB - cidrA;
    return a.administrativeDistance - b.administrativeDistance;
  });

  return candidates[0];
}

/**
 * Evaluates ACL rules on a router or firewall interface.
 */
export function checkAclRules(
  acls: AclRule[],
  aclNumber: number | undefined,
  protocol: ProtocolType,
  srcIp: string,
  dstIp: string,
  dstPort?: number
): { permitted: boolean; matchedRule?: AclRule } {
  if (!aclNumber) return { permitted: true };
  const rules = acls.filter((r) => r.aclNumber === aclNumber);
  if (rules.length === 0) return { permitted: true };

  for (const rule of rules) {
    const protoMatch =
      rule.protocol === 'ip' ||
      (rule.protocol === 'icmp' && protocol === 'ICMP') ||
      (rule.protocol === 'tcp' && (protocol === 'HTTP' || protocol === 'SMB' || protocol === 'FTP')) ||
      (rule.protocol === 'udp' && (protocol === 'DNS' || protocol === 'DHCP'));

    if (!protoMatch) continue;

    const srcMatch = wildcardMatches(srcIp, rule.sourceIp, rule.sourceWildcard);
    const dstMatch = wildcardMatches(dstIp, rule.destIp, rule.destWildcard);
    const portMatch = !rule.dstPort || rule.dstPort === dstPort;

    if (srcMatch && dstMatch && portMatch) {
      return { permitted: rule.action === 'permit', matchedRule: rule };
    }
  }

  // Implicit deny all at the end of an ACL
  return { permitted: false };
}

function wildcardMatches(ip: string, ruleIp: string, wildcard: string): boolean {
  if (ruleIp.toLowerCase() === 'any' || ruleIp === '0.0.0.0') return true;
  const ipL = ipToLong(ip);
  const rIpL = ipToLong(ruleIp);
  const wcL = ipToLong(wildcard || '0.0.0.0') ?? 0;
  if (ipL === null || rIpL === null) return false;
  const mask = ~wcL >>> 0;
  return ((ipL & mask) >>> 0) === ((rIpL & mask) >>> 0);
}

/**
 * Finds Layer 2 path across switches/wireless APs from an outgoing interface to an IP on the same broadcast domain/VLAN.
 */
interface L2ReachabilityResult {
  reachable: boolean;
  targetDevice?: NetworkDevice;
  targetInterface?: NetworkInterface;
  steps: {
    fromDevice: NetworkDevice;
    fromInterface: NetworkInterface;
    toDevice: NetworkDevice;
    toInterface: NetworkInterface;
    link: NetworkLink;
    vlanId: number;
    actionDescription: string;
  }[];
  dropReason?: string;
  dropDevice?: NetworkDevice;
  dropInterface?: NetworkInterface;
}

export function traceLayer2PathToIp(
  startDevice: NetworkDevice,
  startInterface: NetworkInterface,
  targetNextHopIp: string,
  devices: NetworkDevice[],
  links: NetworkLink[],
  initialVlan: number
): L2ReachabilityResult {
  const visitedInterfaces = new Set<string>([startInterface.id]);

  interface QueueNode {
    currDev: NetworkDevice;
    currOutIf: NetworkInterface;
    vlan: number;
    steps: L2ReachabilityResult['steps'];
  }

  const queue: QueueNode[] = [
    {
      currDev: startDevice,
      currOutIf: startInterface,
      vlan: initialVlan,
      steps: [],
    },
  ];

  let lastDropReason: string | undefined;
  let lastDropDevice: NetworkDevice | undefined;
  let lastDropInterface: NetworkInterface | undefined;

  while (queue.length > 0) {
    const node = queue.shift()!;
    const link = links.find((l) => l.id === node.currOutIf.connectedLinkId);
    if (!link || link.status !== 'up') {
      lastDropReason = `Physical link on ${node.currDev.name} (${node.currOutIf.shortName}) is down or unplugged.`;
      lastDropDevice = node.currDev;
      lastDropInterface = node.currOutIf;
      continue;
    }

    const nextDevId = link.sourceDeviceId === node.currDev.id ? link.targetDeviceId : link.sourceDeviceId;
    const nextIfId = link.sourceDeviceId === node.currDev.id ? link.targetInterfaceId : link.sourceInterfaceId;
    const nextDev = devices.find((d) => d.id === nextDevId);
    const nextIf = nextDev?.interfaces.find((i) => i.id === nextIfId);

    if (!nextDev || !nextIf || !nextIf.adminUp) {
      lastDropReason = `Receiving interface on neighbor device is administratively down (shutdown).`;
      lastDropDevice = nextDev || node.currDev;
      lastDropInterface = nextIf;
      continue;
    }

    if (visitedInterfaces.has(nextIf.id)) continue;
    visitedInterfaces.add(nextIf.id);

    // Determine incoming VLAN handling on nextDev
    let activeVlan = node.vlan;
    if (nextDev.type === 'l2-switch' || (nextDev.type === 'l3-switch' && nextIf.switchportMode !== 'routed')) {
      if (nextIf.switchportMode === 'access') {
        // If frame came from another switch access port with a different VLAN, warn/adjust
        activeVlan = nextIf.accessVlan;
      } else if (nextIf.switchportMode === 'trunk') {
        if (!nextIf.trunkAllowedVlans.includes(activeVlan)) {
          lastDropReason = `802.1Q Trunk on ${nextDev.name} (${nextIf.shortName}) blocks VLAN ${activeVlan} (Allowed VLANs: ${nextIf.trunkAllowedVlans.join(', ')}).`;
          lastDropDevice = nextDev;
          lastDropInterface = nextIf;
          continue;
        }
      }
    }

    const stepItem = {
      fromDevice: node.currDev,
      fromInterface: node.currOutIf,
      toDevice: nextDev,
      toInterface: nextIf,
      link,
      vlanId: activeVlan,
      actionDescription:
        nextDev.type === 'l2-switch'
          ? `Switch ${nextDev.name} receives frame on ${nextIf.shortName} (VLAN ${activeVlan}) and learns source MAC.`
          : `${nextDev.name} receives frame on ${nextIf.shortName}.`,
    };

    const currentSteps = [...node.steps, stepItem];

    // Check if nextDev has the targetNextHopIp on nextIf or on an SVI for activeVlan
    if (nextIf.ipAddress === targetNextHopIp) {
      // Also verify VLAN compatibility if coming from a switch access port
      if (
        (node.currDev.type === 'l2-switch' || node.currDev.type === 'l3-switch') &&
        node.currOutIf.switchportMode === 'access' &&
        node.currOutIf.accessVlan !== activeVlan
      ) {
        lastDropReason = `VLAN mismatch on ${node.currDev.name} (${node.currOutIf.shortName}): Frame in VLAN ${activeVlan} cannot exit access port in VLAN ${node.currOutIf.accessVlan}.`;
        lastDropDevice = node.currDev;
        lastDropInterface = node.currOutIf;
        continue;
      }

      return {
        reachable: true,
        targetDevice: nextDev,
        targetInterface: nextIf,
        steps: currentSteps,
      };
    }

    // Check if nextDev is an L3 switch with an SVI (e.g., Vlan10) matching activeVlan and targetNextHopIp
    if (nextDev.type === 'l3-switch') {
      const svi = nextDev.interfaces.find(
        (i) => i.adminUp && i.accessVlan === activeVlan && i.ipAddress === targetNextHopIp
      );
      if (svi) {
        return {
          reachable: true,
          targetDevice: nextDev,
          targetInterface: svi,
          steps: currentSteps,
        };
      }
    }

    // If nextDev is a switch or wireless AP, flood/forward out other compatible ports in same VLAN
    if (nextDev.type === 'l2-switch' || nextDev.type === 'l3-switch' || nextDev.type === 'wireless-ap') {
      for (const outPort of nextDev.interfaces) {
        if (outPort.id === nextIf.id) continue;
        if (!outPort.adminUp || !outPort.lineProtocolUp || !outPort.connectedLinkId) continue;
        if (outPort.stpState === 'blocking') continue;

        if (nextDev.type === 'wireless-ap') {
          queue.push({
            currDev: nextDev,
            currOutIf: outPort,
            vlan: activeVlan,
            steps: currentSteps,
          });
        } else if (outPort.switchportMode === 'access') {
          if (outPort.accessVlan === activeVlan) {
            queue.push({
              currDev: nextDev,
              currOutIf: outPort,
              vlan: activeVlan,
              steps: currentSteps,
            });
          } else {
            lastDropReason = `VLAN isolation on ${nextDev.name}: Ingress port ${nextIf.shortName} is in VLAN ${activeVlan}, while egress port ${outPort.shortName} is in VLAN ${outPort.accessVlan}.`;
            lastDropDevice = nextDev;
            lastDropInterface = outPort;
          }
        } else if (outPort.switchportMode === 'trunk') {
          if (outPort.trunkAllowedVlans.includes(activeVlan)) {
            queue.push({
              currDev: nextDev,
              currOutIf: outPort,
              vlan: activeVlan,
              steps: currentSteps,
            });
          } else {
            lastDropReason = `Trunk port ${outPort.shortName} on ${nextDev.name} does not permit VLAN ${activeVlan}.`;
            lastDropDevice = nextDev;
            lastDropInterface = outPort;
          }
        }
      }
    }
  }

  return {
    reachable: false,
    steps: [],
    dropReason:
      lastDropReason ||
      `ARP resolution failed for ${targetNextHopIp}: No active host or gateway responded on VLAN ${initialVlan}.`,
    dropDevice: lastDropDevice || startDevice,
    dropInterface: lastDropInterface || startInterface,
  };
}

/**
 * Executes a full discrete-event packet simulation (ICMP Ping, HTTP Request, or DNS Query)
 * between a source device and a destination IP or hostname, updating ARP and MAC tables.
 */
export function runPacketSimulation(
  sourceDeviceId: string,
  destinationInput: string,
  protocol: ProtocolType,
  rawDevices: NetworkDevice[],
  rawLinks: NetworkLink[]
): {
  session: SimulationSession;
  updatedDevices: NetworkDevice[];
} {
  const { devices, links } = synchronizeNetworkState(rawDevices, rawLinks);
  const events: PacketStepEvent[] = [];
  let stepCounter = 1;

  const srcDevice = devices.find((d) => d.id === sourceDeviceId);
  if (!srcDevice) {
    return {
      session: {
        id: `sim-${Date.now()}`,
        title: `${protocol} from Unknown Device`,
        sourceDeviceId,
        targetIp: destinationInput,
        protocol,
        events: [],
        overallSuccess: false,
        summaryMessage: 'Source device not found in topology.',
      },
      updatedDevices: devices,
    };
  }

  // Pick primary active interface with an IP on source device
  const srcIntf =
    srcDevice.interfaces.find((i) => i.adminUp && i.lineProtocolUp && isValidIpv4(i.ipAddress)) ||
    srcDevice.interfaces.find((i) => isValidIpv4(i.ipAddress)) ||
    srcDevice.interfaces[0];

  if (!srcIntf || !isValidIpv4(srcIntf.ipAddress) || !isValidSubnetMask(srcIntf.subnetMask)) {
    events.push({
      id: `evt-${Date.now()}-${stepCounter}`,
      stepIndex: stepCounter++,
      timestamp: Date.now(),
      fromDeviceId: srcDevice.id,
      fromDeviceName: srcDevice.name,
      fromInterface: srcIntf?.shortName || 'None',
      protocol,
      srcMac: srcIntf?.macAddress || '00:00:00:00:00:00',
      dstMac: '00:00:00:00:00:00',
      srcIp: srcIntf?.ipAddress || 'Unassigned',
      dstIp: destinationInput,
      ttl: 64,
      action: 'drop',
      summary: `${srcDevice.name} cannot transmit packet: IPv4 address or subnet mask is not configured.`,
      reason: 'Source interface lacks a valid IPv4 address and subnet mask.',
      osiLayers: {
        layer1: srcIntf?.adminUp ? 'Physical Port Active' : 'Interface Administratively Down',
        layer2: `Ethernet II Src MAC: ${srcIntf?.macAddress || 'N/A'}`,
        layer3: 'IPv4 Stack Error: Unconfigured Source IP',
      },
      status: 'error',
    });

    return {
      session: {
        id: `sim-${Date.now()}`,
        title: `${protocol} ${destinationInput}`,
        sourceDeviceId,
        targetIp: destinationInput,
        protocol,
        events,
        overallSuccess: false,
        summaryMessage: `${srcDevice.name} has no valid IPv4 configuration on ${srcIntf?.shortName || 'its interface'}.`,
      },
      updatedDevices: devices,
    };
  }

  if (!srcIntf.adminUp || !srcIntf.lineProtocolUp) {
    events.push({
      id: `evt-${Date.now()}-${stepCounter}`,
      stepIndex: stepCounter++,
      timestamp: Date.now(),
      fromDeviceId: srcDevice.id,
      fromDeviceName: srcDevice.name,
      fromInterface: srcIntf.shortName,
      protocol,
      srcMac: srcIntf.macAddress,
      dstMac: 'FF:FF:FF:FF:FF:FF',
      srcIp: srcIntf.ipAddress,
      dstIp: destinationInput,
      ttl: 64,
      action: 'drop',
      summary: `Packet dropped on ${srcDevice.name} (${srcIntf.shortName}): Interface or physical link is down.`,
      reason: !srcIntf.adminUp
        ? `Interface ${srcIntf.name} is administratively down (shutdown).`
        : `Interface ${srcIntf.name} has no active link to a powered neighbor.`,
      osiLayers: {
        layer1: 'Link Down / No Carrier Signal',
        layer2: `Ethernet II (${srcIntf.macAddress})`,
        layer3: `IPv4 Src: ${srcIntf.ipAddress} -> Dst: ${destinationInput}`,
      },
      status: 'error',
    });

    return {
      session: {
        id: `sim-${Date.now()}`,
        title: `${protocol} ${destinationInput}`,
        sourceDeviceId,
        targetIp: destinationInput,
        protocol,
        events,
        overallSuccess: false,
        summaryMessage: `Interface ${srcIntf.shortName} on ${srcDevice.name} is down.`,
      },
      updatedDevices: devices,
    };
  }

  let resolvedTargetIp = destinationInput.trim();

  // If destinationInput is a hostname (not an IPv4 address), resolve via DNS first!
  if (!isValidIpv4(resolvedTargetIp)) {
    if (!isValidIpv4(srcDevice.dnsServer)) {
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: srcDevice.id,
        fromDeviceName: srcDevice.name,
        fromInterface: srcIntf.shortName,
        protocol: 'DNS',
        srcMac: srcIntf.macAddress,
        dstMac: '00:00:00:00:00:00',
        srcIp: srcIntf.ipAddress,
        dstIp: 'Unconfigured DNS',
        srcPort: 54120,
        dstPort: 53,
        ttl: 64,
        action: 'drop',
        summary: `DNS Resolution failed for "${resolvedTargetIp}": No DNS Server IP configured on ${srcDevice.name}.`,
        reason: 'Host attempted to resolve a domain name without a configured DNS server address.',
        osiLayers: {
          layer1: `${srcIntf.mediaType.toUpperCase()} (${srcIntf.shortName})`,
          layer2: `Ethernet II Src: ${srcIntf.macAddress}`,
          layer3: `IPv4 Src: ${srcIntf.ipAddress}`,
          layer4: 'UDP Src Port: 54120, Dst Port: 53 (DNS)',
          layer7: `DNS Standard Query A "${resolvedTargetIp}"`,
        },
        status: 'error',
      });

      return {
        session: {
          id: `sim-${Date.now()}`,
          title: `DNS Lookup: ${resolvedTargetIp}`,
          sourceDeviceId,
          targetIp: resolvedTargetIp,
          protocol: 'DNS',
          events,
          overallSuccess: false,
          summaryMessage: `DNS resolution failed: ${srcDevice.name} does not have a DNS server configured.`,
        },
        updatedDevices: devices,
      };
    }

    // Find DNS server device
    const dnsServerDevice = devices.find(
      (d) =>
        d.type === 'server' &&
        d.services?.dnsEnabled &&
        d.interfaces.some((i) => i.ipAddress === srcDevice.dnsServer && i.adminUp && i.lineProtocolUp)
    );

    const record = dnsServerDevice?.services?.dnsRecords.find(
      (r) => r.hostname.toLowerCase() === resolvedTargetIp.toLowerCase()
    );

    if (!dnsServerDevice || !record) {
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: srcDevice.id,
        fromDeviceName: srcDevice.name,
        fromInterface: srcIntf.shortName,
        protocol: 'DNS',
        srcMac: srcIntf.macAddress,
        dstMac: 'FF:FF:FF:FF:FF:FF',
        srcIp: srcIntf.ipAddress,
        dstIp: srcDevice.dnsServer,
        srcPort: 54120,
        dstPort: 53,
        ttl: 64,
        action: 'drop',
        summary: !dnsServerDevice
          ? `DNS Server ${srcDevice.dnsServer} is unreachable or DNS service is disabled.`
          : `DNS Server ${dnsServerDevice.name} returned NXDOMAIN for "${resolvedTargetIp}".`,
        reason: !dnsServerDevice
          ? `No active DNS server listening at ${srcDevice.dnsServer}.`
          : `Domain "${resolvedTargetIp}" does not exist in ${dnsServerDevice.name} DNS zone table.`,
        osiLayers: {
          layer1: `${srcIntf.mediaType.toUpperCase()} (${srcIntf.shortName})`,
          layer2: `Ethernet II Src: ${srcIntf.macAddress}`,
          layer3: `IPv4 Src: ${srcIntf.ipAddress} -> Dst: ${srcDevice.dnsServer}`,
          layer4: 'UDP Src Port: 54120 -> Dst Port: 53',
          layer7: `DNS Query A "${resolvedTargetIp}"`,
        },
        status: 'error',
      });

      return {
        session: {
          id: `sim-${Date.now()}`,
          title: `DNS Lookup: ${resolvedTargetIp}`,
          sourceDeviceId,
          targetIp: resolvedTargetIp,
          protocol: 'DNS',
          events,
          overallSuccess: false,
          summaryMessage: !dnsServerDevice
            ? `DNS server ${srcDevice.dnsServer} is unreachable.`
            : `DNS server returned NXDOMAIN for ${resolvedTargetIp}.`,
        },
        updatedDevices: devices,
      };
    }

    events.push({
      id: `evt-${Date.now()}-${stepCounter}`,
      stepIndex: stepCounter++,
      timestamp: Date.now(),
      fromDeviceId: srcDevice.id,
      fromDeviceName: srcDevice.name,
      fromInterface: srcIntf.shortName,
      toDeviceId: dnsServerDevice.id,
      toDeviceName: dnsServerDevice.name,
      protocol: 'DNS',
      srcMac: srcIntf.macAddress,
      dstMac: dnsServerDevice.interfaces[0].macAddress,
      srcIp: srcIntf.ipAddress,
      dstIp: srcDevice.dnsServer,
      srcPort: 54120,
      dstPort: 53,
      ttl: 64,
      action: 'reply',
      summary: `DNS Server ${dnsServerDevice.name} (${srcDevice.dnsServer}) resolved "${resolvedTargetIp}" to ${record.ipAddress}.`,
      reason: `Authoritative A-record match found in ${dnsServerDevice.name} DNS database.`,
      osiLayers: {
        layer1: 'Physical Frame Transmitted',
        layer2: `Ethernet II`,
        layer3: `IPv4 Src: ${srcDevice.dnsServer} -> Dst: ${srcIntf.ipAddress}`,
        layer4: 'UDP Src Port: 53 -> Dst Port: 54120',
        layer7: `DNS Standard Query Response: ${resolvedTargetIp} -> ${record.ipAddress}`,
      },
      status: 'info',
    });

    resolvedTargetIp = record.ipAddress;
  }

  // Ping to self / loopback check
  if (resolvedTargetIp === srcIntf.ipAddress || resolvedTargetIp === '127.0.0.1') {
    events.push({
      id: `evt-${Date.now()}-${stepCounter}`,
      stepIndex: stepCounter++,
      timestamp: Date.now(),
      fromDeviceId: srcDevice.id,
      fromDeviceName: srcDevice.name,
      fromInterface: srcIntf.shortName,
      toDeviceId: srcDevice.id,
      toDeviceName: srcDevice.name,
      toInterface: srcIntf.shortName,
      protocol,
      srcMac: srcIntf.macAddress,
      dstMac: srcIntf.macAddress,
      srcIp: srcIntf.ipAddress,
      dstIp: resolvedTargetIp,
      ttl: 64,
      action: 'reply',
      summary: `${srcDevice.name} replied to local loopback / own interface (${resolvedTargetIp}) in <1ms.`,
      reason: 'Destination IP belongs to the local host.',
      osiLayers: {
        layer1: 'Internal Loopback',
        layer2: `Local MAC ${srcIntf.macAddress}`,
        layer3: `IPv4 Src: ${srcIntf.ipAddress}, Dst: ${resolvedTargetIp}, TTL: 64`,
        layer4: protocol === 'HTTP' ? 'TCP Port 80' : undefined,
        layer7: protocol === 'ICMP' ? 'ICMP Echo Reply (Type 0, Code 0)' : 'Local Service Response',
      },
      status: 'success',
    });

    return {
      session: {
        id: `sim-${Date.now()}`,
        title: `${protocol} ${destinationInput}`,
        sourceDeviceId,
        targetIp: resolvedTargetIp,
        protocol,
        events,
        overallSuccess: true,
        summaryMessage: `Success: Local interface ${resolvedTargetIp} responded immediately (<1ms).`,
        rttMs: 1,
      },
      updatedDevices: devices,
    };
  }

  // Forward Path L3 Hop-by-Hop Loop
  let currL3Device = srcDevice;
  let currSrcIp = srcIntf.ipAddress;
  let ttl = 64;
  const maxHops = 15;
  let hopCount = 0;
  let reachedDestinationDevice: NetworkDevice | null = null;
  let reachedDestinationInterface: NetworkInterface | null = null;
  const allTraversedL2Steps: L2ReachabilityResult['steps'] = [];

  while (hopCount < maxHops && ttl > 0) {
    hopCount++;
    let outIntf: NetworkInterface | undefined;
    let nextHopIp = resolvedTargetIp;
    let forwardingNote = '';

    // Determine next-hop IP and egress interface on currL3Device
    if (
      currL3Device.ipRoutingEnabled ||
      currL3Device.type === 'router' ||
      currL3Device.type === 'l3-switch' ||
      currL3Device.type === 'firewall' ||
      currL3Device.type === 'wan-cloud'
    ) {
      const route = lookupRoute(currL3Device, resolvedTargetIp);
      if (!route) {
        events.push({
          id: `evt-${Date.now()}-${stepCounter}`,
          stepIndex: stepCounter++,
          timestamp: Date.now(),
          fromDeviceId: currL3Device.id,
          fromDeviceName: currL3Device.name,
          fromInterface: 'Routing Engine',
          protocol,
          srcMac: '00:00:00:00:00:00',
          dstMac: '00:00:00:00:00:00',
          srcIp: currSrcIp,
          dstIp: resolvedTargetIp,
          ttl,
          action: 'drop',
          summary: `${currL3Device.name} dropped packet to ${resolvedTargetIp}: No matching route in routing table.`,
          reason: `Router ${currL3Device.name} searched its routing table for ${resolvedTargetIp} and found neither a matching network route nor a default gateway route (0.0.0.0/0).`,
          osiLayers: {
            layer1: 'N/A (Dropped at Layer 3)',
            layer2: 'Frame header stripped for Layer 3 lookup',
            layer3: `IPv4 Dst: ${resolvedTargetIp} — ICMP Destination Unreachable (Host/Network Unreachable)`,
          },
          status: 'error',
        });

        return {
          session: {
            id: `sim-${Date.now()}`,
            title: `${protocol} ${destinationInput}`,
            sourceDeviceId,
            targetIp: resolvedTargetIp,
            protocol,
            events,
            overallSuccess: false,
            summaryMessage: `Destination net unreachable from ${currL3Device.name}: Missing route to ${resolvedTargetIp}.`,
          },
          updatedDevices: devices,
        };
      }

      nextHopIp = route.nextHop === 'Directly connected' ? resolvedTargetIp : route.nextHop;
      outIntf = currL3Device.interfaces.find(
        (i) => i.shortName === route.interfaceName || i.name === route.interfaceName
      );

      if (!outIntf && route.nextHop !== 'Directly connected') {
        // Resolve egress interface by matching nextHopIp against connected routes
        outIntf = currL3Device.interfaces.find(
          (i) =>
            i.adminUp &&
            i.lineProtocolUp &&
            isValidIpv4(i.ipAddress) &&
            isSameSubnet(i.ipAddress, route.nextHop, i.subnetMask)
        );
      }

      forwardingNote =
        route.type === 'C'
          ? `Matched directly connected route ${route.network}/${maskToCidr(route.mask)} out ${outIntf?.shortName || route.interfaceName}.`
          : `Matched [${route.type}] route ${route.network}/${maskToCidr(route.mask)} via next-hop ${route.nextHop} (${outIntf?.shortName || route.interfaceName}).`;
    } else {
      // End device (PC, Laptop, Server, Printer)
      outIntf = srcIntf;
      if (isSameSubnet(outIntf.ipAddress, resolvedTargetIp, outIntf.subnetMask)) {
        nextHopIp = resolvedTargetIp;
        forwardingNote = `Destination ${resolvedTargetIp} is in the local subnet (${getNetworkAddress(outIntf.ipAddress, outIntf.subnetMask)}/${maskToCidr(outIntf.subnetMask)}); sending directly on LAN.`;
      } else {
        if (!isValidIpv4(currL3Device.defaultGateway)) {
          events.push({
            id: `evt-${Date.now()}-${stepCounter}`,
            stepIndex: stepCounter++,
            timestamp: Date.now(),
            fromDeviceId: currL3Device.id,
            fromDeviceName: currL3Device.name,
            fromInterface: outIntf.shortName,
            protocol,
            srcMac: outIntf.macAddress,
            dstMac: '00:00:00:00:00:00',
            srcIp: currSrcIp,
            dstIp: resolvedTargetIp,
            ttl,
            action: 'drop',
            summary: `${currL3Device.name} dropped packet: Destination ${resolvedTargetIp} is on a remote subnet and no Default Gateway is configured.`,
            reason: `Source IP ${outIntf.ipAddress}/${maskToCidr(outIntf.subnetMask)} is not in the same subnet as ${resolvedTargetIp}, and Default Gateway is blank or invalid.`,
            osiLayers: {
              layer1: `${outIntf.shortName} (Up)`,
              layer2: `Src MAC: ${outIntf.macAddress}`,
              layer3: `IPv4 Routing Failure: Default Gateway Required`,
            },
            status: 'error',
          });

          return {
            session: {
              id: `sim-${Date.now()}`,
              title: `${protocol} ${destinationInput}`,
              sourceDeviceId,
              targetIp: resolvedTargetIp,
              protocol,
              events,
              overallSuccess: false,
              summaryMessage: `${currL3Device.name} cannot reach remote network ${resolvedTargetIp} without a valid Default Gateway.`,
            },
            updatedDevices: devices,
          };
        }

        if (!isSameSubnet(outIntf.ipAddress, currL3Device.defaultGateway, outIntf.subnetMask)) {
          events.push({
            id: `evt-${Date.now()}-${stepCounter}`,
            stepIndex: stepCounter++,
            timestamp: Date.now(),
            fromDeviceId: currL3Device.id,
            fromDeviceName: currL3Device.name,
            fromInterface: outIntf.shortName,
            protocol,
            srcMac: outIntf.macAddress,
            dstMac: '00:00:00:00:00:00',
            srcIp: currSrcIp,
            dstIp: resolvedTargetIp,
            ttl,
            action: 'drop',
            summary: `${currL3Device.name} dropped packet: Default Gateway ${currL3Device.defaultGateway} is unreachable from subnet ${outIntf.ipAddress}/${maskToCidr(outIntf.subnetMask)}.`,
            reason: `Configured Default Gateway (${currL3Device.defaultGateway}) must reside on the same subnet as ${currL3Device.name} (${getNetworkAddress(outIntf.ipAddress, outIntf.subnetMask)}/${maskToCidr(outIntf.subnetMask)}).`,
            osiLayers: {
              layer1: `${outIntf.shortName}`,
              layer2: `Src MAC: ${outIntf.macAddress}`,
              layer3: `Invalid Next-Hop Gateway Address`,
            },
            status: 'error',
          });

          return {
            session: {
              id: `sim-${Date.now()}`,
              title: `${protocol} ${destinationInput}`,
              sourceDeviceId,
              targetIp: resolvedTargetIp,
              protocol,
              events,
              overallSuccess: false,
              summaryMessage: `Default Gateway ${currL3Device.defaultGateway} is not on ${currL3Device.name}'s local subnet.`,
            },
            updatedDevices: devices,
          };
        }

        nextHopIp = currL3Device.defaultGateway;
        forwardingNote = `Destination ${resolvedTargetIp} is remote; encapsulating frame to Default Gateway ${nextHopIp}.`;
      }
    }

    if (!outIntf || !outIntf.adminUp || !outIntf.lineProtocolUp) {
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: currL3Device.id,
        fromDeviceName: currL3Device.name,
        fromInterface: outIntf?.shortName || 'Unassigned',
        protocol,
        srcMac: outIntf?.macAddress || '00:00:00:00:00:00',
        dstMac: '00:00:00:00:00:00',
        srcIp: currSrcIp,
        dstIp: resolvedTargetIp,
        ttl,
        action: 'drop',
        summary: `${currL3Device.name} cannot forward out ${outIntf?.shortName || 'interface'}: Egress interface is down.`,
        reason: 'Egress interface selected by routing table is administratively down or disconnected.',
        osiLayers: {
          layer1: 'Physical Interface Down',
          layer2: 'Frame discarded',
          layer3: `IPv4 Dst: ${resolvedTargetIp}`,
        },
        status: 'error',
      });

      return {
        session: {
          id: `sim-${Date.now()}`,
          title: `${protocol} ${destinationInput}`,
          sourceDeviceId,
          targetIp: resolvedTargetIp,
          protocol,
          events,
          overallSuccess: false,
          summaryMessage: `Egress interface ${outIntf?.shortName || ''} on ${currL3Device.name} is down.`,
        },
        updatedDevices: devices,
      };
    }

    // Check Outbound ACL on outIntf
    const aclOutCheck = checkAclRules(
      currL3Device.acls,
      outIntf.aclOut,
      protocol,
      currSrcIp,
      resolvedTargetIp,
      protocol === 'HTTP' ? 80 : protocol === 'DNS' ? 53 : undefined
    );
    if (!aclOutCheck.permitted) {
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: currL3Device.id,
        fromDeviceName: currL3Device.name,
        fromInterface: outIntf.shortName,
        protocol,
        srcMac: outIntf.macAddress,
        dstMac: '00:00:00:00:00:00',
        srcIp: currSrcIp,
        dstIp: resolvedTargetIp,
        ttl,
        action: 'drop',
        summary: `ACL ${outIntf.aclOut} outbound on ${currL3Device.name} (${outIntf.shortName}) denied ${protocol} packet.`,
        reason: aclOutCheck.matchedRule
          ? `Matched Access-List ${aclOutCheck.matchedRule.aclNumber} rule: deny ${aclOutCheck.matchedRule.protocol} ${aclOutCheck.matchedRule.sourceIp} ${aclOutCheck.matchedRule.destIp}.`
          : `Implicit deny at the end of outbound Access-List ${outIntf.aclOut}.`,
        osiLayers: {
          layer1: `${outIntf.shortName}`,
          layer2: `Ethernet II`,
          layer3: `IPv4 Src: ${currSrcIp} -> Dst: ${resolvedTargetIp} (Filtered by ACL ${outIntf.aclOut})`,
        },
        status: 'error',
      });

      return {
        session: {
          id: `sim-${Date.now()}`,
          title: `${protocol} ${destinationInput}`,
          sourceDeviceId,
          targetIp: resolvedTargetIp,
          protocol,
          events,
          overallSuccess: false,
          summaryMessage: `Packet blocked by outbound ACL ${outIntf.aclOut} on ${currL3Device.name} (${outIntf.shortName}).`,
        },
        updatedDevices: devices,
      };
    }

    // NAT translation check if enabled on router/firewall
    if (currL3Device.natEnabled && outIntf.natDirection === 'outside') {
      const oldSrcIp = currSrcIp;
      currSrcIp = outIntf.ipAddress;
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: currL3Device.id,
        fromDeviceName: currL3Device.name,
        fromInterface: outIntf.shortName,
        protocol,
        srcMac: outIntf.macAddress,
        dstMac: 'FF:FF:FF:FF:FF:FF',
        srcIp: currSrcIp,
        dstIp: resolvedTargetIp,
        ttl,
        action: 'nat-translate',
        summary: `NAT/PAT on ${currL3Device.name} translated inside local IP ${oldSrcIp} to outside global IP ${currSrcIp}.`,
        reason: `Outbound packet exited NAT Outside interface ${outIntf.shortName}.`,
        osiLayers: {
          layer1: `${outIntf.shortName}`,
          layer2: `Src MAC: ${outIntf.macAddress}`,
          layer3: `NAT Inside Local ${oldSrcIp} -> Inside Global ${currSrcIp}`,
        },
        status: 'info',
      });
    }

    // If outIntf is an SVI on an L3 switch (e.g. Vlan10), pick physical switchport in that VLAN to trace
    let traceStartIntf = outIntf;
    const initialVlan = outIntf.accessVlan || 1;
    let l2Path: L2ReachabilityResult | null = null;

    if (currL3Device.type === 'l3-switch' && outIntf.name.toLowerCase().startsWith('vlan')) {
      for (const candidatePort of currL3Device.interfaces) {
        if (
          candidatePort.id !== outIntf.id &&
          candidatePort.adminUp &&
          candidatePort.lineProtocolUp &&
          candidatePort.connectedLinkId &&
          ((candidatePort.switchportMode === 'access' && candidatePort.accessVlan === initialVlan) ||
            (candidatePort.switchportMode === 'trunk' && candidatePort.trunkAllowedVlans.includes(initialVlan)))
        ) {
          const attempt = traceLayer2PathToIp(
            currL3Device,
            candidatePort,
            nextHopIp,
            devices,
            links,
            initialVlan
          );
          if (attempt.reachable) {
            traceStartIntf = candidatePort;
            l2Path = attempt;
            break;
          }
        }
      }
    }

    if (!l2Path) {
      l2Path = traceLayer2PathToIp(
        currL3Device,
        traceStartIntf,
        nextHopIp,
        devices,
        links,
        initialVlan
      );
    }

    // Check ARP cache on currL3Device for nextHopIp (if Ethernet/Wireless)
    const knownArp = currL3Device.arpTable.find((a) => a.ipAddress === nextHopIp);
    if (!knownArp && traceStartIntf.mediaType !== 'serial') {
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: currL3Device.id,
        fromDeviceName: currL3Device.name,
        fromInterface: traceStartIntf.shortName,
        toDeviceId: l2Path.steps[0]?.toDevice.id || l2Path.targetDevice?.id,
        toDeviceName: l2Path.steps[0]?.toDevice.name || l2Path.targetDevice?.name || 'Broadcast Domain',
        linkId: l2Path.steps[0]?.link.id,
        protocol: 'ARP',
        srcMac: outIntf.macAddress,
        dstMac: 'FF:FF:FF:FF:FF:FF',
        srcIp: outIntf.ipAddress,
        dstIp: nextHopIp,
        ttl: 1,
        vlanId: initialVlan,
        action: 'flood',
        summary: `ARP Broadcast from ${currL3Device.name}: "Who has ${nextHopIp}? Tell ${outIntf.ipAddress}"`,
        reason: `${currL3Device.name} does not have an ARP cache entry for next-hop IP ${nextHopIp}; broadcasting ARP Request (FF:FF:FF:FF:FF:FF) on VLAN ${initialVlan}.`,
        osiLayers: {
          layer1: `${traceStartIntf.mediaType.toUpperCase()} (${traceStartIntf.shortName})`,
          layer2: `Ethernet II Src: ${outIntf.macAddress} -> Dst: FF:FF:FF:FF:FF:FF (Broadcast)`,
          layer3: `ARP Request (Opcode 1): Target IP ${nextHopIp}`,
        },
        status: l2Path.reachable ? 'info' : 'error',
      });
    }

    if (!l2Path.reachable || !l2Path.targetDevice || !l2Path.targetInterface) {
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: l2Path.dropDevice?.id || currL3Device.id,
        fromDeviceName: l2Path.dropDevice?.name || currL3Device.name,
        fromInterface: l2Path.dropInterface?.shortName || traceStartIntf.shortName,
        protocol: knownArp ? protocol : 'ARP',
        srcMac: outIntf.macAddress,
        dstMac: knownArp?.macAddress || 'FF:FF:FF:FF:FF:FF',
        srcIp: currSrcIp,
        dstIp: nextHopIp,
        ttl,
        vlanId: initialVlan,
        action: 'drop',
        summary: `Frame failed to reach ${nextHopIp}: ${l2Path.dropReason}`,
        reason: l2Path.dropReason || `No host answered ARP for ${nextHopIp}.`,
        osiLayers: {
          layer1: `${l2Path.dropInterface?.shortName || traceStartIntf.shortName}`,
          layer2: `VLAN ${initialVlan} Frame Drop`,
          layer3: `Target IP: ${nextHopIp}`,
        },
        status: 'error',
      });

      return {
        session: {
          id: `sim-${Date.now()}`,
          title: `${protocol} ${destinationInput}`,
          sourceDeviceId,
          targetIp: resolvedTargetIp,
          protocol,
          events,
          overallSuccess: false,
          summaryMessage: l2Path.dropReason || `Request timed out: Could not resolve ${nextHopIp}.`,
        },
        updatedDevices: devices,
      };
    }

    // Record ARP reply and populate ARP caches on both ends
    if (!knownArp && traceStartIntf.mediaType !== 'serial') {
      currL3Device.arpTable.push({
        ipAddress: nextHopIp,
        macAddress: l2Path.targetInterface.macAddress,
        interfaceName: outIntf.shortName,
        type: 'dynamic',
        timestamp: Date.now(),
      });

      const peerHasArp = l2Path.targetDevice.arpTable.some((a) => a.ipAddress === outIntf.ipAddress);
      if (!peerHasArp) {
        l2Path.targetDevice.arpTable.push({
          ipAddress: outIntf.ipAddress,
          macAddress: outIntf.macAddress,
          interfaceName: l2Path.targetInterface.shortName,
          type: 'dynamic',
          timestamp: Date.now(),
        });
      }

      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: l2Path.targetDevice.id,
        fromDeviceName: l2Path.targetDevice.name,
        fromInterface: l2Path.targetInterface.shortName,
        toDeviceId: l2Path.steps[l2Path.steps.length - 1]?.fromDevice.id || currL3Device.id,
        toDeviceName: l2Path.steps[l2Path.steps.length - 1]?.fromDevice.name || currL3Device.name,
        toInterface: traceStartIntf.shortName,
        linkId: l2Path.steps[l2Path.steps.length - 1]?.link.id,
        protocol: 'ARP',
        srcMac: l2Path.targetInterface.macAddress,
        dstMac: outIntf.macAddress,
        srcIp: nextHopIp,
        dstIp: outIntf.ipAddress,
        ttl: 1,
        vlanId: initialVlan,
        action: 'reply',
        summary: `ARP Reply from ${l2Path.targetDevice.name}: "${nextHopIp} is at ${l2Path.targetInterface.macAddress}"`,
        reason: `${l2Path.targetDevice.name} responded with its MAC address; ${currL3Device.name} updated its ARP table.`,
        osiLayers: {
          layer1: `${l2Path.targetInterface.mediaType.toUpperCase()} (${l2Path.targetInterface.shortName})`,
          layer2: `Ethernet II Unicast Src: ${l2Path.targetInterface.macAddress} -> Dst: ${outIntf.macAddress}`,
          layer3: `ARP Reply (Opcode 2): ${nextHopIp} is at ${l2Path.targetInterface.macAddress}`,
        },
        status: 'info',
      });
    }

    // Record L2 switching steps and update switch MAC tables
    allTraversedL2Steps.push(...l2Path.steps);
    for (const step of l2Path.steps) {
      if (step.toDevice.type === 'l2-switch' || step.toDevice.type === 'l3-switch') {
        const hasMac = step.toDevice.macTable.some(
          (m) => m.macAddress === outIntf.macAddress && m.vlan === step.vlanId
        );
        if (!hasMac) {
          step.toDevice.macTable.push({
            vlan: step.vlanId,
            macAddress: outIntf.macAddress,
            type: 'DYNAMIC',
            interfaceName: step.toInterface.shortName,
          });
        }
      }

      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: step.fromDevice.id,
        fromDeviceName: step.fromDevice.name,
        fromInterface: step.fromInterface.shortName,
        toDeviceId: step.toDevice.id,
        toDeviceName: step.toDevice.name,
        toInterface: step.toInterface.shortName,
        linkId: step.link.id,
        protocol,
        srcMac: outIntf.macAddress,
        dstMac: l2Path.targetInterface.macAddress,
        srcIp: currSrcIp,
        dstIp: resolvedTargetIp,
        srcPort: protocol === 'HTTP' ? 49152 : undefined,
        dstPort: protocol === 'HTTP' ? 80 : undefined,
        ttl,
        vlanId: step.vlanId,
        action: step.toDevice.id === l2Path.targetDevice.id ? 'receive' : 'forward',
        summary:
          step.fromDevice.id === currL3Device.id
            ? `${currL3Device.name} transmitted ${protocol} packet via ${step.fromInterface.shortName} -> ${step.toDevice.name} (${step.toInterface.shortName}).`
            : `Switch ${step.fromDevice.name} forwarded frame out ${step.fromInterface.shortName} (VLAN ${step.vlanId}) to ${step.toDevice.name}.`,
        reason:
          step.fromDevice.id === currL3Device.id
            ? forwardingNote
            : `Layer 2 MAC table lookup on ${step.fromDevice.name} matched destination MAC ${l2Path.targetInterface.macAddress} on VLAN ${step.vlanId}.`,
        osiLayers: {
          layer1: `${step.link.type.toUpperCase()} Link (${step.fromInterface.shortName} <-> ${step.toInterface.shortName})`,
          layer2:
            step.link.type === 'trunk'
              ? `802.1Q Tagged Frame (VLAN ${step.vlanId}) Src: ${outIntf.macAddress} -> Dst: ${l2Path.targetInterface.macAddress}`
              : `Ethernet II Frame Src: ${outIntf.macAddress} -> Dst: ${l2Path.targetInterface.macAddress}`,
          layer3: `IPv4 Src: ${currSrcIp} -> Dst: ${resolvedTargetIp}, TTL: ${ttl}`,
          layer4: protocol === 'HTTP' ? 'TCP Src Port: 49152, Dst Port: 80 (SYN/HTTP GET)' : undefined,
          layer7:
            protocol === 'ICMP'
              ? 'ICMP Echo Request (Type 8, Code 0)'
              : protocol === 'HTTP'
              ? 'HTTP GET /index.html HTTP/1.1'
              : undefined,
        },
        status: 'info',
      });
    }

    // Check Inbound ACL on receiving L3 interface
    const aclInCheck = checkAclRules(
      l2Path.targetDevice.acls,
      l2Path.targetInterface.aclIn,
      protocol,
      currSrcIp,
      resolvedTargetIp,
      protocol === 'HTTP' ? 80 : undefined
    );
    if (!aclInCheck.permitted) {
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: l2Path.targetDevice.id,
        fromDeviceName: l2Path.targetDevice.name,
        fromInterface: l2Path.targetInterface.shortName,
        protocol,
        srcMac: outIntf.macAddress,
        dstMac: l2Path.targetInterface.macAddress,
        srcIp: currSrcIp,
        dstIp: resolvedTargetIp,
        ttl,
        action: 'drop',
        summary: `Inbound ACL ${l2Path.targetInterface.aclIn} on ${l2Path.targetDevice.name} (${l2Path.targetInterface.shortName}) blocked packet.`,
        reason: aclInCheck.matchedRule
          ? `Matched Access-List ${aclInCheck.matchedRule.aclNumber}: deny ${aclInCheck.matchedRule.protocol} ${aclInCheck.matchedRule.sourceIp} ${aclInCheck.matchedRule.destIp}.`
          : `Implicit deny on inbound Access-List ${l2Path.targetInterface.aclIn}.`,
        osiLayers: {
          layer1: `${l2Path.targetInterface.shortName}`,
          layer2: `Ethernet II`,
          layer3: `IPv4 Filtered by Inbound ACL ${l2Path.targetInterface.aclIn}`,
        },
        status: 'error',
      });

      return {
        session: {
          id: `sim-${Date.now()}`,
          title: `${protocol} ${destinationInput}`,
          sourceDeviceId,
          targetIp: resolvedTargetIp,
          protocol,
          events,
          overallSuccess: false,
          summaryMessage: `Packet blocked by inbound ACL ${l2Path.targetInterface.aclIn} on ${l2Path.targetDevice.name}.`,
        },
        updatedDevices: devices,
      };
    }

    // Did we reach the final destination IP on l2Path.targetDevice?
    const matchingTargetIntf = l2Path.targetDevice.interfaces.find(
      (i) => i.adminUp && i.ipAddress === resolvedTargetIp
    );
    if (matchingTargetIntf) {
      reachedDestinationDevice = l2Path.targetDevice;
      reachedDestinationInterface = matchingTargetIntf;
      break;
    }

    // Otherwise, l2Path.targetDevice is an intermediate router; decrement TTL and continue
    ttl--;
    currL3Device = l2Path.targetDevice;
  }

  if (!reachedDestinationDevice || !reachedDestinationInterface) {
    return {
      session: {
        id: `sim-${Date.now()}`,
        title: `${protocol} ${destinationInput}`,
        sourceDeviceId,
        targetIp: resolvedTargetIp,
        protocol,
        events,
        overallSuccess: false,
        summaryMessage: `TTL expired in transit or destination ${resolvedTargetIp} unreachable.`,
      },
      updatedDevices: devices,
    };
  }

  // Verify return path from reachedDestinationDevice back to srcIntf.ipAddress!
  if (
    !reachedDestinationDevice.ipRoutingEnabled &&
    reachedDestinationDevice.type !== 'router' &&
    reachedDestinationDevice.type !== 'l3-switch' &&
    reachedDestinationDevice.type !== 'firewall'
  ) {
    const sameSub = isSameSubnet(
      reachedDestinationInterface.ipAddress,
      currSrcIp,
      reachedDestinationInterface.subnetMask
    );
    if (!sameSub && !isValidIpv4(reachedDestinationDevice.defaultGateway)) {
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: reachedDestinationDevice.id,
        fromDeviceName: reachedDestinationDevice.name,
        fromInterface: reachedDestinationInterface.shortName,
        protocol,
        srcMac: reachedDestinationInterface.macAddress,
        dstMac: '00:00:00:00:00:00',
        srcIp: resolvedTargetIp,
        dstIp: currSrcIp,
        ttl: 64,
        action: 'drop',
        summary: `${reachedDestinationDevice.name} received the request, but dropped the reply: Missing Default Gateway for return path to ${currSrcIp}.`,
        reason: `Asymmetric / broken return path: ${reachedDestinationDevice.name} (${resolvedTargetIp}) has no Default Gateway configured to send reply packets back to ${currSrcIp}.`,
        osiLayers: {
          layer1: `${reachedDestinationInterface.shortName}`,
          layer2: `Src MAC: ${reachedDestinationInterface.macAddress}`,
          layer3: `IPv4 Reply Src: ${resolvedTargetIp} -> Dst: ${currSrcIp} (No Return Route)`,
        },
        status: 'error',
      });

      return {
        session: {
          id: `sim-${Date.now()}`,
          title: `${protocol} ${destinationInput}`,
          sourceDeviceId,
          targetIp: resolvedTargetIp,
          protocol,
          events,
          overallSuccess: false,
          summaryMessage: `Request reached ${reachedDestinationDevice.name}, but return reply failed because ${reachedDestinationDevice.name} has no Default Gateway.`,
        },
        updatedDevices: devices,
      };
    }
  } else {
    // Check router return route
    const returnRoute = lookupRoute(reachedDestinationDevice, currSrcIp);
    if (!returnRoute) {
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: reachedDestinationDevice.id,
        fromDeviceName: reachedDestinationDevice.name,
        fromInterface: reachedDestinationInterface.shortName,
        protocol,
        srcMac: reachedDestinationInterface.macAddress,
        dstMac: '00:00:00:00:00:00',
        srcIp: resolvedTargetIp,
        dstIp: currSrcIp,
        ttl: 64,
        action: 'drop',
        summary: `${reachedDestinationDevice.name} received the packet, but lacks a return route back to ${currSrcIp}.`,
        reason: `Broken return path: ${reachedDestinationDevice.name} has no route matching source subnet ${currSrcIp}.`,
        osiLayers: {
          layer1: `${reachedDestinationInterface.shortName}`,
          layer2: `Frame not encapsulated`,
          layer3: `IPv4 Return Lookup Failed for ${currSrcIp}`,
        },
        status: 'error',
      });

      return {
        session: {
          id: `sim-${Date.now()}`,
          title: `${protocol} ${destinationInput}`,
          sourceDeviceId,
          targetIp: resolvedTargetIp,
          protocol,
          events,
          overallSuccess: false,
          summaryMessage: `Packet reached ${reachedDestinationDevice.name}, but return traffic failed (no route back to ${currSrcIp}).`,
        },
        updatedDevices: devices,
      };
    }
  }

  // If protocol is HTTP, verify HTTP server service is enabled
  if (protocol === 'HTTP') {
    if (reachedDestinationDevice.type !== 'server' || !reachedDestinationDevice.services?.httpEnabled) {
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: reachedDestinationDevice.id,
        fromDeviceName: reachedDestinationDevice.name,
        fromInterface: reachedDestinationInterface.shortName,
        toDeviceId: srcDevice.id,
        toDeviceName: srcDevice.name,
        protocol: 'HTTP',
        srcMac: reachedDestinationInterface.macAddress,
        dstMac: srcIntf.macAddress,
        srcIp: resolvedTargetIp,
        dstIp: srcIntf.ipAddress,
        srcPort: 80,
        dstPort: 49152,
        ttl: 64,
        action: 'drop',
        summary: `${reachedDestinationDevice.name} (${resolvedTargetIp}) rejected TCP port 80 connection (TCP RST): HTTP service is not running.`,
        reason: 'Target host is reachable at Layer 3, but HTTP web server daemon on TCP port 80 is disabled or unsupported.',
        osiLayers: {
          layer1: `${reachedDestinationInterface.shortName}`,
          layer2: `Ethernet II`,
          layer3: `IPv4 Src: ${resolvedTargetIp} -> Dst: ${srcIntf.ipAddress}`,
          layer4: 'TCP Src Port: 80 -> Dst Port: 49152 [RST, ACK]',
        },
        status: 'error',
      });

      return {
        session: {
          id: `sim-${Date.now()}`,
          title: `HTTP GET ${destinationInput}`,
          sourceDeviceId,
          targetIp: resolvedTargetIp,
          protocol: 'HTTP',
          events,
          overallSuccess: false,
          summaryMessage: `Connection refused: ${reachedDestinationDevice.name} (${resolvedTargetIp}) is reachable, but HTTP service on port 80 is disabled.`,
        },
        updatedDevices: devices,
      };
    }
  }

  // If protocol is SMB or FTP, verify target device supports file sharing and has SMB/FTP enabled
  if (protocol === 'SMB' || protocol === 'FTP') {
    const fs = reachedDestinationDevice.fileSystem;
    const serviceEnabled =
      protocol === 'SMB' ? fs?.smbSharingEnabled : fs?.ftpServerEnabled;
    const portNum = protocol === 'SMB' ? 445 : 21;

    if (!fs || !serviceEnabled) {
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: reachedDestinationDevice.id,
        fromDeviceName: reachedDestinationDevice.name,
        fromInterface: reachedDestinationInterface.shortName,
        toDeviceId: srcDevice.id,
        toDeviceName: srcDevice.name,
        protocol,
        srcMac: reachedDestinationInterface.macAddress,
        dstMac: srcIntf.macAddress,
        srcIp: resolvedTargetIp,
        dstIp: srcIntf.ipAddress,
        srcPort: portNum,
        dstPort: 49200,
        ttl: 64,
        action: 'drop',
        summary: `${reachedDestinationDevice.name} (${resolvedTargetIp}) refused ${protocol} connection on TCP port ${portNum}: ${protocol} File Sharing is disabled.`,
        reason: `Target host ${reachedDestinationDevice.name} is reachable at Layer 3, but ${protocol} daemon on TCP port ${portNum} is turned off.`,
        osiLayers: {
          layer1: `${reachedDestinationInterface.shortName}`,
          layer2: `Ethernet II`,
          layer3: `IPv4 Src: ${resolvedTargetIp} -> Dst: ${srcIntf.ipAddress}`,
          layer4: `TCP Src Port: ${portNum} -> Dst Port: 49200 [RST, ACK]`,
        },
        status: 'error',
      });

      return {
        session: {
          id: `sim-${Date.now()}`,
          title: `${protocol} \\\\${destinationInput}`,
          sourceDeviceId,
          targetIp: resolvedTargetIp,
          protocol,
          events,
          overallSuccess: false,
          summaryMessage: `Connection refused: ${protocol} file sharing (TCP Port ${portNum}) is disabled on ${reachedDestinationDevice.name} (${resolvedTargetIp}).`,
        },
        updatedDevices: devices,
      };
    }
  }

  // Emit successful Echo Reply / HTTP 200 OK / SMB-FTP Session Reply event
  const rttMs = Math.max(2, hopCount * 4 + events.length * 2);
  const servicePort =
    protocol === 'HTTP' ? 80 : protocol === 'SMB' ? 445 : protocol === 'FTP' ? 21 : undefined;

  if (allTraversedL2Steps.length > 0) {
    const reverseSteps = [...allTraversedL2Steps].reverse();
    for (let i = 0; i < reverseSteps.length; i++) {
      const step = reverseSteps[i];
      const isFinalHop = i === reverseSteps.length - 1;
      events.push({
        id: `evt-${Date.now()}-${stepCounter}`,
        stepIndex: stepCounter++,
        timestamp: Date.now(),
        fromDeviceId: step.toDevice.id,
        fromDeviceName: step.toDevice.name,
        fromInterface: step.toInterface.shortName,
        toDeviceId: step.fromDevice.id,
        toDeviceName: step.fromDevice.name,
        toInterface: step.fromInterface.shortName,
        linkId: step.link.id,
        protocol,
        srcMac: reachedDestinationInterface.macAddress,
        dstMac: srcIntf.macAddress,
        srcIp: resolvedTargetIp,
        dstIp: srcIntf.ipAddress,
        srcPort: servicePort,
        dstPort: servicePort ? 49152 : undefined,
        ttl: 64 - (hopCount - 1),
        vlanId: step.vlanId,
        action: 'reply',
        summary: isFinalHop
          ? protocol === 'ICMP'
            ? `ICMP Echo Reply received by ${srcDevice.name} from ${reachedDestinationDevice.name} (${resolvedTargetIp}): bytes=32 time=${rttMs}ms TTL=${64 - (hopCount - 1)}`
            : protocol === 'SMB' || protocol === 'FTP'
            ? `${protocol} Session Established between ${srcDevice.name} and \\\\${reachedDestinationDevice.name}\\${reachedDestinationDevice.fileSystem?.shareName || 'Shared'} (${rttMs}ms)`
            : `HTTP 200 OK received by ${srcDevice.name} from ${reachedDestinationDevice.name} (${resolvedTargetIp}) in ${rttMs}ms.`
          : `${step.toDevice.name} forwarded ${protocol} Reply frame across ${step.link.type.toUpperCase()} link to ${step.fromDevice.name}.`,
        reason: `Return path frame transmission toward ${srcDevice.name} (${srcIntf.ipAddress}).`,
        osiLayers: {
          layer1: `${step.link.type.toUpperCase()} Link (${step.toInterface.shortName} <-> ${step.fromInterface.shortName})`,
          layer2: `Ethernet II Unicast Src: ${reachedDestinationInterface.macAddress} -> Dst: ${srcIntf.macAddress}`,
          layer3: `IPv4 Src: ${resolvedTargetIp} -> Dst: ${srcIntf.ipAddress}, TTL: ${64 - (hopCount - 1)}`,
          layer4: servicePort ? `TCP Src Port: ${servicePort}, Dst Port: 49152 [PSH, ACK]` : undefined,
          layer7:
            protocol === 'ICMP'
              ? 'ICMP Echo Reply (Type 0, Code 0)'
              : protocol === 'SMB'
              ? 'SMB2 TREE_CONNECT & FILE_SYNC Response (TCP 445)'
              : protocol === 'FTP'
              ? 'FTP 226 Transfer Complete / Directory Listing (TCP 21)'
              : 'HTTP/1.1 200 OK (Content-Type: text/html)',
        },
        status: 'success',
      });
    }
  } else {
    const directLink = links.find(
      (l) =>
        (l.sourceDeviceId === reachedDestinationDevice.id && l.targetDeviceId === srcDevice.id) ||
        (l.targetDeviceId === reachedDestinationDevice.id && l.sourceDeviceId === srcDevice.id)
    );
    events.push({
      id: `evt-${Date.now()}-${stepCounter}`,
      stepIndex: stepCounter++,
      timestamp: Date.now(),
      fromDeviceId: reachedDestinationDevice.id,
      fromDeviceName: reachedDestinationDevice.name,
      fromInterface: reachedDestinationInterface.shortName,
      toDeviceId: srcDevice.id,
      toDeviceName: srcDevice.name,
      toInterface: srcIntf.shortName,
      linkId: directLink?.id,
      protocol,
      srcMac: reachedDestinationInterface.macAddress,
      dstMac: srcIntf.macAddress,
      srcIp: resolvedTargetIp,
      dstIp: srcIntf.ipAddress,
      srcPort: servicePort,
      dstPort: servicePort ? 49152 : undefined,
      ttl: 64 - (hopCount - 1),
      action: 'reply',
      summary:
        protocol === 'ICMP'
          ? `ICMP Echo Reply received by ${srcDevice.name} from ${reachedDestinationDevice.name} (${resolvedTargetIp}): bytes=32 time=${rttMs}ms TTL=${64 - (hopCount - 1)}`
          : protocol === 'SMB' || protocol === 'FTP'
          ? `${protocol} Session Established between ${srcDevice.name} and \\\\${reachedDestinationDevice.name}\\${reachedDestinationDevice.fileSystem?.shareName || 'Shared'} (${rttMs}ms)`
          : `HTTP 200 OK received by ${srcDevice.name} from ${reachedDestinationDevice.name} (${resolvedTargetIp}) in ${rttMs}ms.`,
      reason: `End-to-end two-way reachability verified between ${srcDevice.name} (${srcIntf.ipAddress}) and ${reachedDestinationDevice.name} (${resolvedTargetIp}).`,
      osiLayers: {
        layer1: `Physical Return Path Verified (${rttMs}ms RTT)`,
        layer2: `Ethernet II Src: ${reachedDestinationInterface.macAddress} -> Dst: ${srcIntf.macAddress}`,
        layer3: `IPv4 Src: ${resolvedTargetIp} -> Dst: ${srcIntf.ipAddress}, TTL: ${64 - (hopCount - 1)}`,
        layer4: servicePort ? `TCP Src Port: ${servicePort}, Dst Port: 49152 [PSH, ACK]` : undefined,
        layer7:
          protocol === 'ICMP'
            ? 'ICMP Echo Reply (Type 0, Code 0)'
            : protocol === 'SMB'
            ? 'SMB2 TREE_CONNECT & FILE_SYNC Response (TCP 445)'
            : protocol === 'FTP'
            ? 'FTP 226 Transfer Complete / Directory Listing (TCP 21)'
            : 'HTTP/1.1 200 OK (Content-Type: text/html)',
      },
      status: 'success',
    });
  }

  return {
    session: {
      id: `sim-${Date.now()}`,
      title: `${protocol} ${destinationInput}`,
      sourceDeviceId,
      targetIp: resolvedTargetIp,
      protocol,
      events,
      overallSuccess: true,
      summaryMessage:
        protocol === 'ICMP'
          ? `Ping ${resolvedTargetIp} succeeded: 4/4 packets received (0% loss), approx RTT ${rttMs}ms.`
          : protocol === 'SMB' || protocol === 'FTP'
          ? `${protocol} Share Connected: \\\\${reachedDestinationDevice.name}\\${reachedDestinationDevice.fileSystem?.shareName || 'Shared'} (${resolvedTargetIp}:${servicePort})`
          : `HTTP 200 OK received from ${resolvedTargetIp} (${reachedDestinationDevice.name}).`,
      rttMs,
    },
    updatedDevices: devices,
  };
}

/**
 * Simulated DHCP DORA (Discover, Offer, Request, Acknowledge) lease acquisition for a PC/Laptop.
 */
export function requestDhcpLease(
  clientDeviceId: string,
  rawDevices: NetworkDevice[],
  rawLinks: NetworkLink[]
): {
  success: boolean;
  message: string;
  assignedIp?: string;
  subnetMask?: string;
  defaultGateway?: string;
  dnsServer?: string;
  updatedDevices: NetworkDevice[];
  events: PacketStepEvent[];
} {
  const { devices, links } = synchronizeNetworkState(rawDevices, rawLinks);
  const client = devices.find((d) => d.id === clientDeviceId);
  const clientIf = client?.interfaces[0];

  if (!client || !clientIf || !clientIf.adminUp || !clientIf.lineProtocolUp) {
    return {
      success: false,
      message: 'DHCP failed: Client network interface is down or disconnected.',
      updatedDevices: devices,
      events: [],
    };
  }

  // Find reachable DHCP server on same L2 broadcast domain
  const dhcpServers = devices.filter(
    (d) => d.type === 'server' && d.services?.dhcpEnabled && d.services.dhcpPools.length > 0
  );

  for (const srv of dhcpServers) {
    const srvIf = srv.interfaces.find((i) => i.adminUp && i.lineProtocolUp && isValidIpv4(i.ipAddress));
    if (!srvIf) continue;

    const l2Trace = traceLayer2PathToIp(client, clientIf, srvIf.ipAddress, devices, links, clientIf.accessVlan || 1);
    if (l2Trace.reachable) {
      const pool = srv.services!.dhcpPools[0];
      const startL = ipToLong(pool.startIp);
      const endL = ipToLong(pool.endIp);
      if (startL === null || endL === null) continue;

      // Check existing lease or allocate next free IP
      let leasedIp = pool.leases[clientIf.macAddress];
      if (!leasedIp) {
        const usedIps = new Set(
          devices.flatMap((d) => d.interfaces.map((i) => i.ipAddress)).filter(Boolean)
        );
        for (let curr = startL; curr <= endL; curr++) {
          const candidate = longToIp(curr);
          if (!usedIps.has(candidate)) {
            leasedIp = candidate;
            pool.leases[clientIf.macAddress] = candidate;
            break;
          }
        }
      }

      if (leasedIp) {
        clientIf.ipAddress = leasedIp;
        clientIf.subnetMask = pool.mask;
        client.defaultGateway = pool.defaultRouter;
        client.dnsServer = pool.dnsServer;
        client.addressingMode = 'dhcp';

        const doraEvents: PacketStepEvent[] = [
          {
            id: `dhcp-disc-${Date.now()}`,
            stepIndex: 1,
            timestamp: Date.now(),
            fromDeviceId: client.id,
            fromDeviceName: client.name,
            fromInterface: clientIf.shortName,
            toDeviceId: srv.id,
            toDeviceName: srv.name,
            protocol: 'DHCP',
            srcMac: clientIf.macAddress,
            dstMac: 'FF:FF:FF:FF:FF:FF',
            srcIp: '0.0.0.0',
            dstIp: '255.255.255.255',
            srcPort: 68,
            dstPort: 67,
            ttl: 64,
            action: 'flood',
            summary: `DHCP Discover broadcast from ${client.name} (${clientIf.macAddress}).`,
            reason: 'Client broadcasted DHCPDISCOVER on UDP 67/68 seeking an IPv4 lease.',
            osiLayers: {
              layer1: `${clientIf.shortName}`,
              layer2: `Ethernet Broadcast Dst: FF:FF:FF:FF:FF:FF`,
              layer3: 'IPv4 Src: 0.0.0.0 -> Dst: 255.255.255.255',
              layer4: 'UDP Src Port: 68 -> Dst Port: 67',
              layer7: 'DHCP Discover (Transaction ID 0x3903F326)',
            },
            status: 'info',
          },
          {
            id: `dhcp-ack-${Date.now()}`,
            stepIndex: 2,
            timestamp: Date.now(),
            fromDeviceId: srv.id,
            fromDeviceName: srv.name,
            fromInterface: srvIf.shortName,
            toDeviceId: client.id,
            toDeviceName: client.name,
            protocol: 'DHCP',
            srcMac: srvIf.macAddress,
            dstMac: clientIf.macAddress,
            srcIp: srvIf.ipAddress,
            dstIp: leasedIp,
            srcPort: 67,
            dstPort: 68,
            ttl: 64,
            action: 'reply',
            summary: `DHCP Offer & ACK from ${srv.name}: Assigned ${leasedIp}/${maskToCidr(pool.mask)} (GW: ${pool.defaultRouter}).`,
            reason: `DHCP Server ${srv.name} allocated ${leasedIp} from pool "${pool.name}".`,
            osiLayers: {
              layer1: `${srvIf.shortName}`,
              layer2: `Ethernet Unicast Src: ${srvIf.macAddress} -> Dst: ${clientIf.macAddress}`,
              layer3: `IPv4 Src: ${srvIf.ipAddress} -> Dst: ${leasedIp}`,
              layer4: 'UDP Src Port: 67 -> Dst Port: 68',
              layer7: `DHCP ACK: IP ${leasedIp}, Mask ${pool.mask}, Router ${pool.defaultRouter}, DNS ${pool.dnsServer}`,
            },
            status: 'success',
          },
        ];

        return {
          success: true,
          message: `DHCP Lease obtained from ${srv.name}: IP ${leasedIp}, Mask ${pool.mask}, Gateway ${pool.defaultRouter}.`,
          assignedIp: leasedIp,
          subnetMask: pool.mask,
          defaultGateway: pool.defaultRouter,
          dnsServer: pool.dnsServer,
          updatedDevices: synchronizeNetworkState(devices, links).devices,
          events: doraEvents,
        };
      }
    }
  }

  return {
    success: false,
    message: 'DHCP failed: No reachable DHCP server responded on this VLAN/broadcast domain.',
    updatedDevices: devices,
    events: [],
  };
}

/**
 * Automated Network Diagnostics ("Check Network" inspector).
 * Inspects links, interfaces, duplicate IPs, subnet mask mismatches, gateway reachability, VLANs, and routing.
 */
export function runNetworkDiagnostics(
  rawDevices: NetworkDevice[],
  rawLinks: NetworkLink[]
): DiagnosticIssue[] {
  const { devices, links } = synchronizeNetworkState(rawDevices, rawLinks);
  const issues: DiagnosticIssue[] = [];

  // 1. Check for unplugged devices
  for (const dev of devices) {
    const hasConnectedLink = dev.interfaces.some((i) => i.connectedLinkId);
    if (!hasConnectedLink) {
      issues.push({
        id: `diag-unplugged-${dev.id}`,
        severity: 'warning',
        confirmed: true,
        deviceId: dev.id,
        deviceName: dev.name,
        title: 'Device has no connected cables',
        evidence: `All interfaces on ${dev.name} (${dev.model}) are currently disconnected.`,
        probableCause: 'No Ethernet, Serial, Fiber, or Wireless link has been attached to this device.',
        suggestedAction: 'Select the Connect tool in the canvas toolbar and link an interface to a switch or router.',
      });
    }
  }

  // 2. Check for connected interfaces that are administratively shutdown
  for (const link of links) {
    const srcDev = devices.find((d) => d.id === link.sourceDeviceId);
    const dstDev = devices.find((d) => d.id === link.targetDeviceId);
    const srcIf = srcDev?.interfaces.find((i) => i.id === link.sourceInterfaceId);
    const dstIf = dstDev?.interfaces.find((i) => i.id === link.targetInterfaceId);

    if (srcDev && srcIf && !srcIf.adminUp) {
      issues.push({
        id: `diag-admin-down-${srcDev.id}-${srcIf.id}`,
        severity: 'error',
        confirmed: true,
        deviceId: srcDev.id,
        deviceName: srcDev.name,
        interfaceName: srcIf.shortName,
        title: `Interface ${srcIf.shortName} is administratively down`,
        evidence: `${srcDev.name} interface ${srcIf.name} is cabled to ${dstDev?.name || 'a neighbor'}, but its status is administratively down (shutdown).`,
        probableCause: 'Router interfaces default to shutdown until explicitly enabled, or shutdown was executed.',
        suggestedAction: `Enable interface ${srcIf.shortName} in the Device Inspector or execute "no shutdown" in interface configuration mode.`,
        cliHint: `enable\nconfigure terminal\ninterface ${srcIf.name}\nno shutdown`,
      });
    }

    if (dstDev && dstIf && !dstIf.adminUp) {
      issues.push({
        id: `diag-admin-down-${dstDev.id}-${dstIf.id}`,
        severity: 'error',
        confirmed: true,
        deviceId: dstDev.id,
        deviceName: dstDev.name,
        interfaceName: dstIf.shortName,
        title: `Interface ${dstIf.shortName} is administratively down`,
        evidence: `${dstDev.name} interface ${dstIf.name} is cabled to ${srcDev?.name || 'a neighbor'}, but its status is administratively down (shutdown).`,
        probableCause: 'Interface is disabled via shutdown command.',
        suggestedAction: `Enable interface ${dstIf.shortName} in the Device Inspector or run "no shutdown" in the CLI.`,
        cliHint: `enable\nconfigure terminal\ninterface ${dstIf.name}\nno shutdown`,
      });
    }
  }

  // 3. Check for duplicate IPv4 addresses across the topology
  const ipOwners = new Map<string, { device: NetworkDevice; intf: NetworkInterface }[]>();
  for (const dev of devices) {
    for (const intf of dev.interfaces) {
      if (isValidIpv4(intf.ipAddress)) {
        const list = ipOwners.get(intf.ipAddress) || [];
        list.push({ device: dev, intf });
        ipOwners.set(intf.ipAddress, list);
      }
    }
  }

  for (const [ip, owners] of ipOwners.entries()) {
    if (owners.length > 1) {
      const names = owners.map((o) => `${o.device.name} (${o.intf.shortName})`).join(' and ');
      issues.push({
        id: `diag-dup-ip-${ip}`,
        severity: 'error',
        confirmed: true,
        deviceId: owners[0].device.id,
        deviceName: owners[0].device.name,
        interfaceName: owners[0].intf.shortName,
        title: `Duplicate IPv4 address conflict (${ip})`,
        evidence: `IPv4 address ${ip} is assigned simultaneously to ${names}.`,
        probableCause: 'Two interfaces were statically assigned the same IPv4 address, causing ARP cache poisoning.',
        suggestedAction: `Assign a unique host IPv4 address within the subnet to ${owners[0].device.name}.`,
      });
    }
  }

  // 4. Check end-device IP, Subnet Mask, and Default Gateway consistency
  for (const dev of devices) {
    if (dev.type === 'pc' || dev.type === 'laptop' || dev.type === 'server' || dev.type === 'printer') {
      const intf = dev.interfaces[0];
      if (!intf) continue;

      if (intf.connectedLinkId && !isValidIpv4(intf.ipAddress)) {
        issues.push({
          id: `diag-no-ip-${dev.id}`,
          severity: 'error',
          confirmed: true,
          deviceId: dev.id,
          deviceName: dev.name,
          interfaceName: intf.shortName,
          title: 'Missing IPv4 address on connected endpoint',
          evidence: `${dev.name} (${intf.shortName}) is connected to the network but has no IPv4 address configured.`,
          probableCause: 'Static IP was not entered or DHCP lease was not requested.',
          suggestedAction: `Open ${dev.name} Inspector or Desktop IP Configuration to assign a static IPv4 address or request DHCP.`,
        });
        continue;
      }

      if (isValidIpv4(intf.ipAddress) && isValidSubnetMask(intf.subnetMask)) {
        if (isValidIpv4(dev.defaultGateway)) {
          if (!isSameSubnet(intf.ipAddress, dev.defaultGateway, intf.subnetMask)) {
            issues.push({
              id: `diag-bad-gw-${dev.id}`,
              severity: 'error',
              confirmed: true,
              deviceId: dev.id,
              deviceName: dev.name,
              interfaceName: intf.shortName,
              title: 'Default Gateway is outside local subnet',
              evidence: `${dev.name} has IP ${intf.ipAddress}/${maskToCidr(intf.subnetMask)} (Subnet ${getNetworkAddress(intf.ipAddress, intf.subnetMask)}), but Default Gateway is ${dev.defaultGateway}.`,
              probableCause: 'Either the Default Gateway IP has a typo, or the PC subnet mask is incorrect.',
              suggestedAction: `Update ${dev.name}'s Default Gateway to match the router interface IP on subnet ${getNetworkAddress(intf.ipAddress, intf.subnetMask)}/${maskToCidr(intf.subnetMask)}.`,
            });
          } else {
            // Check if gateway IP actually exists on any reachable router/L3 switch
            const gwExists = devices.some((d) =>
              d.interfaces.some((i) => i.ipAddress === dev.defaultGateway && i.adminUp)
            );
            if (!gwExists) {
              issues.push({
                id: `diag-missing-gw-dev-${dev.id}`,
                severity: 'warning',
                confirmed: false,
                deviceId: dev.id,
                deviceName: dev.name,
                interfaceName: intf.shortName,
                title: `Default Gateway ${dev.defaultGateway} is not active on any router`,
                evidence: `${dev.name} points to gateway ${dev.defaultGateway}, which is not assigned to any enabled router interface in the topology.`,
                probableCause: 'Router interface IP was not configured yet or the router port is shutdown.',
                suggestedAction: `Verify that the local router interface has IP ${dev.defaultGateway} and is enabled with "no shutdown".`,
              });
            }
          }
        } else {
          // Check if there are routers in the topology; if so, warn about missing default gateway
          const hasRouters = devices.some((d) => d.type === 'router' || d.type === 'l3-switch');
          if (hasRouters) {
            issues.push({
              id: `diag-blank-gw-${dev.id}`,
              severity: 'warning',
              confirmed: false,
              deviceId: dev.id,
              deviceName: dev.name,
              interfaceName: intf.shortName,
              title: 'No Default Gateway configured for inter-VLAN/remote routing',
              evidence: `${dev.name} (${intf.ipAddress}) has no Default Gateway configured while routers are present in the topology.`,
              probableCause: 'Host can communicate with local LAN peers, but packets to remote subnets will fail.',
              suggestedAction: `Set Default Gateway on ${dev.name} to the local router's LAN interface IP.`,
            });
          }
        }
      }
    }
  }

  // 5. Check VLAN and Trunk consistency across switches
  for (const link of links) {
    const srcDev = devices.find((d) => d.id === link.sourceDeviceId);
    const dstDev = devices.find((d) => d.id === link.targetDeviceId);
    const srcIf = srcDev?.interfaces.find((i) => i.id === link.sourceInterfaceId);
    const dstIf = dstDev?.interfaces.find((i) => i.id === link.targetInterfaceId);
    if (!srcDev || !dstDev || !srcIf || !dstIf) continue;

    const srcIsSwitch = srcDev.type === 'l2-switch' || srcDev.type === 'l3-switch';
    const dstIsSwitch = dstDev.type === 'l2-switch' || dstDev.type === 'l3-switch';

    if (srcIsSwitch && dstIsSwitch) {
      if (srcIf.switchportMode !== dstIf.switchportMode) {
        issues.push({
          id: `diag-trunk-mismatch-${link.id}`,
          severity: 'error',
          confirmed: true,
          deviceId: srcDev.id,
          deviceName: srcDev.name,
          interfaceName: srcIf.shortName,
          title: 'Switchport mode mismatch on inter-switch link',
          evidence: `${srcDev.name} (${srcIf.shortName}) is in "${srcIf.switchportMode}" mode, while ${dstDev.name} (${dstIf.shortName}) is in "${dstIf.switchportMode}" mode.`,
          probableCause: 'One side of the inter-switch link was configured as an 802.1Q trunk while the other remained an access port.',
          suggestedAction: `Configure both ${srcDev.name} (${srcIf.shortName}) and ${dstDev.name} (${dstIf.shortName}) as Trunk ports.`,
          cliHint: `enable\nconfigure terminal\ninterface ${srcIf.name}\nswitchport mode trunk`,
        });
      }
    }
  }

  // 6. Check Routers for missing routes to other subnets in the topology
  const allSubnets = new Map<string, { network: string; mask: string; ownerName: string }>();
  for (const dev of devices) {
    for (const intf of dev.interfaces) {
      if (intf.adminUp && isValidIpv4(intf.ipAddress) && isValidSubnetMask(intf.subnetMask)) {
        const net = getNetworkAddress(intf.ipAddress, intf.subnetMask);
        if (net) {
          allSubnets.set(`${net}/${intf.subnetMask}`, {
            network: net,
            mask: intf.subnetMask,
            ownerName: `${dev.name} (${intf.shortName})`,
          });
        }
      }
    }
  }

  const routers = devices.filter((d) => d.type === 'router' || d.type === 'l3-switch');
  if (routers.length > 1) {
    for (const r of routers) {
      for (const [, sub] of allSubnets.entries()) {
        const probeIp = longToIp((ipToLong(sub.network)! + 1) >>> 0);
        const route = lookupRoute(r, probeIp);
        if (!route) {
          issues.push({
            id: `diag-missing-route-${r.id}-${sub.network}`,
            severity: 'error',
            confirmed: true,
            deviceId: r.id,
            deviceName: r.name,
            title: `Missing route to subnet ${sub.network}/${maskToCidr(sub.mask)}`,
            evidence: `Router ${r.name} has no connected, static, or dynamic route to reach network ${sub.network} (${sub.mask}) hosted on ${sub.ownerName}.`,
            probableCause: 'Static route (ip route) or dynamic routing protocol (OSPF/RIP) has not been configured for this remote network.',
            suggestedAction: `Add a static route on ${r.name} toward the next-hop router IP for ${sub.network} ${sub.mask}.`,
            cliHint: `enable\nconfigure terminal\nip route ${sub.network} ${sub.mask} <next-hop-ip>`,
          });
        }
      }
    }
  }

  return issues;
}
