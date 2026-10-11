import {
  CliMode,
  CliSessionState,
  NetworkDevice,
  NetworkInterface,
  NetworkLink,
} from '../types/network';
import {
  getNetworkAddress,
  isValidIpv4,
  isValidSubnetMask,
  maskToCidr,
} from '../utils/networkMath';
import {
  requestDhcpLease,
  runPacketSimulation,
  synchronizeNetworkState,
} from './simulationEngine';

export interface CliExecutionResult {
  updatedDevices: NetworkDevice[];
  updatedSession: CliSessionState;
  triggeredSimulation?: ReturnType<typeof runPacketSimulation>['session'];
}

export function getCliPrompt(device: NetworkDevice, session: CliSessionState): string {
  if (device.type === 'pc' || device.type === 'laptop' || device.type === 'server' || device.type === 'printer') {
    return `C:\\Users\\${device.hostname}> `;
  }

  const host = device.hostname || device.name;
  switch (session.mode) {
    case 'user_exec':
      return `${host}>`;
    case 'priv_exec':
      return `${host}#`;
    case 'global_config':
      return `${host}(config)#`;
    case 'interface_config':
      return `${host}(config-if)#`;
    case 'vlan_config':
      return `${host}(config-vlan)#`;
    case 'router_ospf_config':
    case 'router_rip_config':
      return `${host}(config-router)#`;
    default:
      return `${host}>`;
  }
}

export function getContextualHelp(device: NetworkDevice, session: CliSessionState): string[] {
  if (device.type === 'pc' || device.type === 'laptop' || device.type === 'server' || device.type === 'printer') {
    return [
      'Supported PC Command Prompt Commands:',
      '  ipconfig              Display IPv4 address, subnet mask, and default gateway',
      '  ipconfig /all         Display full MAC address, DNS, and DHCP details',
      '  ipconfig /renew       Request IPv4 configuration from a DHCP server',
      '  ping <ip|hostname>    Send ICMP Echo Requests to test end-to-end connectivity',
      '  tracert <ip|host>     Trace the Layer 3 router hops to a destination',
      '  arp -a                Display the current ARP cache (IP-to-MAC mappings)',
      '  arp -d                Clear dynamic entries from the ARP cache',
      '  route print           Display the local host IPv4 routing table',
      '  nslookup <hostname>   Query the configured DNS server for a domain name',
      '  dir / ls              List files and folders in the local File Manager',
      '  type / cat <file>     Display the contents of a local file',
      '  net view [\\\\ip]       Discover active SMB network shares on the LAN or remote IP',
      '  cls / clear           Clear the terminal screen',
    ];
  }

  switch (session.mode) {
    case 'user_exec':
      return [
        'Exec commands:',
        '  enable                Turn on privileged commands',
        '  ping <ip|hostname>    Send ICMP echo messages',
        '  traceroute <ip>       Trace route to destination',
        '  show                  Show running system information (ip, interfaces, arp, vlan, version)',
        '  clear                 Clear terminal screen',
      ];
    case 'priv_exec':
      return [
        'Privileged Exec commands:',
        '  configure terminal    Enter global configuration mode',
        '  show running-config   Display current operating configuration',
        '  show startup-config   Display saved NVRAM startup configuration',
        '  show ip interface brief  Summary of interface IP statuses and states',
        '  show ip route         Display IPv4 routing table',
        '  show interfaces       Detailed interface configuration and status',
        '  show arp              Display router ARP table',
        '  show vlan brief       Display switch VLAN database and port assignments',
        '  show mac address-table Display switch Layer 2 forwarding table',
        '  show version          Display IOS system hardware and software status',
        '  ping <ip>             Send ICMP echo messages',
        '  traceroute <ip>       Trace route to destination',
        '  copy running-config startup-config  Save configuration to NVRAM',
        '  write memory          Save configuration to NVRAM',
        '  disable               Return to User EXEC mode',
      ];
    case 'global_config':
      return [
        'Global Configuration commands:',
        '  hostname <name>       Set system network name',
        '  interface <name>      Select an interface to configure (e.g., interface Gi0/0, interface Fa0/1)',
        '  ip route <net> <mask> <next-hop>  Establish static route',
        '  no ip route <net> <mask>          Remove static route',
        '  ip routing            Enable Layer 3 inter-VLAN routing (L3 Switch)',
        '  vlan <1-4094>         Create or enter VLAN configuration mode (Switch)',
        '  router ospf <id>      Enable OSPF routing process',
        '  router rip            Enable RIP routing process',
        '  access-list <1-199> <permit|deny> ... Configure standard or extended ACL',
        '  exit / end            Exit from global configuration mode',
      ];
    case 'interface_config':
      return [
        'Interface Configuration commands:',
        '  ip address <ip> <mask>         Set IPv4 address and subnet mask',
        '  no shutdown                    Enable the selected interface',
        '  shutdown                       Administratively disable the interface',
        '  description <text>             Interface specific description',
        '  switchport mode <access|trunk> Set Layer 2 switching mode',
        '  switchport access vlan <id>    Assign port to an access VLAN',
        '  switchport trunk allowed vlan <list|add|all> Configure allowed VLANs on trunk',
        '  ip access-group <id> <in|out>  Apply ACL to interface traffic',
        '  ip nat <inside|outside>        Mark interface for NAT translation',
        '  exit                           Return to global configuration mode',
        '  end                            Return to Privileged EXEC mode',
      ];
    case 'vlan_config':
      return [
        'VLAN Configuration commands:',
        '  name <vlan-name>      Ascii name of the VLAN',
        '  exit                  Apply changes and return to global configuration mode',
      ];
    case 'router_ospf_config':
      return [
        'OSPF Router Configuration commands:',
        '  network <ip> <wildcard> area <id>  Define interfaces on which OSPF runs',
        '  exit                               Return to global configuration mode',
      ];
    case 'router_rip_config':
      return [
        'RIP Router Configuration commands:',
        '  network <ip>          Enable RIP routing on an IP network',
        '  version 2             Enable RIPv2 classless routing',
        '  exit                  Return to global configuration mode',
      ];
    default:
      return ['Type ? for available commands.'];
  }
}

