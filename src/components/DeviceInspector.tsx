import React, { useState } from 'react';
import {
  Terminal,
  Monitor,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
  Info,
  Shield,
  Server,
} from 'lucide-react';
import {
  NetworkDevice,
  NetworkInterface,
  NetworkLink,
  RouteEntry,
} from '../types/network';
import { isValidIpv4, isValidSubnetMask, maskToCidr } from '../utils/networkMath';
import { generateRunningConfigText } from '../engine/cliParser';

interface DeviceInspectorProps {
  device: NetworkDevice | null;
  allDevices: NetworkDevice[];
  links: NetworkLink[];
  onUpdateDevice: (updated: NetworkDevice) => void;
  onRequestDhcp: (deviceId: string) => void;
  onRunPing: (srcDeviceId: string, targetIp: string) => void;
  onOpenCli: (deviceId: string) => void;
  onOpenDesktop: (deviceId: string) => void;
}

export const DeviceInspector: React.FC<DeviceInspectorProps> = ({
  device,
  allDevices,
  onUpdateDevice,
  onRequestDhcp,
  onRunPing,
  onOpenCli,
  onOpenDesktop,
}) => {
  const [activeTab, setActiveTab] = useState<'interfaces' | 'routing' | 'tables' | 'config'>('interfaces');
  const [selectedIfIndex, setSelectedIfIndex] = useState<number>(0);

  React.useEffect(() => {
    setSelectedIfIndex(0);
  }, [device?.id]);

  // New static route inputs
  const [newRouteNet, setNewRouteNet] = useState('192.168.20.0');
  const [newRouteMask, setNewRouteMask] = useState('255.255.255.0');
  const [newRouteHop, setNewRouteHop] = useState('10.0.0.2');

  // New VLAN inputs
  const [newVlanId, setNewVlanId] = useState('30');
  const [newVlanName, setNewVlanName] = useState('GUESTS');

  // Quick Ping test input inside inspector
  const [testTargetIp, setTestTargetIp] = useState('192.168.1.20');

  if (!device) {
    return (
      <aside className="hidden xl:flex flex-col w-80 border-l border-slate-800 bg-slate-900/80 p-5 shrink-0 justify-center items-center text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
          <Info className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200">No Device Selected</h3>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Click any PC, router, switch, or server on the topology canvas to inspect and configure its interfaces, IPv4/IPv6 addressing, VLANs, routing tables, or IOS CLI.
        </p>
      </aside>
    );
  }

  const safeIfIndex = Math.min(selectedIfIndex, Math.max(0, device.interfaces.length - 1));
  const currentIntf: NetworkInterface | undefined = device.interfaces[safeIfIndex];

  const handleInterfaceChange = (patch: Partial<NetworkInterface>) => {
    if (!currentIntf) return;
    const nextInterfaces = device.interfaces.map((item, idx) =>
      idx === safeIfIndex ? { ...item, ...patch } : item
    );
    onUpdateDevice({
      ...device,
      interfaces: nextInterfaces,
      startupConfigSaved: false,
    });
  };

  const handleAddStaticRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidIpv4(newRouteNet) || (newRouteMask !== '0.0.0.0' && !isValidSubnetMask(newRouteMask)) || !isValidIpv4(newRouteHop)) {
      return;
    }
    const route: RouteEntry = {
      id: `sr-${Date.now()}`,
      type: newRouteNet === '0.0.0.0' ? 'S*' : 'S',
      network: newRouteNet,
      mask: newRouteMask,
      nextHop: newRouteHop,
      interfaceName: 'Static',
      administrativeDistance: 1,
      metric: 0,
    };
    onUpdateDevice({
      ...device,
      routingTable: [...device.routingTable, route],
      startupConfigSaved: false,
    });
  };

  const handleAddVlan = (e: React.FormEvent) => {
    e.preventDefault();
    const idNum = parseInt(newVlanId, 10);
    if (isNaN(idNum) || idNum < 1 || idNum > 4094 || !newVlanName.trim()) return;
    if (device.vlans.some((v) => v.id === idNum)) return;
    onUpdateDevice({
      ...device,
      vlans: [...device.vlans, { id: idNum, name: newVlanName.trim().toUpperCase(), status: 'active' }],
      startupConfigSaved: false,
    });
  };

  const isEndDevice =
    device.type === 'pc' || device.type === 'laptop' || device.type === 'server' || device.type === 'printer';
  const isSwitch = device.type === 'l2-switch' || device.type === 'l3-switch';
  const isRouterOrL3 =
    device.type === 'router' ||
    device.type === 'l3-switch' ||
    device.type === 'firewall' ||
    device.type === 'wireless-router';

  return (
    <aside className="flex flex-col w-full xl:w-88 border-l border-slate-800 bg-slate-900/90 shrink-0 h-full overflow-hidden">
      {/* Device Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-cyan-400">{device.model}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <input
                type="text"
                value={device.name}
                onChange={(e) =>
                  onUpdateDevice({
                    ...device,
                    name: e.target.value,
                    hostname: e.target.value,
                  })
                }
                aria-label="Device hostname"
                className="text-sm font-bold text-white bg-slate-900 border border-slate-700 rounded px-2 py-0.5 w-36 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[11px] font-mono text-slate-400">
                {device.interfaces[0]?.macAddress}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onOpenCli(device.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-colors whitespace-nowrap"
            >
              <Terminal className="w-3.5 h-3.5" /> CLI
            </button>
            {isEndDevice && device.type !== 'printer' && (
              <button
                onClick={() => onOpenDesktop(device.id)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                <Monitor className="w-3.5 h-3.5 text-emerald-400" /> Apps
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mt-3 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {(
            [
              { id: 'interfaces', label: 'Interfaces' },
              { id: 'routing', label: isSwitch ? 'VLANs / L3' : 'Routing' },
              { id: 'tables', label: 'ARP / MAC' },
              { id: 'config', label: 'IOS / Info' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-slate-800 text-cyan-300 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inspector Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
        {activeTab === 'interfaces' && currentIntf && (
          <>
            {/* Interface Selector */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                Select Physical / Virtual Interface
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {device.interfaces.map((intf, idx) => (
                  <button
                    key={intf.id}
                    onClick={() => setSelectedIfIndex(idx)}
                    className={`px-2 py-1.5 rounded border text-left font-mono transition-colors ${
                      idx === safeIfIndex
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px]">{intf.shortName}</span>
                      <span
                        className={`text-[9px] font-bold ${
                          intf.adminUp && intf.lineProtocolUp
                            ? 'text-emerald-400'
                            : intf.adminUp
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {intf.adminUp && intf.lineProtocolUp ? 'UP' : intf.adminUp ? 'WAIT' : 'OFF'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Interface Details Card */}
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <div className="font-semibold text-slate-100">{currentIntf.name}</div>
                  <div className="text-[11px] font-mono text-slate-400">
                    MAC: {currentIntf.macAddress} · {currentIntf.mediaType.toUpperCase()}
                  </div>
                </div>
                <button
                  onClick={() => handleInterfaceChange({ adminUp: !currentIntf.adminUp })}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors whitespace-nowrap ${
                    currentIntf.adminUp
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {currentIntf.adminUp ? 'Enabled (Up)' : 'Shutdown (Off)'}
                </button>
              </div>

              {/* End Device Static vs DHCP Switch */}
              {isEndDevice && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-slate-300 font-medium">Addressing Mode:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onUpdateDevice({ ...device, addressingMode: 'static' })}
                      className={`px-2.5 py-1 rounded text-xs font-medium ${
                        device.addressingMode !== 'dhcp'
                          ? 'bg-cyan-500 text-slate-950 font-semibold'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      Static
                    </button>
                    <button
                      onClick={() => onRequestDhcp(device.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${
                        device.addressingMode === 'dhcp'
                          ? 'bg-cyan-500 text-slate-950 font-semibold'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <RefreshCw className="w-3 h-3" /> DHCP Lease
                    </button>
                  </div>
                </div>
              )}

              {/* Switchport Mode for Switches */}
              {isSwitch && !currentIntf.name.toLowerCase().startsWith('vlan') && (
                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Switchport Mode</label>
                    <div className="flex gap-1.5">
                      {(['access', 'trunk', ...(device.type === 'l3-switch' ? ['routed'] : [])] as const).map(
                        (mode) => (
                          <button
                            key={mode}
                            onClick={() =>
                              handleInterfaceChange({
                                switchportMode: mode as NetworkInterface['switchportMode'],
                              })
                            }
                            className={`flex-1 py-1 rounded capitalize font-medium border ${
                              currentIntf.switchportMode === mode
                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                                : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}
                          >
                            {mode === 'trunk' ? '802.1Q Trunk' : mode}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {currentIntf.switchportMode === 'access' && (
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Access VLAN Assignment</label>
                      <select
                        value={currentIntf.accessVlan}
                        onChange={(e) =>
                          handleInterfaceChange({ accessVlan: parseInt(e.target.value, 10) })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono"
                      >
                        {device.vlans.map((v) => (
                          <option key={v.id} value={v.id}>
                            VLAN {v.id} — {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {currentIntf.switchportMode === 'trunk' && (
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        802.1Q Allowed VLANs (Comma-separated)
                      </label>
                      <input
                        type="text"
                        value={currentIntf.trunkAllowedVlans.join(',')}
                        onChange={(e) => {
                          const list = e.target.value
                            .split(',')
                            .map((s) => parseInt(s.trim(), 10))
                            .filter((n) => !isNaN(n));
                          handleInterfaceChange({ trunkAllowedVlans: list.length ? list : [1] });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* IPv4 Address & Mask Fields (when routed or end-device) */}
              {(currentIntf.switchportMode === 'routed' || isEndDevice) && (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">IPv4 Address</label>
                    <input
                      type="text"
                      value={currentIntf.ipAddress}
                      onChange={(e) => handleInterfaceChange({ ipAddress: e.target.value })}
                      placeholder="e.g. 192.168.1.10"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Subnet Mask</label>
                    <input
                      type="text"
                      value={currentIntf.subnetMask}
                      onChange={(e) => handleInterfaceChange({ subnetMask: e.target.value })}
                      placeholder="e.g. 255.255.255.0"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* Default Gateway & DNS for End Devices */}
              {isEndDevice && (
                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Default Gateway (Router IP)</label>
                    <input
                      type="text"
                      value={device.defaultGateway}
                      onChange={(e) => onUpdateDevice({ ...device, defaultGateway: e.target.value })}
                      placeholder="e.g. 192.168.1.1"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">DNS Server IPv4</label>
                    <input
                      type="text"
                      value={device.dnsServer}
                      onChange={(e) => onUpdateDevice({ ...device, dnsServer: e.target.value })}
                      placeholder="e.g. 192.168.10.10"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Connectivity Test from This Device */}
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2">
              <div className="font-semibold text-slate-200">Quick ICMP Connectivity Test</div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={testTargetIp}
                  onChange={(e) => setTestTargetIp(e.target.value)}
                  placeholder="Destination IP..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-slate-100"
                />
                <button
                  onClick={() => onRunPing(device.id, testTargetIp)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" /> Ping
                </button>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {allDevices
                  .filter((d) => d.id !== device.id && d.interfaces.some((i) => i.ipAddress))
                  .slice(0, 4)
                  .map((peer) => {
                    const peerIp = peer.interfaces.find((i) => i.ipAddress)?.ipAddress!;
                    return (
                      <button
                        key={peer.id}
                        onClick={() => {
                          setTestTargetIp(peerIp);
                          onRunPing(device.id, peerIp);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-cyan-300 border border-slate-800"
                      >
                        Ping {peer.name} ({peerIp})
                      </button>
                    );
                  })}
              </div>
            </div>
          </>
        )}

        {activeTab === 'routing' && (
          <div className="space-y-4">
            {/* VLAN Database Manager for Switches */}
            {isSwitch && (
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 space-y-3">
                <div className="font-semibold text-slate-200">Switch VLAN Database</div>
                <div className="space-y-1.5">
                  {device.vlans.map((v) => {
                    const assignedPorts = device.interfaces
                      .filter((i) => i.switchportMode === 'access' && i.accessVlan === v.id)
                      .map((i) => i.shortName)
                      .join(', ');
                    return (
                      <div
                        key={v.id}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800"
                      >
                        <div>
                          <span className="font-mono font-bold text-cyan-300">VLAN {v.id}</span>
                          <span className="text-slate-300 ml-2">{v.name}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {assignedPorts || 'No access ports'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={handleAddVlan} className="flex gap-1.5 pt-1">
                  <input
                    type="number"
                    min={2}
                    max={4094}
                    value={newVlanId}
                    onChange={(e) => setNewVlanId(e.target.value)}
                    placeholder="ID"
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono"
                  />
                  <input
                    type="text"
                    value={newVlanName}
                    onChange={(e) => setNewVlanName(e.target.value)}
                    placeholder="VLAN Name"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 font-semibold whitespace-nowrap"
                  >
                    + Add
                  </button>
                </form>
              </div>
            )}

            {/* IPv4 Routing Table & Static Route Form */}
            {isRouterOrL3 ? (
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">IPv4 Routing Table</span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!device.ospfEnabled}
                        onChange={(e) =>
                          onUpdateDevice({ ...device, ospfEnabled: e.target.checked })
                        }
                        className="rounded border-slate-700"
                      />
                      OSPF
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!device.ripEnabled}
                        onChange={(e) =>
                          onUpdateDevice({ ...device, ripEnabled: e.target.checked })
                        }
                        className="rounded border-slate-700"
                      />
                      RIPv2
                    </label>
                  </div>
                </div>

                {device.routingTable.length === 0 ? (
                  <p className="text-slate-400 text-[11px]">
                    No active routes. Enable an interface with an IP address to populate Connected (C) routes.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {device.routingTable.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px]"
                      >
                        <div>
                          <span className="font-bold text-cyan-400 mr-2">{r.type}</span>
                          <span className="text-slate-100">
                            {r.network}/{r.network === '0.0.0.0' ? 0 : maskToCidr(r.mask)}
                          </span>
                          <div className="text-[10px] text-slate-400">
                            via {r.nextHop} ({r.interfaceName})
                          </div>
                        </div>
                        {(r.type === 'S' || r.type === 'S*') && (
                          <button
                            onClick={() =>
                              onUpdateDevice({
                                ...device,
                                routingTable: device.routingTable.filter((item) => item.id !== r.id),
                              })
                            }
                            className="text-rose-400 hover:text-rose-300 p-1"
                            title="Remove Static Route"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddStaticRoute} className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-medium text-slate-300">Add Static Route (ip route)</div>
                  <input
                    type="text"
                    value={newRouteNet}
                    onChange={(e) => setNewRouteNet(e.target.value)}
                    placeholder="Destination Network (e.g. 192.168.20.0)"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono"
                  />
                  <input
                    type="text"
                    value={newRouteMask}
                    onChange={(e) => setNewRouteMask(e.target.value)}
                    placeholder="Subnet Mask (e.g. 255.255.255.0)"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newRouteHop}
                      onChange={(e) => setNewRouteHop(e.target.value)}
                      placeholder="Next-Hop IP (e.g. 10.0.0.2)"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1 rounded bg-cyan-500 text-slate-950 font-semibold whitespace-nowrap"
                    >
                      + Add Route
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              !isSwitch && (
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 text-slate-400">
                  End devices use their configured Default Gateway ({device.defaultGateway || 'None'}) to forward off-subnet traffic.
                </div>
              )
            )}
          </div>
        )}

        {activeTab === 'tables' && (
          <div className="space-y-4">
            {/* ARP Table */}
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">ARP Cache (IPv4 → MAC)</span>
                {device.arpTable.length > 0 && (
                  <button
                    onClick={() => onUpdateDevice({ ...device, arpTable: [] })}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    Clear ARP
                  </button>
                )}
              </div>
              {device.arpTable.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  ARP cache is currently empty. Send a Ping to trigger ARP Request/Reply resolution.
                </p>
              ) : (
                <div className="space-y-1 font-mono text-[11px]">
                  {device.arpTable.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 border border-slate-800"
                    >
                      <span className="text-cyan-300">{entry.ipAddress}</span>
                      <span className="text-slate-300">{entry.macAddress}</span>
                      <span className="text-slate-500">{entry.interfaceName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Switch MAC Address Table */}
            {isSwitch && (
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">MAC Address Table (CAM)</span>
                  {device.macTable.length > 0 && (
                    <button
                      onClick={() => onUpdateDevice({ ...device, macTable: [] })}
                      className="text-[11px] text-slate-400 hover:text-white"
                    >
                      Clear MACs
                    </button>
                  )}
                </div>
                {device.macTable.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    No MAC addresses learned yet. Transmit traffic across the switch to observe source MAC learning.
                  </p>
                ) : (
                  <div className="space-y-1 font-mono text-[11px]">
                    {device.macTable.map((m, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 border border-slate-800"
                      >
                        <span className="text-amber-300">VLAN {m.vlan}</span>
                        <span className="text-slate-200">{m.macAddress}</span>
                        <span className="text-cyan-300">{m.interfaceName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-3">
            {!isEndDevice && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-200">Generated Running-Config</span>
                  <span className="text-[11px] text-slate-400">Synchronized with CLI</span>
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64">
                  {generateRunningConfigText(device)}
                </pre>
              </div>
            )}

            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2">
              <div className="font-semibold text-slate-200">Device Model Capabilities</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                This simulated {device.model} supports real-time state synchronization between the graphical inspector, CLI terminal, and packet simulation engine.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