export function matchInterfaceByName(device: NetworkDevice, inputName: string): NetworkInterface | undefined {
  const clean = inputName.trim().toLowerCase().replace(/\s+/g, '');
  return device.interfaces.find((intf) => {
    const full = intf.name.toLowerCase().replace(/\s+/g, '');
    const short = intf.shortName.toLowerCase().replace(/\s+/g, '');
    if (full === clean || short === clean) return true;
    // Also support prefixes like "g0/0", "gi0/0", "f0/1", "fa0/1", "s0/0/0", "se0/0/0", "vl10", "vlan10"
    if (clean.startsWith('g') && short.startsWith('gi') && clean.replace(/^gi?(gabitethernet)?/, '') === short.replace(/^gi/, '')) {
      return true;
    }
    if (clean.startsWith('f') && short.startsWith('fa') && clean.replace(/^fa?(stethernet)?/, '') === short.replace(/^fa/, '')) {
      return true;
    }
    if (clean.startsWith('s') && short.startsWith('se') && clean.replace(/^se?(rial)?/, '') === short.replace(/^se/, '')) {
      return true;
    }
    if (clean.startsWith('vl') && short.startsWith('vlan') && clean.replace(/^vl(an)?/, '') === short.replace(/^vlan/, '')) {
      return true;
    }
    return false;
  });
}

export function generateRunningConfigText(device: NetworkDevice): string {
  const lines: string[] = [
    'Building configuration...',
    '',
    'Current configuration : 1482 bytes',
    '!',
    'version 15.4',
    'service timestamps debug datetime msec',
    'service timestamps log datetime msec',
    '!',
    `hostname ${device.hostname}`,
    '!',
  ];

  if (device.ipRoutingEnabled && device.type === 'l3-switch') {
    lines.push('ip routing', '!');
  }

  if (device.type === 'l2-switch' || device.type === 'l3-switch') {
    for (const v of device.vlans) {
      if (v.id !== 1) {
        lines.push(`vlan ${v.id}`, ` name ${v.name}`, '!');
      }
    }
  }

  for (const intf of device.interfaces) {
    lines.push(`interface ${intf.name}`);
    if (intf.description) {
      lines.push(` description ${intf.description}`);
    }
    if (device.type === 'l2-switch' || (device.type === 'l3-switch' && intf.switchportMode !== 'routed')) {
      lines.push(` switchport mode ${intf.switchportMode}`);
      if (intf.switchportMode === 'access') {
        lines.push(` switchport access vlan ${intf.accessVlan}`);
      } else if (intf.switchportMode === 'trunk') {
        lines.push(` switchport trunk allowed vlan ${intf.trunkAllowedVlans.join(',')}`);
      }
    } else {
      if (intf.ipAddress && intf.subnetMask) {
        lines.push(` ip address ${intf.ipAddress} ${intf.subnetMask}`);
      } else {
        lines.push(' no ip address');
      }
    }
    if (intf.aclIn) lines.push(` ip access-group ${intf.aclIn} in`);
    if (intf.aclOut) lines.push(` ip access-group ${intf.aclOut} out`);
    if (intf.natDirection && intf.natDirection !== 'none') {
      lines.push(` ip nat ${intf.natDirection}`);
    }
    lines.push(intf.adminUp ? ' no shutdown' : ' shutdown');
    lines.push('!');
  }

  if (device.ospfEnabled) {
    lines.push(`router ospf ${device.ospfProcessId || 1}`);
    for (const n of device.ospfNetworks || []) {
      lines.push(` network ${n.network} ${n.wildcard} area ${n.area}`);
    }
    lines.push('!');
  }

  if (device.ripEnabled) {
    lines.push('router rip', ' version 2');
    for (const n of device.ripNetworks || []) {
      lines.push(` network ${n}`);
    }
    lines.push('!');
  }

  const staticRoutes = device.routingTable.filter((r) => r.type === 'S' || r.type === 'S*');
  for (const sr of staticRoutes) {
    lines.push(`ip route ${sr.network} ${sr.mask} ${sr.nextHop}`);
  }
  if (staticRoutes.length > 0) lines.push('!');

  for (const acl of device.acls) {
    lines.push(
      `access-list ${acl.aclNumber} ${acl.action} ${acl.protocol} ${acl.sourceIp} ${acl.sourceWildcard} ${acl.destIp} ${acl.destWildcard}`
    );
  }
  if (device.acls.length > 0) lines.push('!');

  lines.push('line con 0', 'line vty 0 4', ' login', '!', 'end');
  return lines.join('\n');
}

export function executeCliCommand(
  rawCommand: string,
  deviceId: string,
  session: CliSessionState,
  rawDevices: NetworkDevice[],
  rawLinks: NetworkLink[]
): CliExecutionResult {
  const { devices, links } = synchronizeNetworkState(rawDevices, rawLinks);
  const device = devices.find((d) => d.id === deviceId);
  if (!device) {
    return { updatedDevices: devices, updatedSession: session };
  }

  const prompt = getCliPrompt(device, session);
  const trimmed = rawCommand.trim();
  const nextSession: CliSessionState = {
    ...session,
    history: trimmed ? [...session.history, trimmed] : session.history,
    outputLines: [
      ...session.outputLines,
      { id: `cmd-${Date.now()}-${Math.random()}`, text: `${prompt} ${rawCommand}`, type: 'input' },
    ],
  };

  const appendOut = (text: string, type: 'output' | 'error' | 'info' | 'success' = 'output') => {
    const lines = text.split('\n');
    for (const l of lines) {
      nextSession.outputLines.push({
        id: `out-${Date.now()}-${Math.random()}`,
        text: l,
        type,
      });
    }
  };

  if (!trimmed) {
    return { updatedDevices: devices, updatedSession: nextSession };
  }

  if (trimmed === '?' || trimmed === 'help') {
    appendOut(getContextualHelp(device, session).join('\n'), 'info');
    return { updatedDevices: devices, updatedSession: nextSession };
  }

  if (trimmed.toLowerCase() === 'clear' || trimmed.toLowerCase() === 'cls') {
    nextSession.outputLines = [];
    return { updatedDevices: devices, updatedSession: nextSession };
  }

  const tokens = trimmed.split(/\s+/);
  const cmd = tokens[0].toLowerCase();

  // ============================================================================
  // END-DEVICE COMMAND PROMPT (PC, Laptop, Server, Printer)
  // ============================================================================
  if (device.type === 'pc' || device.type === 'laptop' || device.type === 'server' || device.type === 'printer') {
    const intf = device.interfaces[0];

    if (cmd === 'ipconfig') {
      const subFlag = tokens[1]?.toLowerCase();
      if (subFlag === '/renew') {
        const dhcpRes = requestDhcpLease(device.id, devices, links);
        appendOut(dhcpRes.message, dhcpRes.success ? 'success' : 'error');
        return {
          updatedDevices: dhcpRes.updatedDevices,
          updatedSession: nextSession,
        };
      }

      const lines = [
        'NetLab Workstation IP Configuration',
        '',
        `Ethernet adapter ${intf.name}:`,
        `   Connection-specific DNS Suffix  . : netlab.local`,
      ];
      if (subFlag === '/all') {
        lines.push(
          `   Host Name . . . . . . . . . . . . : ${device.hostname}`,
          `   Physical Address. . . . . . . . . : ${intf.macAddress}`,
          `   DHCP Enabled. . . . . . . . . . . : ${device.addressingMode === 'dhcp' ? 'Yes' : 'No'}`
        );
      }
      lines.push(
        `   Link-local IPv6 Address . . . . . : ${intf.ipv6Address || 'fe80::250:79ff:fe66:6401%1'}`,
        `   IPv4 Address. . . . . . . . . . . : ${intf.ipAddress || '0.0.0.0 (Unconfigured)'}`,
        `   Subnet Mask . . . . . . . . . . . : ${intf.subnetMask || '0.0.0.0'}`,
        `   Default Gateway . . . . . . . . . : ${device.defaultGateway || 'None'}`
      );
      if (subFlag === '/all') {
        lines.push(`   DNS Servers . . . . . . . . . . . : ${device.dnsServer || 'None'}`);
      }
      appendOut(lines.join('\n'));
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'arp') {
      const flag = tokens[1]?.toLowerCase();
      if (flag === '-d') {
        device.arpTable = [];
        appendOut('ARP cache cleared.', 'info');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      if (device.arpTable.length === 0) {
        appendOut('No ARP Entries Found.');
      } else {
        const lines = [
          `Interface: ${intf.ipAddress || '0.0.0.0'} --- 0x1`,
          '  Internet Address      Physical Address      Type',
          ...device.arpTable.map(
            (a) => `  ${a.ipAddress.padEnd(22)}${a.macAddress.padEnd(22)}${a.type}`
          ),
        ];
        appendOut(lines.join('\n'));
      }
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'route' && tokens[1]?.toLowerCase() === 'print') {
      const net = getNetworkAddress(intf.ipAddress, intf.subnetMask) || '0.0.0.0';
      const lines = [
        '===========================================================================',
        'IPv4 Route Table',
        '===========================================================================',
        'Active Routes:',
        'Network Destination        Netmask          Gateway       Interface  Metric',
      ];
      if (device.defaultGateway) {
        lines.push(
          `          0.0.0.0          0.0.0.0    ${device.defaultGateway.padStart(13)}   ${(intf.ipAddress || '0.0.0.0').padStart(13)}     25`
        );
      }
      if (intf.ipAddress) {
        lines.push(
          `${net.padStart(17)}  ${intf.subnetMask.padStart(15)}         On-link   ${intf.ipAddress.padStart(13)}    281`
        );
      }
      lines.push('===========================================================================');
      appendOut(lines.join('\n'));
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'ping' || cmd === 'tracert' || cmd === 'traceroute') {
      const target = tokens[1];
      if (!target) {
        appendOut(`Usage: ${cmd} <destination-ip-or-hostname>`, 'error');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      const simResult = runPacketSimulation(device.id, target, 'ICMP', devices, links);
      const rtt = simResult.session.rttMs || 4;
      if (cmd === 'ping') {
        appendOut(`Pinging ${target} with 32 bytes of data:`);
        if (simResult.session.overallSuccess) {
          for (let i = 0; i < 4; i++) {
            appendOut(`Reply from ${simResult.session.targetIp}: bytes=32 time=${rtt}ms TTL=64`, 'success');
          }
          appendOut(
            `\nPing statistics for ${simResult.session.targetIp}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = ${rtt}ms, Maximum = ${rtt + 2}ms, Average = ${rtt}ms`
          );
        } else {
          appendOut(`Request timed out. (${simResult.session.summaryMessage})`, 'error');
          appendOut(
            `\nPing statistics for ${target}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)`
          );
        }
      } else {
        appendOut(`Tracing route to ${target} over a maximum of 30 hops:\n`);
        const l3Hops = simResult.session.events.filter((e) => e.action === 'receive' || e.action === 'reply');
        l3Hops.forEach((hop, idx) => {
          appendOut(`  ${idx + 1}     2 ms     2 ms     2 ms  ${hop.toDeviceName || hop.fromDeviceName} [${hop.dstIp}]`);
        });
        appendOut(simResult.session.overallSuccess ? '\nTrace complete.' : `\nTrace interrupted: ${simResult.session.summaryMessage}`);
      }
      return {
        updatedDevices: simResult.updatedDevices,
        updatedSession: nextSession,
        triggeredSimulation: simResult.session,
      };
    }

    if (cmd === 'nslookup') {
      const host = tokens[1];
      if (!host) {
        appendOut('Usage: nslookup <hostname>', 'error');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      const simResult = runPacketSimulation(device.id, host, 'DNS', devices, links);
      appendOut(`Server:  ${device.dnsServer || 'Unconfigured'}\nAddress: ${device.dnsServer || '0.0.0.0'}\n`);
      if (simResult.session.overallSuccess) {
        appendOut(`Non-authoritative answer:\nName:    ${host}\nAddress: ${simResult.session.targetIp}`, 'success');
      } else {
        appendOut(`*** Can't find ${host}: ${simResult.session.summaryMessage}`, 'error');
      }
      return {
        updatedDevices: simResult.updatedDevices,
        updatedSession: nextSession,
        triggeredSimulation: simResult.session,
      };
    }

    if (cmd === 'dir' || cmd === 'ls') {
      const files = device.fileSystem?.files || [];
      const lines = [
        ` Volume in drive C is ${device.hostname}_OS`,
        ` Directory of C:\\Users\\${device.hostname}`,
        '',
        ...files.map((f) => {
          const dateStr = new Date(f.updatedAt).toLocaleString();
          const typeCol = f.type === 'folder' ? '<DIR>     ' : String(f.sizeBytes).padStart(10, ' ');
          const shareBadge = f.isShared ? ' [SHARED]' : '';
          return `${dateStr.padEnd(22)} ${typeCol}  ${f.name}${shareBadge}`;
        }),
        `               ${files.filter((f) => f.type === 'file').length} File(s)    ${files.reduce((acc, f) => acc + f.sizeBytes, 0)} bytes`,
      ];
      appendOut(lines.join('\n'));
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'type' || cmd === 'cat') {
      const targetName = tokens.slice(1).join(' ');
      if (!targetName) {
        appendOut(`Usage: ${cmd} <filename>`, 'error');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      const match = device.fileSystem?.files.find(
        (f) => f.type === 'file' && f.name.toLowerCase() === targetName.toLowerCase()
      );
      if (!match) {
        appendOut(`The system cannot find the file specified: ${targetName}`, 'error');
      } else {
        appendOut(match.content || '(Empty file)');
      }
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'net') {
      const sub = tokens[1]?.toLowerCase();
      if (sub === 'view' || sub === 'share') {
        const targetHost = tokens[2]?.replace(/^\\\\/, '');
        if (targetHost) {
          const simResult = runPacketSimulation(device.id, targetHost, 'SMB', devices, links);
          if (simResult.session.overallSuccess) {
            const peer = simResult.updatedDevices.find((d) =>
              d.interfaces.some((i) => i.ipAddress === simResult.session.targetIp)
            );
            const sharedFiles = peer?.fileSystem?.files.filter((f) => f.isShared) || [];
            appendOut(
              `Shared resources at \\\\${peer?.name || targetHost} (${simResult.session.targetIp}):\nShare name: ${peer?.fileSystem?.shareName || 'SharedDocs'} (TCP Port 445 SMB)\nShared items (${sharedFiles.length}):\n` +
                sharedFiles.map((f) => `  - ${f.name} (${f.type === 'folder' ? 'Folder' : `${f.sizeBytes} B`})`).join('\n'),
              'success'
            );
          } else {
            appendOut(`System error 53 has occurred. ${simResult.session.summaryMessage}`, 'error');
          }
          return {
            updatedDevices: simResult.updatedDevices,
            updatedSession: nextSession,
            triggeredSimulation: simResult.session,
          };
        }
        const localShares = device.fileSystem?.files.filter((f) => f.isShared) || [];
        appendOut(
          `Local SMB Share Status: ${device.fileSystem?.smbSharingEnabled ? 'ACTIVE (TCP 445)' : 'DISABLED'}\nShare Name: \\\\${intf.ipAddress || device.hostname}\\${device.fileSystem?.shareName || 'SharedDocs'}\nShared items: ${localShares.map((f) => f.name).join(', ') || 'None'}`
        );
        return { updatedDevices: devices, updatedSession: nextSession };
      }
    }

    appendOut(
      `'${cmd}' is not recognized as an internal or external command. Type 'help' or '?' for supported commands.`,
      'error'
    );
    return { updatedDevices: devices, updatedSession: nextSession };
  }

  // ============================================================================
  // CISCO IOS CLI PARSER (Routers, L2 Switches, L3 Switches, Firewalls)
  // ============================================================================

  // Universal mode transitions: end
  if (cmd === 'end' && session.mode !== 'user_exec') {
    nextSession.mode = 'priv_exec';
    nextSession.selectedInterfaceId = undefined;
    nextSession.selectedVlanId = undefined;
    appendOut(`%SYS-5-CONFIG_I: Configured from console by console`, 'info');
    return { updatedDevices: synchronizeNetworkState(devices, links).devices, updatedSession: nextSession };
  }

  // Universal exit
  if (cmd === 'exit') {
    if (
      session.mode === 'interface_config' ||
      session.mode === 'vlan_config' ||
      session.mode === 'router_ospf_config' ||
      session.mode === 'router_rip_config'
    ) {
      nextSession.mode = 'global_config';
      nextSession.selectedInterfaceId = undefined;
      nextSession.selectedVlanId = undefined;
    } else if (session.mode === 'global_config') {
      nextSession.mode = 'priv_exec';
      appendOut(`%SYS-5-CONFIG_I: Configured from console by console`, 'info');
    } else if (session.mode === 'priv_exec') {
      nextSession.mode = 'user_exec';
    }
    return { updatedDevices: synchronizeNetworkState(devices, links).devices, updatedSession: nextSession };
  }

  // USER EXEC MODE
  if (session.mode === 'user_exec') {
    if (cmd === 'enable' || cmd === 'en') {
      nextSession.mode = 'priv_exec';
      return { updatedDevices: devices, updatedSession: nextSession };
    }
    if (cmd === 'ping' || cmd === 'traceroute') {
      const target = tokens[1];
      if (!target) {
        appendOut('% Incomplete command. Usage: ping <ip-address>', 'error');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      const simResult = runPacketSimulation(device.id, target, 'ICMP', devices, links);
      appendOut(
        `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${simResult.session.targetIp}, timeout is 2 seconds:`
      );
      if (simResult.session.overallSuccess) {
        appendOut('!!!!!', 'success');
        appendOut(`Success rate is 100 percent (5/5), round-trip min/avg/max = 1/4/8 ms`, 'success');
      } else {
        appendOut('.....', 'error');
        appendOut(`Success rate is 0 percent (0/5) — ${simResult.session.summaryMessage}`, 'error');
      }
      return {
        updatedDevices: simResult.updatedDevices,
        updatedSession: nextSession,
        triggeredSimulation: simResult.session,
      };
    }
    if (cmd !== 'show' && cmd !== 'sh') {
      appendOut(`% Invalid input detected at '^' marker. Type '?' for available commands.`, 'error');
      return { updatedDevices: devices, updatedSession: nextSession };
    }
  }

  // SHOW COMMANDS (Supported in User EXEC, Privileged EXEC, or via "do show" in Config modes)
  const isDoShow = cmd === 'do' && (tokens[1]?.toLowerCase() === 'show' || tokens[1]?.toLowerCase() === 'sh');
  if (cmd === 'show' || cmd === 'sh' || isDoShow) {
    const showTokens = isDoShow ? tokens.slice(2) : tokens.slice(1);
    const sub1 = showTokens[0]?.toLowerCase();
    const sub2 = showTokens[1]?.toLowerCase();
    const sub3 = showTokens[2]?.toLowerCase();

    if (!sub1) {
      appendOut('% Incomplete command. Try: show ip interface brief, show ip route, show running-config, show vlan brief', 'error');
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (sub1.startsWith('run')) {
      appendOut(generateRunningConfigText(device));
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (sub1.startsWith('start')) {
      if (!device.startupConfigSaved) {
        appendOut('startup-config is not present or has unsaved changes.');
      } else {
        appendOut(generateRunningConfigText(device));
      }
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (sub1 === 'version' || sub1 === 'ver') {
      appendOut(
        [
          `Cisco IOS Software, NetLab Virtual Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 15.4(3)M2`,
          `ROM: IOS-XE ROMMON`,
          `${device.hostname} uptime is 2 hours, 14 minutes`,
          `Cisco ${device.model} (1RU) processor with 524288K/65536K bytes of memory.`,
          `${device.interfaces.length} Network Interface(s)`,
          `Configuration register is 0x2102`,
        ].join('\n')
      );
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (sub1 === 'ip' && sub2?.startsWith('int')) {
      const lines = [
        'Interface              IP-Address      OK? Method Status                Protocol',
        ...device.interfaces.map((i) => {
          const ip = (i.ipAddress || 'unassigned').padEnd(15);
          const status = (i.adminUp ? (i.lineProtocolUp ? 'up' : 'down') : 'administratively down').padEnd(21);
          const proto = i.lineProtocolUp ? 'up' : 'down';
          return `${i.name.padEnd(22)} ${ip} YES manual ${status} ${proto}`;
        }),
      ];
      appendOut(lines.join('\n'));
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (sub1 === 'ip' && sub2?.startsWith('rou')) {
      const lines = [
        'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP',
        '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area',
        '       * - candidate default',
        '',
        'Gateway of last resort is ' +
          (device.routingTable.find((r) => r.network === '0.0.0.0')?.nextHop || 'not set'),
        '',
      ];
      if (device.routingTable.length === 0) {
        lines.push('No active IPv4 routes in routing table.');
      } else {
        for (const r of device.routingTable) {
          const cidr = r.network === '0.0.0.0' ? 0 : maskToCidr(r.mask);
          if (r.type === 'C') {
            lines.push(`C    ${r.network}/${cidr} is directly connected, ${r.interfaceName}`);
          } else {
            lines.push(
              `${r.type.padEnd(4)} ${r.network}/${cidr} [${r.administrativeDistance}/${r.metric}] via ${r.nextHop}, ${r.interfaceName}`
            );
          }
        }
      }
      appendOut(lines.join('\n'));
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (sub1 === 'arp' || (sub1 === 'ip' && sub2 === 'arp')) {
      const lines = [
        'Protocol  Address          Age (min)  Hardware Addr   Type   Interface',
        ...device.interfaces
          .filter((i) => i.ipAddress && i.adminUp)
          .map(
            (i) =>
              `Internet  ${i.ipAddress.padEnd(16)}        -   ${i.macAddress}  ARPA   ${i.shortName}`
          ),
        ...device.arpTable.map(
          (a) =>
            `Internet  ${a.ipAddress.padEnd(16)}        1   ${a.macAddress}  ARPA   ${a.interfaceName}`
        ),
      ];
      appendOut(lines.join('\n'));
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (sub1 === 'vlan') {
      const lines = [
        'VLAN Name                             Status    Ports',
        '---- -------------------------------- --------- -------------------------------',
        ...device.vlans.map((v) => {
          const ports = device.interfaces
            .filter((i) => i.switchportMode === 'access' && i.accessVlan === v.id)
            .map((i) => i.shortName)
            .join(', ');
          return `${String(v.id).padEnd(4)} ${v.name.padEnd(32)} ${v.status.padEnd(9)} ${ports}`;
        }),
      ];
      appendOut(lines.join('\n'));
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (sub1 === 'mac' || (sub1 === 'mac-address-table')) {
      const lines = [
        '          Mac Address Table',
        '-------------------------------------------',
        'Vlan    Mac Address       Type        Ports',
        '----    -----------       --------    -----',
        ...device.macTable.map(
          (m) =>
            `${String(m.vlan).padStart(4)}    ${m.macAddress}   ${m.type.padEnd(10)}  ${m.interfaceName}`
        ),
      ];
      if (device.macTable.length === 0) {
        lines.push('  (No dynamic MAC entries learned yet; run a ping to populate)');
      }
      appendOut(lines.join('\n'));
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (sub1.startsWith('int')) {
      const lines = device.interfaces.map((i) => {
        const state = i.adminUp ? (i.lineProtocolUp ? 'up' : 'down') : 'administratively down';
        const proto = i.lineProtocolUp ? 'up' : 'down';
        return `${i.name} is ${state}, line protocol is ${proto}\n  Hardware is ${i.mediaType}, address is ${i.macAddress}\n  Internet address is ${
          i.ipAddress ? `${i.ipAddress}/${maskToCidr(i.subnetMask)}` : 'unassigned'
        }\n  Switchport mode: ${i.switchportMode}, Access VLAN: ${i.accessVlan}`;
      });
      appendOut(lines.join('\n\n'));
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (sub1 === 'access-lists' || (sub1 === 'ip' && sub2 === 'access-lists')) {
      if (device.acls.length === 0) {
        appendOut('No IP access lists configured.');
      } else {
        const lines = device.acls.map(
          (a, idx) =>
            `Access list ${a.aclNumber}: ${(idx + 1) * 10} ${a.action} ${a.protocol} ${a.sourceIp} ${a.sourceWildcard} ${a.destIp} ${a.destWildcard}`
        );
        appendOut(lines.join('\n'));
      }
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    appendOut(`% Unrecognized show subcommand "${sub1} ${sub2 || ''} ${sub3 || ''}". Type '?' for options.`, 'error');
    return { updatedDevices: devices, updatedSession: nextSession };
  }

  // PRIVILEGED EXEC MODE
  if (session.mode === 'priv_exec') {
    if (cmd === 'disable') {
      nextSession.mode = 'user_exec';
      return { updatedDevices: devices, updatedSession: nextSession };
    }
    if (cmd === 'configure' || cmd === 'conf') {
      nextSession.mode = 'global_config';
      appendOut('Enter configuration commands, one per line. End with CNTL/Z or "end".', 'info');
      return { updatedDevices: devices, updatedSession: nextSession };
    }
    if (
      (cmd === 'copy' && tokens[1]?.startsWith('run') && tokens[2]?.startsWith('start')) ||
      (cmd === 'write' && (!tokens[1] || tokens[1].startsWith('mem'))) ||
      cmd === 'wr'
    ) {
      device.startupConfigSaved = true;
      appendOut('Building configuration...\n[OK]', 'success');
      return { updatedDevices: devices, updatedSession: nextSession };
    }
    if (cmd === 'ping' || cmd === 'traceroute') {
      const target = tokens[1];
      if (!target) {
        appendOut('% Incomplete command. Usage: ping <ip-address>', 'error');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      const simResult = runPacketSimulation(device.id, target, 'ICMP', devices, links);
      appendOut(
        `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${simResult.session.targetIp}, timeout is 2 seconds:`
      );
      if (simResult.session.overallSuccess) {
        appendOut('!!!!!', 'success');
        appendOut(`Success rate is 100 percent (5/5), round-trip min/avg/max = 1/4/8 ms`, 'success');
      } else {
        appendOut('.....', 'error');
        appendOut(`Success rate is 0 percent (0/5) — ${simResult.session.summaryMessage}`, 'error');
      }
      return {
        updatedDevices: simResult.updatedDevices,
        updatedSession: nextSession,
        triggeredSimulation: simResult.session,
      };
    }

    appendOut(`% Unknown command "${trimmed}" in Privileged EXEC mode. Type '?' for help.`, 'error');
    return { updatedDevices: devices, updatedSession: nextSession };
  }

  // GLOBAL CONFIGURATION MODE
  if (session.mode === 'global_config') {
    if (cmd === 'hostname') {
      const newName = tokens[1];
      if (!newName) {
        appendOut('% Incomplete command. Usage: hostname <name>', 'error');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      device.hostname = newName;
      device.name = newName;
      device.startupConfigSaved = false;
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'interface' || cmd === 'int') {
      const intfArg = tokens.slice(1).join('');
      if (!intfArg) {
        appendOut('% Incomplete command. Specify an interface name (e.g., interface Gi0/0).', 'error');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      const matched = matchInterfaceByName(device, intfArg);
      if (!matched) {
        appendOut(
          `% Invalid interface "${intfArg}" on ${device.model}. Available interfaces: ${device.interfaces
            .map((i) => i.shortName)
            .join(', ')}`,
          'error'
        );
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      nextSession.mode = 'interface_config';
      nextSession.selectedInterfaceId = matched.id;
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'vlan') {
      const vlanId = parseInt(tokens[1], 10);
      if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
        appendOut('% Invalid VLAN ID. Specify a VLAN number between 1 and 4094.', 'error');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      let existing = device.vlans.find((v) => v.id === vlanId);
      if (!existing) {
        existing = { id: vlanId, name: `VLAN${String(vlanId).padStart(4, '0')}`, status: 'active' };
        device.vlans.push(existing);
      }
      device.startupConfigSaved = false;
      nextSession.mode = 'vlan_config';
      nextSession.selectedVlanId = vlanId;
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'ip' && tokens[1]?.toLowerCase() === 'routing') {
      device.ipRoutingEnabled = true;
      device.startupConfigSaved = false;
      appendOut('Layer 3 IPv4 routing enabled.', 'info');
      return { updatedDevices: synchronizeNetworkState(devices, links).devices, updatedSession: nextSession };
    }

    if (cmd === 'ip' && tokens[1]?.toLowerCase() === 'route') {
      const net = tokens[2];
      const mask = tokens[3];
      const nextHop = tokens[4];
      if (!isValidIpv4(net) || (mask !== '0.0.0.0' && !isValidSubnetMask(mask)) || !isValidIpv4(nextHop)) {
        appendOut('% Invalid static route syntax. Usage: ip route <network> <mask> <next-hop-ip>', 'error');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      const normalizedNet = mask === '0.0.0.0' ? '0.0.0.0' : getNetworkAddress(net, mask);
      device.routingTable = device.routingTable.filter(
        (r) => !(r.type.startsWith('S') && r.network === normalizedNet && r.mask === mask)
      );
      device.routingTable.push({
        id: `static-${Date.now()}`,
        type: normalizedNet === '0.0.0.0' ? 'S*' : 'S',
        network: normalizedNet,
        mask,
        nextHop,
        interfaceName: 'Dynamic',
        administrativeDistance: 1,
        metric: 0,
      });
      device.startupConfigSaved = false;
      return { updatedDevices: synchronizeNetworkState(devices, links).devices, updatedSession: nextSession };
    }

    if (cmd === 'no' && tokens[1]?.toLowerCase() === 'ip' && tokens[2]?.toLowerCase() === 'route') {
      const net = tokens[3];
      const mask = tokens[4];
      device.routingTable = device.routingTable.filter(
        (r) => !(r.type.startsWith('S') && r.network === net && (!mask || r.mask === mask))
      );
      device.startupConfigSaved = false;
      return { updatedDevices: synchronizeNetworkState(devices, links).devices, updatedSession: nextSession };
    }

    if (cmd === 'router') {
      const proto = tokens[1]?.toLowerCase();
      if (proto === 'ospf') {
        const pid = parseInt(tokens[2] || '1', 10);
        device.ospfEnabled = true;
        device.ospfProcessId = isNaN(pid) ? 1 : pid;
        nextSession.mode = 'router_ospf_config';
        return { updatedDevices: synchronizeNetworkState(devices, links).devices, updatedSession: nextSession };
      }
      if (proto === 'rip') {
        device.ripEnabled = true;
        nextSession.mode = 'router_rip_config';
        return { updatedDevices: synchronizeNetworkState(devices, links).devices, updatedSession: nextSession };
      }
      appendOut('% Supported routing protocols in NetLab Simulator: ospf, rip', 'error');
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'access-list') {
      const aclNum = parseInt(tokens[1], 10);
      const action = tokens[2]?.toLowerCase() as 'permit' | 'deny';
      if (isNaN(aclNum) || (action !== 'permit' && action !== 'deny')) {
        appendOut(
          '% Usage: access-list <1-199> <permit|deny> <ip|icmp|tcp|udp> <src-ip|any> [src-wildcard] <dst-ip|any> [dst-wildcard]',
          'error'
        );
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      const protoToken = tokens[3]?.toLowerCase();
      const isExtended = ['ip', 'icmp', 'tcp', 'udp'].includes(protoToken);
      const protocol = (isExtended ? protoToken : 'ip') as 'ip' | 'icmp' | 'tcp' | 'udp';
      const srcIp = (isExtended ? tokens[4] : tokens[3]) || 'any';
      const srcWc = (isExtended ? tokens[5] : tokens[4]) || '0.0.0.0';
      const dstIp = (isExtended ? tokens[6] : 'any') || 'any';
      const dstWc = (isExtended ? tokens[7] : '0.0.0.0') || '0.0.0.0';

      device.acls.push({
        id: `acl-${Date.now()}-${Math.random()}`,
        aclNumber: aclNum,
        action,
        protocol,
        sourceIp: srcIp,
        sourceWildcard: srcWc,
        destIp: dstIp,
        destWildcard: dstWc,
      });
      device.startupConfigSaved = false;
      appendOut(`ACL ${aclNum} rule added (${action} ${protocol} ${srcIp} -> ${dstIp}).`, 'info');
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'no' && tokens[1]?.toLowerCase() === 'access-list') {
      const aclNum = parseInt(tokens[2], 10);
      device.acls = isNaN(aclNum) ? [] : device.acls.filter((a) => a.aclNumber !== aclNum);
      appendOut(`Access-list ${aclNum || 'all'} removed.`, 'info');
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    appendOut(`% Invalid command "${trimmed}" in Global Configuration mode. Type '?' for help.`, 'error');
    return { updatedDevices: devices, updatedSession: nextSession };
  }

  // INTERFACE CONFIGURATION MODE
  if (session.mode === 'interface_config') {
    const intf = device.interfaces.find((i) => i.id === session.selectedInterfaceId);
    if (!intf) {
      nextSession.mode = 'global_config';
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'interface' || cmd === 'int') {
      const matched = matchInterfaceByName(device, tokens.slice(1).join(''));
      if (matched) {
        nextSession.selectedInterfaceId = matched.id;
        return { updatedDevices: devices, updatedSession: nextSession };
      }
    }

    if (cmd === 'no' && tokens[1]?.toLowerCase().startsWith('shut')) {
      intf.adminUp = true;
      device.startupConfigSaved = false;
      const synced = synchronizeNetworkState(devices, links);
      appendOut(`%LINK-3-UPDOWN: Interface ${intf.name}, changed state to up`, 'success');
      return { updatedDevices: synced.devices, updatedSession: nextSession };
    }

    if (cmd.startsWith('shut')) {
      intf.adminUp = false;
      device.startupConfigSaved = false;
      const synced = synchronizeNetworkState(devices, links);
      appendOut(`%LINK-5-CHANGED: Interface ${intf.name}, changed state to administratively down`, 'info');
      return { updatedDevices: synced.devices, updatedSession: nextSession };
    }

    if (cmd === 'ip' && tokens[1]?.toLowerCase().startsWith('addr')) {
      const ip = tokens[2];
      const mask = tokens[3];
      if (!isValidIpv4(ip) || !isValidSubnetMask(mask)) {
        appendOut('% Invalid IPv4 address or subnet mask. Usage: ip address <ip> <subnet-mask>', 'error');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      intf.ipAddress = ip;
      intf.subnetMask = mask;
      intf.switchportMode = 'routed';
      device.startupConfigSaved = false;
      return { updatedDevices: synchronizeNetworkState(devices, links).devices, updatedSession: nextSession };
    }

    if (cmd === 'no' && tokens[1]?.toLowerCase() === 'ip' && tokens[2]?.toLowerCase().startsWith('addr')) {
      intf.ipAddress = '';
      intf.subnetMask = '';
      device.startupConfigSaved = false;
      return { updatedDevices: synchronizeNetworkState(devices, links).devices, updatedSession: nextSession };
    }

    if (cmd === 'description' || cmd === 'desc') {
      intf.description = tokens.slice(1).join(' ');
      device.startupConfigSaved = false;
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'no' && tokens[1]?.toLowerCase() === 'switchport') {
      intf.switchportMode = 'routed';
      device.startupConfigSaved = false;
      return { updatedDevices: devices, updatedSession: nextSession };
    }

    if (cmd === 'switchport' || cmd === 'sw') {
      const sub = tokens[1]?.toLowerCase();
      if (sub === 'mode') {
        const modeArg = tokens[2]?.toLowerCase();
        if (modeArg === 'access' || modeArg === 'trunk') {
          intf.switchportMode = modeArg;
          device.startupConfigSaved = false;
          return { updatedDevices: devices, updatedSession: nextSession };
        }
        appendOut('% Specify switchport mode: access or trunk', 'error');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      if (sub === 'access' && tokens[2]?.toLowerCase() === 'vlan') {
        const vlanId = parseInt(tokens[3], 10);
        if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
          appendOut('% Invalid VLAN ID.', 'error');
          return { updatedDevices: devices, updatedSession: nextSession };
        }
        intf.accessVlan = vlanId;
        if (!device.vlans.some((v) => v.id === vlanId)) {
          device.vlans.push({
            id: vlanId,
            name: `VLAN${String(vlanId).padStart(4, '0')}`,
            status: 'active',
          });
          appendOut(`% Access VLAN does not exist. Creating vlan ${vlanId}`, 'info');
        }
        device.startupConfigSaved = false;
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      if (sub === 'trunk' && tokens[2]?.toLowerCase() === 'allowed' && tokens[3]?.toLowerCase() === 'vlan') {
        const listArg = tokens[4]?.toLowerCase();
        if (listArg === 'all') {
          intf.trunkAllowedVlans = [1, 10, 20, 30, 40, 50, 99, 100];
        } else if (listArg === 'add' && tokens[5]) {
          const added = tokens[5]
            .split(',')
            .map((n) => parseInt(n, 10))
            .filter((n) => !isNaN(n));
          intf.trunkAllowedVlans = Array.from(new Set([...intf.trunkAllowedVlans, ...added]));
        } else if (listArg) {
          const parsed = listArg
            .split(',')
            .map((n) => parseInt(n, 10))
            .filter((n) => !isNaN(n));
          if (parsed.length > 0) intf.trunkAllowedVlans = parsed;
        }
        device.startupConfigSaved = false;
        return { updatedDevices: devices, updatedSession: nextSession };
      }
    }

    if (cmd === 'ip' && tokens[1]?.toLowerCase() === 'access-group') {
      const aclNum = parseInt(tokens[2], 10);
      const dir = tokens[3]?.toLowerCase();
      if (!isNaN(aclNum) && (dir === 'in' || dir === 'out')) {
        if (dir === 'in') intf.aclIn = aclNum;
        else intf.aclOut = aclNum;
        device.startupConfigSaved = false;
        return { updatedDevices: devices, updatedSession: nextSession };
      }
    }

    if (cmd === 'ip' && tokens[1]?.toLowerCase() === 'nat') {
      const dir = tokens[2]?.toLowerCase();
      if (dir === 'inside' || dir === 'outside') {
        intf.natDirection = dir;
        device.natEnabled = true;
        device.startupConfigSaved = false;
        return { updatedDevices: devices, updatedSession: nextSession };
      }
    }

    appendOut(`% Invalid command "${trimmed}" in Interface Configuration mode. Type '?' for help.`, 'error');
    return { updatedDevices: devices, updatedSession: nextSession };
  }

  // VLAN CONFIGURATION MODE
  if (session.mode === 'vlan_config') {
    if (cmd === 'name' && tokens[1]) {
      const v = device.vlans.find((vl) => vl.id === session.selectedVlanId);
      if (v) {
        v.name = tokens[1];
        device.startupConfigSaved = false;
      }
      return { updatedDevices: devices, updatedSession: nextSession };
    }
    appendOut(`% Invalid command in VLAN mode. Use 'name <vlan-name>' or 'exit'.`, 'error');
    return { updatedDevices: devices, updatedSession: nextSession };
  }

  // ROUTER OSPF / RIP CONFIGURATION MODE
  if (session.mode === 'router_ospf_config' || session.mode === 'router_rip_config') {
    if (cmd === 'network') {
      const net = tokens[1];
      if (!isValidIpv4(net)) {
        appendOut('% Specify a valid network IPv4 address.', 'error');
        return { updatedDevices: devices, updatedSession: nextSession };
      }
      if (session.mode === 'router_ospf_config') {
        const wc = tokens[2] || '0.0.0.255';
        const area = parseInt(tokens[4] || '0', 10);
        device.ospfNetworks = [...(device.ospfNetworks || []), { network: net, wildcard: wc, area: isNaN(area) ? 0 : area }];
      } else {
        device.ripNetworks = [...(device.ripNetworks || []), net];
      }
      device.startupConfigSaved = false;
      return { updatedDevices: synchronizeNetworkState(devices, links).devices, updatedSession: nextSession };
    }
    if (cmd === 'version') {
      return { updatedDevices: devices, updatedSession: nextSession };
    }
  }

  appendOut(`% Unrecognized command "${trimmed}". Type '?' for supported commands.`, 'error');
  return { updatedDevices: devices, updatedSession: nextSession };
}
